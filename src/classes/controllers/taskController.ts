import { MonogDbOperations } from './../helpers/mongoDbOperations';
import { Request } from 'express';
// @ts-ignore
import routes from '../../../../common/typescript/routes.js';
import { ITask } from './../../../../common/typescript/iTask';
import { ITasksDocument } from './../../../../common/typescript/mongoDB/iTasksDocument';
import _ from 'lodash';
import { FilterQuery } from 'mongodb';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { IContextLine } from '../../../../common/typescript/iContextLine';
import { DateTime, Duration } from 'luxon';
import stringify  from 'csv-stringify';
import { writeFile } from 'fs';
import { Constants } from './../../../../common/typescript/constants';
import { CsvHelper } from '../helpers/csvHelper';
import App from '../../app';

class TaskController {
  static async generateContextLinesFrom(timeEntryDocs: ITimeEntryDocument[], mongoDbOperations: MonogDbOperations): Promise<IContextLine[]> {
    const contextLines: IContextLine[] = [];
    if (!timeEntryDocs || !timeEntryDocs.length) {
      return [];
    }
    // const stringify = new Stringifier({
    //   columns: ,
    //   delimiter: ',',
    // });
    const columns = [{key:'day'}, {key: 'startTime'}, {key: 'durationText'}, {key:'taskNumber'}, {key: 'taskName'}];
    const csvData = [];

    for (const oneTimeEntryDoc of timeEntryDocs) {
      const taskId = oneTimeEntryDoc._taskId;
      const correspondingTasks: ITasksDocument[] = await TaskController.getViaTaskId(taskId, mongoDbOperations);
      if (!correspondingTasks || !correspondingTasks.length) {
        App.logger.error('no corresponding task for:' + taskId);
        continue;
      }
      const oneCorrespondingTask: ITasksDocument = correspondingTasks[0];

      const duration = Duration.fromObject(oneTimeEntryDoc.durationInMilliseconds);

      // csv Data
      try {
        const durationText = duration.toFormat(Constants.contextDurationFormat);
        const day = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextIsoFormat);
        const startTime = DateTime.fromJSDate(oneTimeEntryDoc.startTime).toFormat(Constants.contextDurationFormat);
        const taskNumber = oneCorrespondingTask.number;
        const taskName =  oneCorrespondingTask.name;

        csvData.push({
          durationText,
          day,
          startTime,
          taskNumber,
          taskName,
        });

        contextLines.push({
          duration: durationText,
          day: oneTimeEntryDoc.startTime,
          startTime: oneTimeEntryDoc.startTime,
          taskName: taskName,
          taskId: oneTimeEntryDoc._taskId,
          taskNumber: taskNumber,
          taskNumberUrl: '',
        });
      } catch (e) {
        App.logger.info(e);
      }
    }

    stringify(csvData, { delimiter: ';', header: false, columns: columns }, (err, output) => {
      if (err) {
        throw err;
      }

      // https://stackoverflow.com/questions/10227107/write-to-a-csv-in-node-js/48463225
      const currentTimeStamp = CsvHelper.currentTimeStamp;
      const fileName = Constants.CONTEXT_BASE_FILE_NAME + '_' + currentTimeStamp + '.csv';
      writeFile(fileName, output, (writeFileErr) => {
        if (writeFileErr) {
          throw writeFileErr;
        }
        App.logger.info(fileName);
      });

    });

