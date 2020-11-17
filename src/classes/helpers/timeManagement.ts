import { ITimeEntryDocument } from './../../../../common/typescript/mongoDB/iTimeEntryDocument';

export class TimeManagement {
    public static timeEntryToDuration(timeEntry: ITimeEntryDocument) {
        const milliseconds = TimeManagement.calculateTimeDifferenceWithoutPauses(timeEntry);
        return milliseconds;
        // const minutes = TimeManagement.millisecondsInMinutes(milliseconds);
        // if (minutes === 0) {
        //     // only for DEBUGGING purposes
        //     return 1;
        // }

        // // const minutesOfAnHour = minutes % 60;
        // // if (minutesOfAnHour < 15) {
        // //     return 0;
        // // }
        // // if (minutesOfAnHour < 30) {
        // //     return 15;
        // // }
        // // if (minutesOfAnHour < 45) {
        // //     return 30;
        // // }
        // // if (minutesOfAnHour < 60) {
        // //     return 45;
        // // }
        // return minutes;
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

    public static millisecondsInMinutes(durationInMilliseconds: number): number {
        return Math.floor(durationInMilliseconds / (60 * 1000));
      }
}
