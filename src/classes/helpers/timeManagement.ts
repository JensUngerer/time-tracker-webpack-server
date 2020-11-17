import { ITimeEntryDocument } from './../../../../common/typescript/mongoDB/iTimeEntryDocument';

export class TimeManagement {
    public static timeEntryToDuration(timeEntry: ITimeEntryDocument) {
        const milliseconds = TimeManagement.calculateTimeDifferenceWithoutPauses(timeEntry);
        return milliseconds;
    }

    public static getTimeDifferenceInMilliseconds(endTime: Date, startTime: Date): number {
        const theDuration = endTime.getTime() - startTime.getTime();
        return theDuration;
    }

    public static calculateTimeDifferenceWithoutPauses(timeEntry: ITimeEntryDocument): number {
        if (!timeEntry) {
            console.error('cannot calculate duration for:' + JSON.stringify(timeEntry, null, 4));
            return 0;
        }

        const trackedDurationInMilliseconds = TimeManagement.getTimeDifferenceInMilliseconds(timeEntry.endTime, timeEntry.startTime);
        return trackedDurationInMilliseconds;
    }
}
