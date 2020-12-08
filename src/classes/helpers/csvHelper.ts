import { stringify } from 'csv';
import { existsSync, mkdirSync, writeFile } from 'fs';
import { DateTime, Duration } from 'luxon';
import { resolve } from 'path';
import { Constants } from '../../../../common/typescript/constants';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { App } from '../../app';
import TaskController from '../controllers/taskController';

export class CsvHelper {
  static get currentTimeStamp() {
    const currentTimeStamp = DateTime.fromJSDate(new Date()).toFormat(Constants.contextCsvFormat);
    return currentTimeStamp;
  }

  static createDir(): string {
    // creating dir and resolving file name
    const currentTimeStamp = CsvHelper.currentTimeStamp;
    const fileName = Constants.CONTEXT_BASE_FILE_NAME + '_' + currentTimeStamp + '.csv';
    const relativePathToCsvFolder: string = './../../../serverNew/csv';
    const absolutePathToCsvFolder: string = resolve(App.absolutePathToAppJs, relativePathToCsvFolder);
    if (!existsSync(absolutePathToCsvFolder)) {
      mkdirSync(absolutePathToCsvFolder);
    }
    // https://stackoverflow.com/questions/10227107/write-to-a-csv-in-node-js/48463225
    const absolutePathToCsvFile = resolve(absolutePathToCsvFolder, fileName);

    return absolutePathToCsvFile;
  }

  static async write(timeEntryDocsByInterval: ITimeEntryDocument[]) {
    const columns = [{ key: 'day' }, { key: 'startTime' }, { key: 'durationText' }, {key: 'durationSuffix'}, { key: 'taskNumber' }, { key: 'taskName' }, {key: 'isDisabledInCommit'}, {key: 'isDisabledInBooking'}];
    const csvData: any[] = [];
    let timeEntryDocsByIntervalIndex: number = -1;
    for (const oneTimeEntryDoc of timeEntryDocsByInterval) {
      timeEntryDocsByIntervalIndex++;
      if (!oneTimeEntryDoc || oneTimeEntryDoc === null) {
        App.logger.error('oneTimeEntryDoc as index:' + timeEntryDocsByIntervalIndex);
        continue;
      }
      const oneCorrespondingTask: ITasksDocument | null = await TaskController.getCorresponding(oneTimeEntryDoc, App.mongoDbOperations);
      if (!oneCorrespondingTask) {
        App.logger.error('no corresponding task for:' + JSON.stringify(oneTimeEntryDoc, null, 4));
        continue;
      }

      const duration = Duration.fromObject(oneTimeEntryDoc.durationInMilliseconds);
      const durationText = duration.toFormat(Constants.contextDurationFormat);
      const durationSuffix = duration.milliseconds.toString();
      const day = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextIsoFormat);
      const startTime = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextDurationFormat);
      const taskNumber = (oneCorrespondingTask as ITasksDocument).number;
      const taskName = (oneCorrespondingTask as ITasksDocument).name;
      const isDisabledInCommit = oneTimeEntryDoc.isDisabledInCommit.toString();
      const isDisabledInBooking = oneTimeEntryDoc.isDisabledInBooking.toString();

      csvData.push({
        durationText,
        durationSuffix,
        day,
        startTime,
        taskNumber,
        taskName,
        isDisabledInCommit,
        isDisabledInBooking,
      });
    }

    const absolutePathToCsvFile = CsvHelper.createDir();
    return new Promise<any>((resolve: (value?: any) => void) => {
      // writing data to .csv file
      stringify(csvData, { delimiter: ';', header: true, columns: columns }, (err, output) => {
        if (err) {
          resolve(false);
          throw err;
        }

        writeFile(absolutePathToCsvFile, output, (writeFileErr) => {
          if (writeFileErr) {
            resolve(false);
            throw writeFileErr;
          }
          resolve(true);
          App.logger.info(absolutePathToCsvFile);
        });
      });
    });

  }
}
