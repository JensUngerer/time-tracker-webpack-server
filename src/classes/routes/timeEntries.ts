import express, { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { FilterQuery } from 'mongodb';

import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { App } from '../../app';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import timeEntriesController from './../controllers/timeEntriesController';
import { RequestProcessingHelpers } from './../helpers/requestProcessingHelpers';
import { UrlHelpers } from './../helpers/urlHelpers';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { CalculateDurationsByInterval } from '../helpers/calculateDurationsByInterval';
import { ITimeSummary } from '../../../../common/typescript/iTimeSummary';
import { ISummarizedTasks } from './../../../../common/typescript/summarizedData';
import taskController from '../controllers/taskController';

const router = express.Router();

const getNonCommittedDaysHandler = async (req: Request, res: Response) => {
  const isRawBookingBased = UrlHelpers.getProperty(req.url, routesConfig.isBookingBasedPropertyName);
  const isBookingBased = JSON.parse(isRawBookingBased as string);
  let isDisabledProperty;
  if (isBookingBased) {
    isDisabledProperty = routesConfig.isDeletedInClientProperty;
  } else {
    isDisabledProperty = routesConfig.isDisabledInCommit;
  }

  const response = await timeEntriesController.getNonCommittedDays(App.mongoDbOperations, isDisabledProperty);
  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getViaTaskId = async (req: Request, res: Response) => {
  const taskId = UrlHelpers.getIdFromUlr(req.url);
  const filterQuery: FilterQuery<any> = {};
  filterQuery[routesConfig.endDateProperty] = null;
  filterQuery[routesConfig.taskIdPropertyAsForeignKey] = taskId;
  const response = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getTimeEntries = async (req: Request, res: Response) => {
  const response = await timeEntriesController.get(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

/**
 * 1)
 * HTTP-POST /NodeJS/timeEntries + '/' -> a timeEntries-document will be created
 *
 * @param req
 * @param res
 */
const postTimeEntries = async (req: Request, res: Response) => {
  const response = await timeEntriesController.post(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

/**
 * 4)
 * HTTP-PATCH /NodeJS/timeEntries + '/stop' -> a timeEntries-document will be updated
 *
 * a) update the current (single!) document with a new endTime-property
 * b) get the current (single!) document via its timeEntryId
 * c) calculate the entire duration based on current (single!) document
 * d) patch the endTime-property with that value
 *
 * @param req
 * @param res
 */
const patchTimeEntriesStop = async (req: Request, res: Response) => {
  // a)
  await timeEntriesController.patchStop(req, App.mongoDbOperations);

  // DEBUGGING:
  // console.log('patchedEndTime:' + patchedEndTime);

  // DEBUGGING:
  // console.log(JSON.stringify(patchDayResult, null, 4));

  // DEBUGGING:
  // console.error(JSON.stringify(response, null, 4));
  // console.error('writing duration in db');

  //b)
  const filterQuery = RequestProcessingHelpers.getFilerQuery(req);
  const theDocuments: ITimeEntryDocument[] = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);

  if (theDocuments &&
    theDocuments.length === 1) {
    const startTime = theDocuments[0].startTime;
    await timeEntriesController.patchDay(req, App.mongoDbOperations, startTime);
  } else {
    console.error('cannot patch day');
  }

  // DEBUGGING
  // console.error(JSON.stringify(theDocuments, null, 4));
  // console.error('calling the patch-method');

  // c) and d)
  await timeEntriesController.patchTheDurationInTimeEntriesDocument(App.mongoDbOperations, theDocuments, req);

  // DEBUGGING:
  // console.error(JSON.stringify(durationInDbResponse, null, 4));
  const theEndTimeStampPatchedDocuments: ITimeEntryDocument[] = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);
  if (!theEndTimeStampPatchedDocuments ||
    !theEndTimeStampPatchedDocuments.length ||
    theEndTimeStampPatchedDocuments.length !== 1) {
    console.error('no unique document retrieved for patching timeEntry.endTime');
    res.send('');
    return;
  }
  const thePatchedSingleDoc = theEndTimeStampPatchedDocuments[0];
  const finalPatchResult = await taskController.patchDurationSumMap(thePatchedSingleDoc, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(finalPatchResult);
  res.send(stringifiedResponse);
};

/**
 * 5)
 * HTTP-PATCH /NodeJS/timeEntries + '/delete' -> a timeEntries document is updated (and so marked as isDeletedInClient)
 * @param req
 * @param res
 */
const patchTimeEntriesDelete = async (req: Request, res: Response) => {
  const response = await timeEntriesController.patchDeletedInClient(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getDurationStr = async (req: Request, res: Response) => {
  const theId = UrlHelpers.getIdFromUlr(req.url);

  // DEBUGGING:
  // console.log(theId);

  const response = await timeEntriesController.getDurationStr(theId, App.mongoDbOperations);

  // DEBUGGING:
  // console.log(response);

  const stringifiedResponse = Serialization.serialize(response);

  // DEBUGGING:
  // console.log(stringifiedResponse);

  res.send(stringifiedResponse);
};

const deleteByTaskId = async (req: Request, res: Response) => {
  const theId = UrlHelpers.getIdFromUlr(req.url);

  // DEBUGGING:
  // console.error('theId:' + theId);

  try {
    const timeEntriesByTaskId: ITimeEntryDocument[] = await timeEntriesController.getTimeEntriesForTaskIds([theId], App.mongoDbOperations);

    // DEBUGGING:
    // console.error(JSON.stringify(timeEntriesByTaskId, null, 4));

    await new Promise((resolve: (value: any) => void) => {
      let theIndex = 0;
      const promiseThenLoop = () => {
        // DELETE
        // console.error(theIndex + '<' + timeEntriesByTaskId.length);

        if (theIndex < timeEntriesByTaskId.length) {
          const theQueryObj: FilterQuery<any> = {};
          const oneTimeEntry: ITimeEntryDocument = timeEntriesByTaskId[theIndex];
          theQueryObj[routesConfig.timeEntryIdProperty] = oneTimeEntry.timeEntryId;

          // patch each of this entries with isDeletedInClient = true
          const patchPromise = timeEntriesController.patchDeletedInClient(req, App.mongoDbOperations, theQueryObj);
          patchPromise.then(() => {
            theIndex++;
            promiseThenLoop();
          });
          patchPromise.catch(() => {
            theIndex++;
            promiseThenLoop();
          });
        } else {
          // DEBUGGING
          // console.error('finished');
          resolve(true);
        }
      };
      // initial call
      promiseThenLoop();
    });
    res.json(true);
  } catch (e) {
    console.error(e);
    res.json(null);
  }
};

// const getDurationSumDays = async (req: Request, res: Response) => {
//   const helper = new CalculateDurationsByDay();
//   const getBasis = (timeEntryDoc: ITimeEntryDocument): Promise<IBookingDeclaration | ITask> => {
//     return new Promise<IBookingDeclaration | ITask>((resolve: (value: IBookingDeclaration) => void, reject: (value?: any) => void) => {
//       const bookingsPromise = timeEntriesController.getBooking(timeEntryDoc._bookingDeclarationId, App.mongoDbOperations);
//       bookingsPromise.then((bookings: IBookingDeclaration[]) => {

//         if (!bookings || bookings.length !== 1) {
//           console.error('no or more than one booking-ids found');
//           console.error(JSON.stringify(timeEntryDoc, null, 4));
//           console.error(JSON.stringify(bookings, null, 4));
//           console.error('no or more than one booking-ids found');
//           reject(null);
//           return;
//         }
//         const booking = bookings[0];
//         resolve(booking);
//       });
//       bookingsPromise.catch(() => {
//         reject(null);
//       });
//     });
//   };
//   const getId = (basis: IBookingDeclaration | ITask) => {
//     return (basis as IBookingDeclaration).bookingDeclarationId;
//   };
//   helper.calculate(req, res, getBasis, getId, routesConfig.isDeletedInClientProperty);

//   // TODO: mark timeEntries as isDisabledInBooking = true
// };

// const getDurationSumsTasksHandler = async (req: Request, res: Response) => {
//   /**
//      * one entry in durationSumsTasks is for one specific day:
//      * on one day several durations are possible (lines in the table in the UI).
//      * So for one line (duration) the sum of (eventually several) time entries needs to be calculated.
//      */
//   // const durationSumsTasks: ITasksDurationSum[] =
//   // [
//   //     {
//   //         day: new Date,
//   //         durations: []
//   //     }
//   // ];
//   // res.json(durationSumsTasks);
//   const helper = new CalculateDurationsByDay();
//   const getBasis = (timeEntryDoc: ITimeEntryDocument): Promise<IBookingDeclaration | ITask> => {
//     return new Promise<IBookingDeclaration | ITask>((resolve: (value: ITask) => void, reject: (value?: any) => void) => {
//       const filterQuey: FilterQuery<any> = {};
//       filterQuey[routesConfig.taskIdProperty] = timeEntryDoc._taskId;
//       filterQuey[routesConfig.isDisabledProperty] = false;
//       const taskPromise = taskController.get(req, App.mongoDbOperations, filterQuey);
//       taskPromise.then((tasks: ITask[]) => {
//         if (!tasks || tasks.length === 0) {
//           console.error('no tasks found for taskId:' + timeEntryDoc._taskId);
//           reject(null);
//           return;
//         }

//         resolve(tasks[0]);
//       });
//       taskPromise.catch(() => {
//         reject(null);
//       });
//     });
//   };
//   const getId = (basis: IBookingDeclaration | ITask) => {
//     if ((basis as IBookingDeclaration).bookingDeclarationId) {
//       return (basis as IBookingDeclaration).bookingDeclarationId;
//     } else if ((basis as ITask).taskId) {
//       return (basis as ITask).taskId;
//     }
//     console.error('no id found for basis:' + JSON.stringify(basis, null, 4));
//     return '';
//   };
//   helper.calculate(req, res, getBasis, getId, routesConfig.isDisabledInCommit);

//   // TODO: mark timeEntries as isDisabledInCommit = true
// };

const getRunningTimeEntryHandler = async (req: Request, res: Response) => {
  const runningTimeEntries: ITimeEntryDocument[] = await timeEntriesController.getRunning(App.mongoDbOperations);
  if (runningTimeEntries.length === 0) {
    res.send(Serialization.serialize(null));
    return;
  }
  if (runningTimeEntries.length > 1) {
    console.error('more than one running time-entry found');
  }

  const stringifiedResponse = Serialization.serialize(runningTimeEntries[0]);
  res.send(stringifiedResponse);
};

const getViaIdHandler = async (req: Request, res: Response) => {
  const timeEntriesId = UrlHelpers.getIdFromUlr(req.url);
  const filterQuery: FilterQuery<any> = {};
  filterQuery[routesConfig.timeEntryIdProperty] = timeEntriesId;
  const timeEntriesPromise = timeEntriesController.get(req, App.mongoDbOperations, filterQuery);
  const timeEntries: ITimeEntryDocument[] = await timeEntriesPromise;

  if (!timeEntries || timeEntries.length !== 1) {
    console.error('no or more than one time entry found');
    res.send(null);
    return;
  }

  const stringifiedResponse = Serialization.serialize(timeEntries[0]);
  res.send(stringifiedResponse);
};

const getStatisticsHandler = async (req: Request, res: Response) => {
  const isRawBookingBased = UrlHelpers.getProperty(req.url, routesConfig.isBookingBasedPropertyName);
  const isBookingBased = JSON.parse(isRawBookingBased as string);
  const isTakenCareIsDisabledRaw = UrlHelpers.getProperty(req.url, routesConfig.isTakenCareIsDisabledPropertyName);
  const isTakenCareIsDisabled = JSON.parse(isTakenCareIsDisabledRaw as string);
  // DEBUGGING:
  // console.log(isBookingBased);

  let groupCategory = UrlHelpers.getProperty(req.url, routesConfig.groupCategoryPropertyName);
  if (groupCategory === 'null') {
    groupCategory = null;
  }
  // DEBUGGING:
  // console.log(groupCategory);

  const startTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.startTimeProperty);
  const endTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.endDateProperty);
  if (!startTimeUtc || !endTimeUtc) {
    console.error('no time stamps found in url');
    res.send('no time stamps in ulr');
    return;
  }

  // //  DEBUGGING
  // console.log(groupCategory);
  // console.log(startTimeUtc.toUTCString());
  // console.log(endTimeUtc.toUTCString());
  try {
    // const timeEntries = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTimeUtc, endTimeUtc);

    // const serialized = Serialization.serialize(timeEntries);
    // res.send(serialized);
    // const returnValueByCategoryMap: { [category: string]: any[]} = {};

    // console.log('summeries begin');
    let summaries;
    if (!isTakenCareIsDisabled) {
      summaries = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased);
    } else {
      if (isBookingBased) {
        summaries = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased, routesConfig.isDeletedInClientProperty, false);
      } else {
        summaries = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased, routesConfig.isDisabledInCommit, false);
      }
    }
    if (!summaries) {
      // console.error('no summaries');
      res.send('');
      return;
    }
    // console.log(JSON.stringify(summaries, null, 4));
    // console.log('summaries end');
    // for (const key in summaries) {
    //   if (Object.prototype.hasOwnProperty.call(summaries, key)) {
    //     const element: ITimeSummary = summaries[key];

    //   }
    // }
    if (groupCategory !== null) {
      // console.log('begin oneSummary for:' + groupCategory);
      // console.log(JSON.stringify(summaries, null, 4));
      const oneSummary: ITimeSummary = summaries[groupCategory];
      if (!oneSummary) {
        console.error('there is no summary for:' + groupCategory);
        res.send('');
        return;
      }
      const summaryValues = Object.values(oneSummary);
      const summaryByTaskCategories: ISummarizedTasks[] = await CalculateDurationsByInterval.convertTimeSummaryToSummarizedTasks(summaryValues, App.mongoDbOperations);

      const serialized = Serialization.serialize(summaryByTaskCategories);
      res.send(serialized);
      // console.log('end oneSummary for:' + groupCategory);
    } else {
      // DEBUGGING
      // console.log('groupCategory from url is null');
      if (isBookingBased) {
        // const summaryByTasksIndependentOfCategory: ISummarizedTasks[] = await CalculateDurationsByInterval.aggregateSummarizedTasks(summaries, App.mongoDbOperations);
        // const serialized = Serialization.serialize(summaryByTasksIndependentOfCategory);
        const serialized = Serialization.serialize(summaries);
        res.send(serialized);
        return;
      } else {
        console.error('category is null but isBookingBased:' + isBookingBased);
        console.error('returning');
        res.send('');
        return;
      }
    }

    // DEBUGGING:
    // console.log(JSON.stringify(summeriesByCategoryMap, null, 4));

    // const tasksByCategoryMap: {[category: string]: ITasksDocument[]} = {};
    // for (const category in summeriesByCategoryMap) {
    //     if (Object.prototype.hasOwnProperty.call(summeriesByCategoryMap, category)) {
    //         // if (!tasksByCategoryMap[category]) {
    //         //     tasksByCategoryMap[category] = [];
    //         // }
    //         // if (!returnValueByCategoryMap[category]) {
    //         //     returnValueByCategoryMap[category] = [];
    //         // }
    //         // const oneSummaryByCategory = summeriesByCategoryMap[category];
    //         // for (const oneTaskId of oneSummaryByCategory.taskIds) {
    //         //     // const correspondingTask = await taskController.get()
    //         //     const queryObj: FilterQuery<any> = {};
    //         //     queryObj[routesConfig.taskIdProperty] = oneTaskId;
    //         //     const correspondingTasks: ITasksDocument[] = await App.mongoDbOperations.getFiltered(routesConfig.tasksCollectionName, queryObj);
    //         //     if (!correspondingTasks || !correspondingTasks.length || correspondingTasks.length > 1) {
    //         //         console.error('more than one taks found! for:' + oneTaskId);
    //         //         continue;
    //         //     }
    //         //     // there should be only one single document!
    //         //     const FIRST_AND_ONLY_DOCUMENT_INDEX = 0;
    //         //     tasksByCategoryMap[category].push(correspondingTasks[FIRST_AND_ONLY_DOCUMENT_INDEX]);
    //         // }

    //         returnValueByCategoryMap[category].push({
    //             summeries: summeriesByCategoryMap[category],
    //             // tasks: tasksByCategoryMap[category]
    //         });
    //     }
    // }

    // DEBUGGING:
    // console.log(JSON.stringify(returnValueByCategoryMap, null, 4))

    // const serialized = Serialization.serialize(summaries);
    // res.send(serialized);
  } catch (e) {
    console.error('timeEntries.getStatisticsHandler error:');
    console.error(JSON.stringify(e, null, 4));
    res.send(JSON.stringify(e, null, 4));
  }
};

const rootRoute = router.route('/');
rootRoute.get(asyncHandler(getTimeEntries));
rootRoute.post(asyncHandler(postTimeEntries));

const stopRoute = router.route(routesConfig.timeEntriesStopPathSuffix);
stopRoute.patch(asyncHandler(patchTimeEntriesStop));

const deleteRoute = router.route(routesConfig.timeEntriesDeletePathSuffix);
deleteRoute.patch(asyncHandler(patchTimeEntriesDelete));

const durationRoute = router.route(routesConfig.timeEntriesDurationSuffix + '/*');
durationRoute.get(asyncHandler(getDurationStr));

// const durationSumRoute = router.route(routesConfig.timeEntriesDurationSumSuffix);
// durationSumRoute.get(asyncHandler(getDurationSumDays));

const deleteByTaskIdRoute = router.route(routesConfig.deleteTimeEntryByTaskIdSuffix + '/*');
deleteByTaskIdRoute.delete(asyncHandler(deleteByTaskId));

const getViaTaskIdRoute = router.route(routesConfig.timeEntriesViaTaskIdSuffix + '/*');
getViaTaskIdRoute.get(asyncHandler(getViaTaskId));

// const getDurationSumsTasks = router.route(routesConfig.timeEntriesDurationSumTasksSuffix);
// getDurationSumsTasks.get(asyncHandler(getDurationSumsTasksHandler));

const getRunning = router.route(routesConfig.timeEntriesRunningSuffix);
getRunning.get(asyncHandler(getRunningTimeEntryHandler));

const getStatistics = router.route(routesConfig.timeEntriesStatisticsSufffix + '/*');
getStatistics.get(asyncHandler(getStatisticsHandler));

const getNonCommittedDays = router.route(routesConfig.nonCommittedDaysSuffix);
getNonCommittedDays.get(asyncHandler(getNonCommittedDaysHandler));

const getViaId = router.route('/*');
getViaId.get(asyncHandler(getViaIdHandler));

export default router;
