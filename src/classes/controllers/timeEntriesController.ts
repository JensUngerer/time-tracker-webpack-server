import { RequestProcessingHelpers } from './../helpers/requestProcessingHelpers';
import { TimeManagement } from './../helpers/timeManagement';
import { FilterQuery } from 'mongodb';
import { Request } from 'express';
import { ITimeEntry } from './../../../../common/typescript/iTimeEntry';
// @ts-ignore
import routesConfig from './..&../../../../../../common/typescript/routes.js';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
import { ITimeEntryDocument } from './../../../../common/typescript/mongoDB/iTimeEntryDocument';
import _ from 'lodash';
import { DurationCalculator } from './../../../../common/typescript/helpers/durationCalculator';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { ITimeInterval } from './../../../../common/typescript/iTimeInterval';

export default {
  getNonCommittedDays(mongoDbOperations: MonogDbOperations, isDisabledProperty: string) {
    const daysByStartTime: { [startDateTime: number]: ITimeInterval } = {};
    return new Promise((resolve: (value?: any) => void) => {
      const theQueryObj: FilterQuery<any> = {};
      theQueryObj[isDisabledProperty] = false;

      const allNonDisabledTimeEntries = mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, theQueryObj);
      allNonDisabledTimeEntries.then((timeEntryDocs: ITimeEntryDocument[]) => {
        // DEBUGGING:
        // console.log(JSON.stringify(timeEntryDocs, null, 4));
        if (!timeEntryDocs || !timeEntryDocs.length) {
          resolve(null);
          return;
        }

        timeEntryDocs.forEach((oneTimeEntry: ITimeEntryDocument) => {
          const utcStartTime = DurationCalculator.getDayFrom(oneTimeEntry.startTime);
          const utcEndTime = DurationCalculator.getLatestDayFrom(oneTimeEntry.startTime);
          const valueToBeStored = { utcStartTime, utcEndTime };
          const startTimeTime = utcStartTime.getTime();
          if (!daysByStartTime[startTimeTime]) {
            daysByStartTime[startTimeTime] = valueToBeStored;
          }
        });

        // DEBUGGING:
        // console.log(JSON.stringify(response, null, 4));

        resolve(Object.values(daysByStartTime));
      });
    });
  },
  getCategoryForTaskId(mongoDbOperations: MonogDbOperations, taskId: string, propertyName: string) {
    return new Promise<any>((resolve: (value?: any) => void, reject: (value?: any) => void) => {
      const theQueryObj: FilterQuery<any> = {};
      theQueryObj[routesConfig.taskIdProperty] = taskId;
      const promise = mongoDbOperations.getFiltered(routesConfig.tasksCollectionName, theQueryObj);
      promise.then((taskDocuments: ITasksDocument[]) => {
        if (!taskDocuments || !taskDocuments.length || taskDocuments.length > 1) {
          reject('there is no tasks document (or more than one for) for taskId:' + taskId);
          return;
        }
        const firstDocument = taskDocuments[0];
        resolve((firstDocument as any)[propertyName]);
      });
      promise.catch((err: any) => {
        reject(err);
      });
    });
  },
  getDurationsByInterval(mongoDbOperations: MonogDbOperations, startTimeUtc: Date, endTimeUtc: Date, isDisabledPropertyName?: string, isDisabledPropertyValue?: boolean) {
    const theQueryObj: FilterQuery<any> = {};

    // https://stackoverflow.com/questions/21286599/inserting-and-querying-date-with-mongodb-and-nodejs/21286896#21286896
    theQueryObj[routesConfig.startTimeProperty] = {
      '$gte': startTimeUtc,
    };

    // theQueryObj[routesConfig.startTimeProperty] = {
    //     // "startTime": {
    //         "$gte": {
    //             $dateFromString: {
    //                 dateString: startTimeUtc.toISOString()
    //             }
    //         }
    //     // }
    // };
    theQueryObj[routesConfig.endDateProperty] = {
      '$lt': endTimeUtc,
    };
    if (typeof isDisabledPropertyName !== 'undefined'
      && typeof isDisabledPropertyValue !== 'undefined') {
      theQueryObj[isDisabledPropertyName] = isDisabledPropertyValue;
    }

    // DEBUGGING
    // console.log(JSON.stringify(theQueryObj, null, 4));

    const promise = mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, theQueryObj);
    return promise;
  },
  getRunning(mongoDbOperations: MonogDbOperations) {
    const queryObj: any = {};
    queryObj[routesConfig.endDateProperty] = null;
    return mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, queryObj);
  },
  getTimeEntriesForTaskIds(taskIds: string[], mongoDbOperations: MonogDbOperations, isDisabledProperty?: string) {
    if (!taskIds || taskIds.length === 0) {
      console.error('cannot get timeEntries because of missing taskIds');
    }
    return new Promise<any>((resolve: (value: any) => void) => {
      let timeEntries: ITimeEntryDocument[] = [];
      let taskIdIndex = 0;
      const promiseThenLoop = () => {
        if (taskIdIndex < taskIds.length) {
          const queryObj: FilterQuery<any> = {};
          queryObj[routesConfig.taskIdPropertyAsForeignKey] = taskIds[taskIdIndex];
          // NEW only use the non-committed timeEntry-documents
          if (!isDisabledProperty) {
            queryObj[routesConfig.isDeletedInClientProperty] = false;
          } else {
            queryObj[isDisabledProperty] = false;
          }

          const promise = mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, queryObj);
          promise.then((retrievedTimeEntries: ITimeEntryDocument[]) => {
            // DEBUGGING:
            // console.error(JSON.stringify(retrievedTimeEntries, null, 4));

            timeEntries = timeEntries.concat(retrievedTimeEntries);

            taskIdIndex++;
            promiseThenLoop();
          });
          promise.catch(() => {
            console.error('something went wrong when getting the timeEntries for index:' + taskIdIndex);
            console.error(JSON.stringify(taskIds, null, 4));

            taskIdIndex++;
            promiseThenLoop();
          });
        } else {
          resolve(timeEntries);
        }
      };
      // initial call
      promiseThenLoop();
    });
  },
  getTaskIdsForProjectId(projectId: string, mongoDbOperations: MonogDbOperations) {
    const queryObj: FilterQuery<any> = {};
    queryObj[routesConfig.projectIdPropertyAsForeignKey] = projectId;
    const tasksPromise = mongoDbOperations.getFiltered(routesConfig.tasksCollectionName, queryObj);
    return new Promise<any>((resolve: (value: any) => void) => {
      tasksPromise.then((retrievedTasks: ITasksDocument[]) => {
        // DEBUGGING:
        // console.error(JSON.stringify(retrievedTasks, null, 4));

        const taskIds: string[] = [];
        if (!retrievedTasks || retrievedTasks.length === 0) {
          console.error('there are no tasks for projectId:' + projectId);
          resolve(false);
          return;
        }
        retrievedTasks.forEach((oneTask: ITasksDocument) => {
          const currentTaskId = oneTask.taskId;
          taskIds.push(currentTaskId);
        });
        resolve(taskIds);
      });
      tasksPromise.catch(() => {
        console.error('error when trying to get tasks by projectId');
        resolve(false);
      });
    });
  },
  getDurationStr(timeEntryId: string, mongoDbOperations: MonogDbOperations) {
    const queryObj: FilterQuery<any> = {};
    queryObj[routesConfig.timeEntryIdProperty] = timeEntryId;
    const timeEntriesPromise = mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, queryObj);
    return new Promise<any>((resolve: (value: any) => void) => {
      timeEntriesPromise.then((theTimeEntriesDocs: ITimeEntryDocument[]) => {
        let durationStr = '';
        if (!theTimeEntriesDocs || theTimeEntriesDocs.length === 0) {
          console.error('cannot get duration because of missing timeEntry-document');
          return;
        }
        const singleTimeEntryDoc = theTimeEntriesDocs[0];

        // DEBUGGING
        // console.log(JSON.stringify(singleTimeEntryDoc, null, 4));

        durationStr = DurationCalculator.calculateDuration(singleTimeEntryDoc);
        resolve(durationStr);
      });
    });

  },
  post(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    const timeEntry: ITimeEntry = body[routesConfig.timeEntriesBodyProperty];

    const extendedTimeEntry: ITimeEntryDocument = _.clone(timeEntry) as ITimeEntryDocument;
    extendedTimeEntry.isDisabledInBooking = false;
    extendedTimeEntry.isDisabledInCommit = false;
    extendedTimeEntry.startTime = new Date(extendedTimeEntry.startTime) as Date;

    // DEBUGGING string or object === date-object?
    // console.log(typeof (extendedTimeEntry.startTime))

    return mongoDbOperations.insertOne(extendedTimeEntry, routesConfig.timEntriesCollectionName);
  },
  get(req: Request, mongoDbOperations: MonogDbOperations, filterQuery?: FilterQuery<any>): Promise<any> {
    if (!filterQuery) {
      const queryObj: FilterQuery<any> = {};
      queryObj[routesConfig.isDeletedInClientProperty] = false;

      return mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, queryObj);
    } else {
      return mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, filterQuery);
    }
  },
  patchDay(req: Request, mongoDbOperations: MonogDbOperations, startTime: Date): Promise<any> {
    return new Promise<any>((resolve: (value?: any) => void, reject: (value?: any) => void) => {
      const theQueryObj = RequestProcessingHelpers.getFilerQuery(req);

      const propertyName = routesConfig.dayPropertyName;
      const propertyValue: any = DurationCalculator.getDayFrom(startTime);

      const patchPromise = mongoDbOperations.patch(propertyName, propertyValue, routesConfig.timEntriesCollectionName, theQueryObj);
      patchPromise.then(resolve);
      patchPromise.catch(reject);
    });
  },
  patchStop(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    // stop operation
    const theQueryObj = RequestProcessingHelpers.getFilerQuery(req);

    const propertyName = routesConfig.endDateProperty;
    const endTimePropertyValue: any = new Date();

    const firstPatchPromise = mongoDbOperations.patch(propertyName, endTimePropertyValue, routesConfig.timEntriesCollectionName, theQueryObj);

    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      firstPatchPromise.then((resolvedValue: any) => {
        resolve(true);
      });
      firstPatchPromise.catch(() => {
        const errMsg = 'catch when trying to patch the endDate in a timeEntry:' + theQueryObj[body[routesConfig.httpPatchIdPropertyName]];
        console.error(errMsg);
        reject(errMsg);
      });
    });
  },
  patchTheDurationInTimeEntriesDocument(mongoDbOperations: MonogDbOperations, theSuccessfullyPatchDocumentsFromDB: ITimeEntryDocument[], req: Request): Promise<any> {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (!theSuccessfullyPatchDocumentsFromDB || theSuccessfullyPatchDocumentsFromDB.length === 0) {
        console.error('cannot write the duration because retrieval of document failed');
        console.error(JSON.stringify(theSuccessfullyPatchDocumentsFromDB, null, 4));
        resolve(false);
        return;
      }

      const singleDoc = theSuccessfullyPatchDocumentsFromDB[0];

      // DEBUGGING:
      // if (typeof singleDoc.startTime === 'string') {
      //     console.error('starTime is string and not date!');
      // }
      // if (typeof singleDoc.endTime === 'string') {
      //     console.error('endTime is string and  not date');
      // }

      const propertyName = routesConfig.durationProperty;
      const propertyValue = TimeManagement.timeEntryToDuration(singleDoc);

      // DEBUGGING:
      // console.error(JSON.stringify(propertyValue, null, 4));
      // console.error(JSON.stringify(singleDoc, null, 4));

      const theQueryObj = RequestProcessingHelpers.getFilerQuery(req);

      const patchPromiseForWritingTheDuration = mongoDbOperations.patch(propertyName, propertyValue, routesConfig.timEntriesCollectionName, theQueryObj);
      patchPromiseForWritingTheDuration.then(resolve);
      patchPromiseForWritingTheDuration.catch(resolve);
    });
  },
  patchDeletedInClient(req: Request, mongoDbOperations: MonogDbOperations, filterQuery?: FilterQuery<any>): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    let theQueryObj: any = {};
    if (!theQueryObj) {
      const idPropertyName = body[routesConfig.httpPatchIdPropertyName];
      const timeEntryId = body[routesConfig.httpPatchIdPropertyValue];
      // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
      theQueryObj[idPropertyName] = timeEntryId;
    } else {
      theQueryObj = filterQuery;
    }

    const propertyName = routesConfig.isDeletedInClientProperty;
    const propertyValue = true;

    return mongoDbOperations.patch(propertyName, propertyValue, routesConfig.timEntriesCollectionName, theQueryObj);
  },
  getDurationSumDays(req: Request, mongoDbOperations: MonogDbOperations, isDisabledProperty: string) {
    const theQueryObj: FilterQuery<any> = {};
    theQueryObj[isDisabledProperty] = false;

    const promise = mongoDbOperations.getFiltered(routesConfig.timEntriesCollectionName, theQueryObj);
    return promise;
  },
  getBooking(bookingId: string, mongoDbOperations: MonogDbOperations) {
    const theQueryObj: FilterQuery<any> = {};
    theQueryObj[routesConfig.bookingDeclarationBookingDeclarationIdProperty] = bookingId;

    // DEBUGGING:
    // console.log(JSON.stringify(theQueryObj, null, 4));

    const promise = mongoDbOperations.getFiltered(routesConfig.bookingDeclarationsCollectionName, theQueryObj);
    return promise;
  },
};
