import { ITimeEntryDocument } from './../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { IPause } from './../../../../common/typescript/iPause';

export class TimeManagement {

    public static pauseEntryToDuration(pause: IPause) {
        if(pause.endTime && pause.startTime) {
            const milliseconds = TimeManagement.getTimeDifferenceInMilliseconds(pause.endTime, pause.startTime);
            const minutes = TimeManagement.millisecondsInMinutes(milliseconds);
            
            if (minutes === 0) {
                // only for DEBUGGING purposes
                return 1;
            }
            
            return minutes;
        } else {
            console.error('cannot calculate time difference for pause');
            return 0;
        }
    }

    public static timeEntryToDuration(timeEntry: ITimeEntryDocument) {
        const milliseconds = TimeManagement.calculateTimeDifferenceWithoutPauses(timeEntry);
        const minutes = TimeManagement.millisecondsInMinutes(milliseconds);
        if (minutes === 0) {
            // only for DEBUGGING purposes
            return 1;
        }

        // const minutesOfAnHour = minutes % 60;
        // if (minutesOfAnHour < 15) {
        //     return 0;
        // }
        // if (minutesOfAnHour < 30) {
        //     return 15;
        // }
        // if (minutesOfAnHour < 45) {
        //     return 30;
        // }
        // if (minutesOfAnHour < 60) {
        //     return 45;
        // }
        return minutes;
    }

    public static getTimeDifferenceInMilliseconds(endTime: Date, startTime: Date): number {
        const theDuration = endTime.getTime() - startTime.getTime();
        return theDuration;
    }

    public static calculateTimeDifferenceWithoutPauses(timeEntry: ITimeEntryDocument): number {
        if (!timeEntry || !timeEntry.pauses) {
            console.error('cannot calculate duration for:' + JSON.stringify(timeEntry, null, 4));
            return 0;
        }
        let pausesDuration = 0;
        timeEntry.pauses.forEach((onePause: IPause) => {
            if (onePause.startTime && onePause.endTime) {
                pausesDuration += TimeManagement.getTimeDifferenceInMilliseconds(onePause.endTime, onePause.startTime);
                return;
            }
            if (onePause.startTime && !onePause.endTime) {
                console.error('one pause has no endTime to startTime:' + onePause.startTime);
                pausesDuration += TimeManagement.getTimeDifferenceInMilliseconds(new Date(), onePause.startTime);
                return;
            }
            console.error('pause has neither startTime nor endTime');
        });
        let trackedDurationInMilliseconds = TimeManagement.getTimeDifferenceInMilliseconds(timeEntry.endTime, timeEntry.startTime);
        trackedDurationInMilliseconds = trackedDurationInMilliseconds - pausesDuration;

        return trackedDurationInMilliseconds;
    }

    public static millisecondsInMinutes(durationInMilliseconds: number): number {
        return Math.floor(durationInMilliseconds / (60 * 1000));
      }
}