import { ITimeEntryDocument } from "../../../../common/typescript/mongoDB/iTimeEntryDocument";
import App from "../../app";
import timeEntriesController from "../controllers/timeEntriesController";
import { ISummarizedTimeEntries } from "./../../../../common/typescript/iSummarizedTimeEntries";

export class CalculateDurationsByIntervall {
    static async getTimeEntriesByTaskCategory(timeEntryDocsByIntervall: ITimeEntryDocument[]) {
        return new Promise<{ [category: string]: ITimeEntryDocument[] }>((resolve: (value?: { [category: string]: ITimeEntryDocument[] }) => void) => {
            const timeEntriesByCategory: { [category: string]: ITimeEntryDocument[] } = {};

            let indexInTimeEntries = 0;
            const loop = async () => {
                if (indexInTimeEntries >= timeEntryDocsByIntervall.length) {
                    resolve(timeEntriesByCategory);
                    // end of loop
                    return;
                }

                // loop body (in every iteration)
                const oneTimeEntryDoc: ITimeEntryDocument = timeEntryDocsByIntervall[indexInTimeEntries];
                const oneTaskId = oneTimeEntryDoc._taskId;
                try {
                    const taskCategory = await timeEntriesController.getCategoryForTaskId(App.mongoDbOperations, oneTaskId);
                    if (!timeEntriesByCategory[taskCategory]) {
                        timeEntriesByCategory[taskCategory] = [];
                    }
                    timeEntriesByCategory[taskCategory].push(oneTimeEntryDoc);
                    // next iteration in loop
                    indexInTimeEntries++;
                    loop();
                } catch (e) {
                    console.error(e);
                    // next iteration in loop
                    indexInTimeEntries++;
                    loop();
                }
            };
            // initial call
            loop();
        });
    }

    private static getDurationOfTimeEntry(timeEntry: ITimeEntryDocument) {
        return timeEntry.endTime.getTime() - timeEntry.startTime.getTime();
    }

    static async calculate(startTime: Date, endTime: Date, isDisabledPropertyName?: string, isDisabledPropertyValue?: boolean) {
        try {
            // DEBUGGING:
            // console.log(startTime.toUTCString());
            // console.log(endTime.toUTCString());

            const timeEntryDocsByIntervall: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTime, endTime, isDisabledPropertyName, isDisabledPropertyValue);
            if (!timeEntryDocsByIntervall || !timeEntryDocsByIntervall.length) {
                console.error('no time entries to calculate duration from');
                return null;
            }
            const durationSumByTaskIdMap: { [category: string]: { [taskId: string]: number } } = {};
            const durationSumFractionByTaskIdMap: { [category: string]: {[taskId: string]: number } } = {};
            const timeEntriesByCategory = await this.getTimeEntriesByTaskCategory(timeEntryDocsByIntervall);

            // DEBUGGING:
            // console.log(JSON.stringify(timeEntriesByCategory, null, 4))

            const categoryBufferMap: { [category: string]: ISummarizedTimeEntries } = {};
            let durationSumOverAllCategorys = 0.0;
            for (const taskCategory in timeEntriesByCategory) {
                if (!durationSumByTaskIdMap[taskCategory]) {
                    durationSumByTaskIdMap[taskCategory] = {};
                }
                if (!durationSumFractionByTaskIdMap[taskCategory]) {
                    durationSumFractionByTaskIdMap[taskCategory] =  {};
                }
                if (Object.prototype.hasOwnProperty.call(timeEntriesByCategory, taskCategory)) {
                    const timeEntriesOfOneCategory: ITimeEntryDocument[] = timeEntriesByCategory[taskCategory];
                    const oneTimeEntryIds: string[] = [];
                    // const oneTaskIds: string[] = [];
                    let oneOverallSum = 0.0;
                    timeEntriesOfOneCategory.forEach(oneTimeEntry => {
                        const oneDuration = this.getDurationOfTimeEntry(oneTimeEntry);

                        if (typeof durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] === 'undefined') {
                            durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] = 0;
                        }
                        durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] += oneDuration;

                        oneOverallSum += oneDuration;
                        oneTimeEntryIds.push(oneTimeEntry.timeEntryId);
                        // oneTaskIds.push(oneTimeEntry._taskId);
                    });
                    categoryBufferMap[taskCategory] = {
                        taskCategory: taskCategory,
                        overallDurationSum: oneOverallSum,
                        overallDurationSumFraction: -1.0,
                        _timeEntryIds: oneTimeEntryIds,
                        durationSumByTaskId: durationSumByTaskIdMap[taskCategory],
                        durationSumFractionByTaskId: durationSumFractionByTaskIdMap[taskCategory]
                        // taskIds: oneTaskIds
                    };
                    durationSumOverAllCategorys += oneOverallSum;
                }
            }

            // DEBUGGING:
            // console.log(JSON.stringify(categoryBufferMap, null, 4));

            for (const taskCategory in durationSumByTaskIdMap) {
                if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap, taskCategory)) {
                    // const element = durationSumByTaskIdMap[taskCategory];
                    for (const taskId in durationSumByTaskIdMap[taskCategory]) {
                        if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap[taskCategory], taskId)) {
                            const absolutedurationSumByTaskId = durationSumByTaskIdMap[taskCategory][taskId];
                            durationSumFractionByTaskIdMap[taskCategory][taskId] = absolutedurationSumByTaskId / durationSumOverAllCategorys;
        
                            // convert to hours:
                            durationSumByTaskIdMap[taskCategory][taskId] = (((absolutedurationSumByTaskId / 1000) / 60) / 60);
                        }
                    }
                }
            }


            // DEBUGGING:
            // console.log(JSON.stringify(categoryBufferMap, null, 4));
           
            for (const oneTaskCat in categoryBufferMap) {
                if (Object.prototype.hasOwnProperty.call(categoryBufferMap, oneTaskCat)) {
                    const summerizedEntry = categoryBufferMap[oneTaskCat];
                    summerizedEntry.overallDurationSumFraction = summerizedEntry.overallDurationSum / durationSumOverAllCategorys;

                    // convert to hours:
                    categoryBufferMap[oneTaskCat].overallDurationSum = (((categoryBufferMap[oneTaskCat].overallDurationSum / 1000) / 60) / 60);
                }
            }

            return Object.values(categoryBufferMap);
        }
        catch (e) {
            return e;
        }
    }
}