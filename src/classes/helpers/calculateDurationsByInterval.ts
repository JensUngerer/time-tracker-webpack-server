import { ITimeEntryDocument } from "../../../../common/typescript/mongoDB/iTimeEntryDocument";
import App from "../../app";
import timeEntriesController from "../controllers/timeEntriesController";

export interface ISummarizedTimeEntries {
    taskCategory: string;
    overallDurationSum: number;
    overallDurationSumFraction: number;
    durationSumByTaskId: { [taskId: string]: number };
    durationSumFractionByTaskId: { [taskId: string]: number };
    _timeEntryIds: string[];
}

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
            // console.log(startTime);
            // console.log(endTime);

            const timeEntryDocsByIntervall: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTime, endTime, isDisabledPropertyName, isDisabledPropertyValue);
            if (!timeEntryDocsByIntervall || !timeEntryDocsByIntervall.length) {
                console.error('no time entries to calculate duration from');
                return null;
            }
            const durationSumByTaskId: { [taskId: string]: number } = {};
            const durationSumFractionByTaskId: { [taskId: string]: number } = {};
            const timeEntriesByCategory = await this.getTimeEntriesByTaskCategory(timeEntryDocsByIntervall);

            // DEBUGGING:
            // console.log(JSON.stringify(timeEntriesByCategory, null, 4))

            const categoryBufferMap: { [category: string]: ISummarizedTimeEntries } = {};
            let durationSumOverAllCategorys = 0.0;
            for (const taskCategory in timeEntriesByCategory) {
                if (Object.prototype.hasOwnProperty.call(timeEntriesByCategory, taskCategory)) {
                    const timeEntriesOfOneCategory: ITimeEntryDocument[] = timeEntriesByCategory[taskCategory];
                    const oneTimeEntryIds: string[] = [];
                    // const oneTaskIds: string[] = [];
                    let oneOverallSum = 0.0;
                    timeEntriesOfOneCategory.forEach(oneTimeEntry => {
                        const oneDuration = this.getDurationOfTimeEntry(oneTimeEntry);

                        if (typeof durationSumByTaskId[oneTimeEntry._taskId] === 'undefined') {
                            durationSumByTaskId[oneTimeEntry._taskId] = 0;
                        }
                        durationSumByTaskId[oneTimeEntry._taskId] += oneDuration;

                        oneOverallSum += oneDuration;
                        oneTimeEntryIds.push(oneTimeEntry.timeEntryId);
                        // oneTaskIds.push(oneTimeEntry._taskId);
                    });
                    categoryBufferMap[taskCategory] = {
                        taskCategory: taskCategory,
                        overallDurationSum: oneOverallSum,
                        overallDurationSumFraction: -1.0,
                        _timeEntryIds: oneTimeEntryIds,
                        durationSumByTaskId,
                        durationSumFractionByTaskId
                        // taskIds: oneTaskIds
                    };
                    durationSumOverAllCategorys += oneOverallSum;
                }
            }

            // DEBUGGING:
            // console.log(JSON.stringify(categoryBufferMap, null, 4))

            for (const taskId in durationSumByTaskId) {
                if (Object.prototype.hasOwnProperty.call(durationSumByTaskId, taskId)) {
                    const absoluteDurationSumByTaskId = durationSumByTaskId[taskId];
                    durationSumFractionByTaskId[taskId] = absoluteDurationSumByTaskId / durationSumOverAllCategorys;

                    // convert to hours:
                    durationSumByTaskId[taskId] = (((absoluteDurationSumByTaskId / 1000) / 60) / 60);
                }
            }
            for (const oneTaskCat in categoryBufferMap) {
                if (Object.prototype.hasOwnProperty.call(categoryBufferMap, oneTaskCat)) {
                    const summerizedEntry = categoryBufferMap[oneTaskCat];
                    summerizedEntry.overallDurationSumFraction = summerizedEntry.overallDurationSum / durationSumOverAllCategorys;

                    // convert to hours:
                    categoryBufferMap[oneTaskCat].overallDurationSum = (((categoryBufferMap[oneTaskCat].overallDurationSum / 1000) / 60) / 60);
                }
            }

            // TODO: FIXME: use generic approach instead  of hard coded one
            // const firstCategoryTimeEntrySummary = categoryBufferMap['feature'];
            // return firstCategoryTimeEntrySummary;
            return categoryBufferMap;
        }
        catch (e) {
            return e;
        }
    }
}