    return contextLines;
  }
  static patchDurationSumMap(singleDoc: ITimeEntryDocument, mongoDbOperations: MonogDbOperations) {
    // patchPromiseForWritingTheDuration.then(() => {
    const taskId = singleDoc._taskId;
    const propertyValue = singleDoc.durationInMilliseconds;
    const taskPromise = TaskController.getViaTaskId(taskId, mongoDbOperations);
    taskPromise.then((taskDocs: ITasksDocument[]) => {
      if (!taskDocs || !taskDocs.length || taskDocs.length > 1) {
        App.logger.error('no or more than one task!');
        return;
      }
      const durationSumInMillisecondsMap: { [dayGetTime: number]: Duration } = {};
      const mongoDbDurationSumMap = taskDocs[0].durationSumInMillisecondsMap;

      const currentDayGetTime = singleDoc.day.getTime();

      let newSum: Duration;
      if (mongoDbDurationSumMap && mongoDbDurationSumMap[currentDayGetTime]) {
        const currentDurationSum = mongoDbDurationSumMap[currentDayGetTime];

        const currentDurationSumDuration = Duration.fromObject(currentDurationSum);
        const additionalDurationSum = Duration.fromObject(propertyValue);
        const newDurationSum = currentDurationSumDuration.plus(additionalDurationSum);
        newSum = newDurationSum;
      } else {
        newSum = /*0 +*/ Duration.fromObject(propertyValue);
      }
      durationSumInMillisecondsMap[currentDayGetTime] = newSum;

      const innerPatchPromise = TaskController.patchNewDurationSumInMilliseconds(taskId, durationSumInMillisecondsMap, mongoDbOperations);
      // innerPatchPromise.then(resolve);
      // innerPatchPromise.catch(resolve);
      return innerPatchPromise;
    });
    // });
  }
  static patchNewDurationSumInMilliseconds(taskId: string, newSumMap: { [key: number]: object }, mongoDbOperations: MonogDbOperations) {
    const query: FilterQuery<any> = {};
    query[routes.taskIdProperty] = taskId;

    return mongoDbOperations.patch(routes.durationSumInMillisecondsPropertyName, newSumMap, routes.tasksCollectionName, query);
  }
  static getViaTaskId(taskId: string, mongoDbOperations: MonogDbOperations) {
    const query: FilterQuery<any> = {};
    query[routes.taskIdProperty] = taskId;

    // DEBUGGING:
    // App.logger.info('tasksCollection:' + routes.tasksCollectionName);
    // App.logger.info(JSON.stringify(query, null, 4));

    return mongoDbOperations.getFiltered(routes.tasksCollectionName, query);
  }
  static getViaProjectId(projectId: string, mongoDbOperations: MonogDbOperations) {
    const filterQuery: FilterQuery<any> = {};
    filterQuery[routes.projectIdPropertyAsForeignKey] = projectId;
    filterQuery[routes.isDisabledProperty] = false;

    return mongoDbOperations.getFiltered(routes.tasksCollectionName, filterQuery);
  }
  static post(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    const task: ITask = body[routes.taskBodyProperty];

    const extendedTask: ITasksDocument = _.clone(task) as ITasksDocument;
    extendedTask.isDisabled = false;

    return mongoDbOperations.insertOne(extendedTask, routes.tasksCollectionName);
  }
  static get(req: Request, mongoDbOperations: MonogDbOperations, filterQuery?: FilterQuery<any>): Promise<any[]> {
    if (!filterQuery) {
      const defaultFilterQuery: FilterQuery<any> = {};
      defaultFilterQuery[routes.isDisabledProperty] = false;
      return mongoDbOperations.getFiltered(routes.tasksCollectionName, defaultFilterQuery);
    }
    return mongoDbOperations.getFiltered(routes.tasksCollectionName, filterQuery);
  }
  static patch(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    const propertyName = body[routes.httpPatchIdPropertyToUpdateName]; // 'isDeletedInClient';
    const propertyValue = body[routes.httpPatchIdPropertyToUpdateValue]; //true;
    const idPropertyName = body[routes.httpPatchIdPropertyName];
    const projectId = body[routes.httpPatchIdPropertyValue];

    // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
    const theQueryObj: FilterQuery<any> = {};
    theQueryObj[idPropertyName] = projectId;

    const collectionName = routes.tasksCollectionName;
    return mongoDbOperations.patch(propertyName, propertyValue, collectionName, theQueryObj);
  }
}

export default TaskController;
