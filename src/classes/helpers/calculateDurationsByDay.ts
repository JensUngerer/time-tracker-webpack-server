import { Request, Response } from "express";
import { ITimeEntryDocument } from "../../../../common/typescript/mongoDB/iTimeEntryDocument";
import timeEntriesController from "././../controllers/timeEntriesController";
import { App } from "../../app";
import { IDurationSumBase } from "../../../../common/typescript/iDurationSumBase";
import { IBookingDeclaration } from "../../../../common/typescript/iBookingDeclaration";
import { ITask } from "../../../../common/typescript/iTask";
import { Serialization } from "../../../../common/typescript/helpers/serialization";

export class CalculateDurationsByDay {

    constructor() { }

    async calculate(req: Request, res: Response, getBasis: (timeEntryDoc: ITimeEntryDocument) => Promise<IBookingDeclaration | ITask>, getId: (basis: IBookingDeclaration | ITask) => string, isDisabledProperty: string) {
        const addCurrentEntry = (groupedTimeEntriesMap: { [dayTimeStamp: number]: { [taskOrBookingId: string]: IDurationSumBase } }, dayTimeStamp: number, id:string, oneTimeEntryDoc: ITimeEntryDocument) => {
            const previousDurationSumInMilliseconds = groupedTimeEntriesMap[dayTimeStamp][id].durations[0].durationSumInMilliseconds;
            const currentDurationSumInMilliseconds = oneTimeEntryDoc.endTime.getTime() - oneTimeEntryDoc.startTime.getTime();
            const newDurationSumInMilliseconds = previousDurationSumInMilliseconds + currentDurationSumInMilliseconds;
            let newDurationSumInHours = Math.floor((newDurationSumInMilliseconds / (1000 * 60))) / 60;
            newDurationSumInHours = Math.round(newDurationSumInHours * 100) / 100;

            groupedTimeEntriesMap[dayTimeStamp][id].durations[0].durationInHours = newDurationSumInHours;
            groupedTimeEntriesMap[dayTimeStamp][id].durations[0].durationSumInMilliseconds = newDurationSumInMilliseconds;
            groupedTimeEntriesMap[dayTimeStamp][id].durations[0]._timeEntryIds.push(oneTimeEntryDoc.timeEntryId);
            // DEBUGGING:
            // console.log('adding value: ' + currentDurationSumInMilliseconds);
        };

        try {
            const timeEntryDocs: ITimeEntryDocument[] = await timeEntriesController.getDurationSumDays(req, App.mongoDbOperations, isDisabledProperty);
            const groupedTimeEntriesMap: { [dayTimeStamp: number]: { [taskOrBookingId: string]: IDurationSumBase } } = {};
            // const lastIndexInDurationMap: { [dayTimeStamp: number]: { [id: string]: number } } = {};

            let indexInTimeEntries = 0;
            const loop = async () => {
                if (indexInTimeEntries >= timeEntryDocs.length) {
                    // DEBUGGING:
                    // console.log(JSON.stringify(groupedTimeEntriesMap, null, 4));

                    // convert data structure
                    const convertedDataStructure: IDurationSumBase[] = [];

                    for (const timeStamp in groupedTimeEntriesMap) {
                        if (Object.prototype.hasOwnProperty.call(groupedTimeEntriesMap, timeStamp)) {
                            const allIdsOfADay = groupedTimeEntriesMap[timeStamp];
                            const parsedTimeStamp = parseFloat(timeStamp);
                            const buffer: IDurationSumBase = {
                                day: new Date(parsedTimeStamp),
                                durations: []
                            };

                            for (const theId in allIdsOfADay) {
                                if (Object.prototype.hasOwnProperty.call(allIdsOfADay, theId)) {
                                    const oneSum = allIdsOfADay[theId].durations[0];
                                    buffer.durations.push(oneSum);
                                }
                            }
                            convertedDataStructure.push(buffer);
                        }
                    }

                    const stringifiedResponse = Serialization.serialize(convertedDataStructure);
                    res.send(stringifiedResponse);
                    return;
                }
                const oneTimeEntryDoc: ITimeEntryDocument = timeEntryDocs[indexInTimeEntries];

                const day = oneTimeEntryDoc.day
                const dayTimeStamp = day.getTime();
                if (!groupedTimeEntriesMap[dayTimeStamp]) {
                    groupedTimeEntriesMap[dayTimeStamp] = {};
                }

                try {
                    const basis = await getBasis(oneTimeEntryDoc);
                    const bookingOrTaskId = getId(basis);
                    if (!groupedTimeEntriesMap[dayTimeStamp][bookingOrTaskId]) {
                        groupedTimeEntriesMap[dayTimeStamp][bookingOrTaskId] = {
                            day,
                            durations: [
                                {
                                    basis,
                                    durationInHours: 0,
                                    durationSumInMilliseconds: 0,
                                    _timeEntryIds: []
                                }
                            ]
                        };
                    } 

                    addCurrentEntry(groupedTimeEntriesMap, dayTimeStamp, bookingOrTaskId, oneTimeEntryDoc);

                    indexInTimeEntries++;
                    loop();
                } catch (eBasis) {
                    console.error(eBasis);

                    indexInTimeEntries++;
                    loop();
                }
            };
            // initial call
            loop();

        } catch (e) {
            console.error(e);
        }
    }
}