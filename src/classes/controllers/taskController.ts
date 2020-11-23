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
import { DurationFormatter } from './../../../../common/typescript/helpers/durationFormatter';

export default {
  async generateContextLinesFrom(timeEntryDocs: ITimeEntryDocument[], mongoDbOperations: MonogDbOperations): Promise<IContextLine[]> {
    const contextLines: IContextLine[] = [];
    if (!timeEntryDocs || !timeEntryDocs.length) {
      return [];
    }

    for (const oneTimeEntryDoc of timeEntryDocs) {
      const taskId = oneTimeEntryDoc._taskId;
      const correspondingTasks: ITasksDocument[] = await this.getViaTaskId(taskId, mongoDbOperations);
      if (!correspondingTasks || !correspondingTasks.length) {
        console.error('no corresponding task for:' + taskId);
        continue;
      }
      const oneCorrespondingTask: ITasksDocument = correspondingTasks[0];
      contextLines.push({
        duration: DurationFormatter.convertToDuration(oneTimeEntryDoc.durationInMilliseconds),
        startTime: oneTimeEntryDoc.startTime,
        taskName: oneCorrespondingTask.name,
        taskId: oneTimeEntryDoc._taskId,
        taskNumber: oneCorrespondingTask.number,
        taskNumberUrl: '',
      });
    }

    return contextLines;
  },
  patchDurationSumMap(singleDoc: ITimeEntryDocument, mongoDbOperations: MonogDbOperations) {
    // patchPromiseForWritingTheDuration.then(() => {
    const taskId = singleDoc._taskId;
    const propertyValue = singleDoc.durationInMilliseconds;
    const taskPromise = this.getViaTaskId(taskId, mongoDbOperations);
    taskPromise.then((taskDocs: ITasksDocument[]) => {
      if (!taskDocs || !taskDocs.length || taskDocs.length > 1) {
        console.error('no or more than one task!');
        return;
      }
      const durationSumInMillisecondsMap: { [dayGetTime: number]: number } = {};
      const mongoDbDurationSumMap = taskDocs[0].durationSumInMillisecondsMap;

      const currentDayGetTime = singleDoc.day.getTime();

      let newSum;
      if (mongoDbDurationSumMap && mongoDbDurationSumMap[currentDayGetTime]) {
        const currentDurationSum = mongoDbDurationSumMap[currentDayGetTime];
        newSum = currentDurationSum + propertyValue;
      } else {
        newSum = /*0 +*/ propertyValue;
      }
      durationSumInMillisecondsMap[currentDayGetTime] = newSum;

      const innerPatchPromise = this.patchNewDurationSumInMilliseconds(taskId, durationSumInMillisecondsMap, mongoDbOperations);
      // innerPatchPromise.then(resolve);
      // innerPatchPromise.catch(resolve);
      return innerPatchPromise;
    });
    // });
  },
  patchNewDurationSumInMilliseconds(taskId: string, newSumMap: { [key: number]: number }, mongoDbOperations: MonogDbOperations) {
    const query: FilterQuery<any> = {};
    query[routes.taskIdProperty] = taskId;

    return mongoDbOperations.patch(routes.durationSumInMillisecondsPropertyName, newSumMap, routes.tasksCollectionName, query);
  },
  getViaTaskId(taskId: string, mongoDbOperations: MonogDbOperations) {
    const query: FilterQuery<any> = {};
    query[routes.taskIdProperty] = taskId;

    // DEBUGGING:
    // console.log('tasksCollection:' + routes.tasksCollectionName);
    // console.log(JSON.stringify(query, null, 4));

    return mongoDbOperations.getFiltered(routes.tasksCollectionName, query);
  },
  getViaProjectId(projectId: string, mongoDbOperations: MonogDbOperations) {
    const filterQuery: FilterQuery<any> = {};
    filterQuery[routes.projectIdPropertyAsForeignKey] = projectId;
    filterQuery[routes.isDisabledProperty] = false;

    return mongoDbOperations.getFiltered(routes.tasksCollectionName, filterQuery);
  },
  post(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    const task: ITask = body[routes.taskBodyProperty];

    const extendedTask: ITasksDocument = _.clone(task) as ITasksDocument;
    extendedTask.isDisabled = false;

    return mongoDbOperations.insertOne(extendedTask, routes.tasksCollectionName);
  },
  get(req: Request, mongoDbOperations: MonogDbOperations, filterQuery?: FilterQuery<any>): Promise<any[]> {
    if (!filterQuery) {
      const defaultFilterQuery: FilterQuery<any> = {};
      defaultFilterQuery[routes.isDisabledProperty] = false;
      return mongoDbOperations.getFiltered(routes.tasksCollectionName, defaultFilterQuery);
    }
    return mongoDbOperations.getFiltered(routes.tasksCollectionName, filterQuery);
  },
  patch(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
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
};
