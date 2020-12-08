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
    const csvData: any[] = [];
    for (const oneTimeEntryDoc of timeEntryDocsByInterval) {
      const oneCorrespondingTask: ITasksDocument | null = await TaskController.getCorresponding(oneTimeEntryDoc, App.mongoDbOperations);
      if (!oneTimeEntryDoc || oneTimeEntryDoc === null) {
        continue;
      }

      const duration = Duration.fromObject(oneTimeEntryDoc.durationInMilliseconds);
      const durationText = duration.toFormat(Constants.contextDurationFormat);
      const day = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextIsoFormat);
      const startTime = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextDurationFormat);
      const taskNumber = (oneCorrespondingTask as ITasksDocument).number;
      const taskName = (oneCorrespondingTask as ITasksDocument).name;

      csvData.push({
        durationText,
        day,
        startTime,
        taskNumber,
        taskName,
      });
    }

    const columns = [{ key: 'day' }, { key: 'startTime' }, { key: 'durationText' }, { key: 'taskNumber' }, { key: 'taskName' }];
    const absolutePathToCsvFile = CsvHelper.createDir();
    return new Promise<any>((resolve: (value?: any) => void) => {
      // writing data to .csv file
      stringify(csvData, { delimiter: ';', header: false, columns: columns }, (err, output) => {
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
