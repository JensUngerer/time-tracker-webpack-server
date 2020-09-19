import express, { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { FilterQuery } from 'mongodb';

import { IBookingDeclaration } from '../../../../common/typescript/iBookingDeclaration';
import { ITask } from '../../../../common/typescript/iTask';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { App } from '../../app';
import { CalculateDurationsByDay } from '../helpers/calculateDurationsByDay';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import taskController from './../controllers/taskController';
import timeEntriesController from './../controllers/timeEntriesController';
import { RequestProcessingHelpers } from './../helpers/requestProcessingHelpers';
import { UrlHelpers } from './../helpers/urlHelpers';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { CalculateDurationsByIntervall } from '../helpers/calculateDurationsByInterval';

const router = express.Router();

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
    const durationInDbResponse = await timeEntriesController.patchTheDurationInTimeEntriesDocument(App.mongoDbOperations, theDocuments, req);

    // DEBUGGING:
    // console.error(JSON.stringify(durationInDbResponse, null, 4));

    const stringifiedResponse = Serialization.serialize(durationInDbResponse);
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

/**
 * 2)
 * HTTP-POST /NodeJS/timeEntries + '/pause' -> a timeEntries document is updated with a new IPause object in the pauses-array
 * @param req 
 * @param res 
 */
const postPauseTimeEntry = async (req: Request, res: Response) => {
    const response = await timeEntriesController.postPause(req, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

/**
 * 3)
 * HTTP-PATCH /NodeJS/timeEntries + '/pause' -> the timeEntries document will be updated via a overwriting with a 'patched' pauses-array
 * 
 * a) the current (single!) document is retrieved from the db
 * b) the endTime property is set in this object (of type IPause) -> and again written to the DB!?!
 * c) so the currently updated document is retrieved from the db (again!)
 * d) calculate the duration of the (last!?!) entry ?
 * e) overwrite the entire pauses array with a so 'patched' pauses array
 * 
 * 
 * @param req 
 * @param res 
 */
const patchPauseTimeEntry = async (req: Request, res: Response) => {
    // a)
    const filterQuery = RequestProcessingHelpers.getFilerQuery(req);
    const storedDocuments = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);

    // DEBUGGING:
    // console.error(JSON.stringify(storedDocuments, null, 4));
    // console.error('the storedDocuments');

    // b)
    await timeEntriesController.patchPause(req, App.mongoDbOperations, storedDocuments);

    // // DEBUGGING:
    // console.error(JSON.stringify(response, null, 4));
    // console.error('calling doSomething');

    // c)
    const anotherTimeTheStoredDocuments = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);


    // DEBUGGING:
    // console.error(JSON.stringify(anotherTimeTheStoredDocuments, null, 4));
    // console.error('calling do something');

    // d) and e)
    const doSomethingResponse = await timeEntriesController.calculatePauseAndRewriteArrayToDocument(App.mongoDbOperations, filterQuery, anotherTimeTheStoredDocuments);

    // DEBUGGING:
    // console.error('doSomethingResponse');
    // console.error(JSON.stringify(doSomethingResponse, null, 4));

    const stringifiedResponse = Serialization.serialize(doSomethingResponse);
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

const getDurationSumDays = async (req: Request, res: Response) => {
    const helper = new CalculateDurationsByDay();
    const getBasis = (timeEntryDoc: ITimeEntryDocument): Promise<IBookingDeclaration | ITask> => {
        return new Promise<IBookingDeclaration | ITask>((resolve: (value: IBookingDeclaration) => void, reject: (value?: any) => void) => {
            const bookingsPromise = timeEntriesController.getBooking(timeEntryDoc._bookingDeclarationId, App.mongoDbOperations);
            bookingsPromise.then((bookings: IBookingDeclaration[]) => {


                if (!bookings || bookings.length !== 1) {
                    console.error('no or more than one booking-ids found');
                    console.error(JSON.stringify(timeEntryDoc, null, 4));
                    console.error(JSON.stringify(bookings, null, 4));
                    console.error('no or more than one booking-ids found');
                    reject(null);
                    return;
                }
                const booking = bookings[0];
                resolve(booking);
            });
            bookingsPromise.catch(() => {
                reject(null);
            });
        });
    };
    const getId = (basis: IBookingDeclaration | ITask) => {
        return (basis as IBookingDeclaration).bookingDeclarationId;
    };
    helper.calculate(req, res, getBasis, getId, routesConfig.isDeletedInClientProperty);

    // TODO: mark timeEntries as isDisabledInBooking = true
};

const getDurationSumsTasksHandler = async (req: Request, res: Response) => {
    /**
     * one entry in durationSumsTasks is for one specific day:
     * on one day several durations are possible (lines in the table in the UI).
     * So for one line (duration) the sum of (eventually several) time entries needs to be calculated.
     */
    // const durationSumsTasks: ITasksDurationSum[] = 
    // [
    //     {
    //         day: new Date,
    //         durations: []
    //     }
    // ];
    // res.json(durationSumsTasks);
    const helper = new CalculateDurationsByDay();
    const getBasis = (timeEntryDoc: ITimeEntryDocument): Promise<IBookingDeclaration | ITask> => {
        return new Promise<IBookingDeclaration | ITask>((resolve: (value: ITask) => void, reject: (value?: any) => void) => {
            const filterQuey: FilterQuery<any> = {};
            filterQuey[routesConfig.taskIdProperty] = timeEntryDoc._taskId;
            filterQuey[routesConfig.isDisabledProperty] = false;
            const taskPromise = taskController.get(req, App.mongoDbOperations, filterQuey);
            taskPromise.then((tasks: ITask[]) => {
                if (!tasks || tasks.length === 0) {
                    console.error('no tasks found for taskId:' + timeEntryDoc._taskId);
                    reject(null);
                    return;
                }

                resolve(tasks[0]);
            });
            taskPromise.catch(() => {
                reject(null);
            });
        });
    };
    const getId = (basis: IBookingDeclaration | ITask) => {
        if ((basis as IBookingDeclaration).bookingDeclarationId) {
            return (basis as IBookingDeclaration).bookingDeclarationId;
        } else if ((basis as ITask).taskId) {
            return (basis as ITask).taskId;
        }
        console.error('no id found for basis:' + JSON.stringify(basis, null, 4));
        return '';
    };
    helper.calculate(req, res, getBasis, getId, routesConfig.isDisabledInCommit);

    // TODO: mark timeEntries as isDisabledInCommit = true
};

const getRunningTimeEntryHandler = async (req: Request, res: Response) => {
    const runningTimeEntries : ITimeEntryDocument[] = await timeEntriesController.getRunning(App.mongoDbOperations);
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

// const getViaIdHandler = async (req: Request, res: Response) => {
//     const timeEntriesId = UrlHelpers.getIdFromUlr(req.url);
//     const filterQuery: FilterQuery<any> = {};
//     filterQuery[routesConfig.timeEntryIdProperty] = timeEntriesId;
//     const timeEntriesPromise = timeEntriesController.get(req, App.mongoDbOperations, filterQuery);
//     const timeEntries: ITimeEntryDocument[] = await timeEntriesPromise;

//     if (!timeEntries || timeEntries.length !== 1)  {
//         console.error('no or more than one time entry found');
//         res.send(null);
//         return;
//     }

//     const stringifiedResponse = Serialization.serialize(timeEntries[0]);
//     res.send(stringifiedResponse);
// };

const getStatisticsHandler = async (req: Request, res: Response) => {
    const startTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.startTimeProperty);
    const endTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.endDateProperty);
    if (!startTimeUtc || !endTimeUtc) {
        console.error('no time stamps found in url'); 
        return;
    }

    //  DEBUGGING
    // console.log(startTimeUtc.toUTCString());
    // console.log(endTimeUtc.toUTCString());
    try {
        // const timeEntries = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTimeUtc, endTimeUtc);

        // const serialized = Serialization.serialize(timeEntries);
        // res.send(serialized);
        const result = await CalculateDurationsByIntervall.calculate(startTimeUtc, endTimeUtc);
        const serialized = Serialization.serialize(result);
        res.send(serialized);
    } catch (e) {
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

const pauseRoute = router.route(routesConfig.timeEntryPausePathSuffix);
pauseRoute.post(asyncHandler(postPauseTimeEntry));
pauseRoute.patch(asyncHandler(patchPauseTimeEntry));

const durationRoute = router.route(routesConfig.timeEntriesDurationSuffix + '/*');
durationRoute.get(asyncHandler(getDurationStr));

const durationSumRoute = router.route(routesConfig.timeEntriesDurationSumSuffix);
durationSumRoute.get(asyncHandler(getDurationSumDays));

const deleteByTaskIdRoute = router.route(routesConfig.deleteTimeEntryByTaskIdSuffix + '/*');
deleteByTaskIdRoute.delete(asyncHandler(deleteByTaskId));

const getViaTaskIdRoute = router.route(routesConfig.timeEntriesViaTaskIdSuffix + '/*');
getViaTaskIdRoute.get(asyncHandler(getViaTaskId));

const getDurationSumsTasks = router.route(routesConfig.timeEntriesDurationSumTasksSuffix);
getDurationSumsTasks.get(asyncHandler(getDurationSumsTasksHandler))

const getRunning = router.route(routesConfig.timeEntriesRunningSuffix);
getRunning.get(asyncHandler(getRunningTimeEntryHandler));

// timeEntriesStatisticsSufffix
const getStatistics = router.route(routesConfig.timeEntriesStatisticsSufffix + '/*');
getStatistics.get(asyncHandler(getStatisticsHandler));

// TODO: FIXME introduce id suffix
// const getViaId = router.route('/*');
// getViaId.get(asyncHandler(getViaIdHandler));

export default router;
