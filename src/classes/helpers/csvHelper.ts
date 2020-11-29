import { DateTime } from 'luxon';
import { Constants } from '../../../../common/typescript/constants';

export class CsvHelper {
  static get currentTimeStamp() {
    const currentTimeStamp = DateTime.fromJSDate(new Date()).toFormat(Constants.contextCsvFormat);
    return currentTimeStamp;
  }
}
