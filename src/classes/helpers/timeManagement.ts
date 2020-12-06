import { ITimeEntryDocument } from './../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { DateTime, Duration } from 'luxon';
import App from '../../app';

export class TimeManagement {
  public static timeEntryToDuration(timeEntry: ITimeEntryDocument) {
    const milliseconds = TimeManagement.calculateTimeDifferenceWithoutPauses(timeEntry);
    return milliseconds;
  }

  public static getTimeDifferenceInMilliseconds(endTime: Date, startTime: Date): Duration {
    const luxonEndTime = DateTime.fromJSDate(endTime);
    const luxonStartTime = DateTime.fromJSDate(startTime);
    const difference: Duration = luxonEndTime.diff(luxonStartTime);
    // const theDuration = difference.milliseconds;
    // return theDuration;
    return difference;
  }

  public static calculateTimeDifferenceWithoutPauses(timeEntry: ITimeEntryDocument): Duration {
    if (!timeEntry) {
      App.logger.error('cannot calculate duration for:' + JSON.stringify(timeEntry, null, 4));
      return Duration.fromMillis(0);
    }

    const trackedDurationInMilliseconds = TimeManagement.getTimeDifferenceInMilliseconds(timeEntry.endTime, timeEntry.startTime);
    return trackedDurationInMilliseconds;
  }
}
