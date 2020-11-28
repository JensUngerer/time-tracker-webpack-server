import { ISummarizedTimeEntries } from '../../../../common/typescript/iSummarizedTimeEntries';
import { IBookingDeclarationsDocument } from '../../../../common/typescript/mongoDB/iBookingDeclarationsDocument';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { ISummarizedTasks, ITaskLine } from '../../../../common/typescript/summarizedData';
import App from '../../app';
import taskController from '../controllers/taskController';
import timeEntriesController from '../controllers/timeEntriesController';
import { ITimeSummary } from './../../../../common/typescript/iTimeSummary';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { MonogDbOperations } from './mongoDbOperations';
import { IStatistic } from './../../../../common/typescript/iStatistic';
import { DurationFormatter } from '../../../../common/typescript/helpers/durationFormatter';

export class CalculateDurationsByInterval {
  static async aggregateSummarizedTasks(input: ITimeEntryDocument[], mongoDbOperations: MonogDbOperations): Promise<ISummarizedTasks[]> {
    return [];
  }
  static async convertTimeSummaryToSummarizedTasks(input: ISummarizedTimeEntries[], mongoDbOperations: MonogDbOperations) {
    const output: ISummarizedTasks[] = [];
    for (let theOuterIndex = 0; theOuterIndex < input.length; theOuterIndex++) {
      const tasks = [];
      const oneParsedStatistics = input[theOuterIndex];
      const _timeEntryIds = oneParsedStatistics._timeEntryIds;
      const taskIds = Object.keys(oneParsedStatistics.durationSumByTaskId);

      if (!taskIds || !taskIds.length) {
        console.error('there are no taskIds');
        continue;
      }

      for (let theInnerIndex = 0; theInnerIndex < taskIds.length; theInnerIndex++) {
        const oneTaskId = taskIds[theInnerIndex];
        const oneParsedTask: ITasksDocument[] = await taskController.getViaTaskId(oneTaskId, mongoDbOperations);
        if (oneParsedTask && oneParsedTask.length === 1) {
          tasks.push(oneParsedTask[0]);
        } else {
          console.error('No task received');
        }
      }

      const category = oneParsedStatistics.taskCategory;
      const lines: ITaskLine[] = [];
      for (let index = 0; index < tasks.length; index++) {
        const oneTaskToMerge = tasks[index];
        const correspondingTimeEntries: ITimeEntryDocument[] = await timeEntriesController.getTimeEntriesForTaskIds([oneTaskToMerge.taskId], App.mongoDbOperations, routesConfig.isDisabledInCommit);
        const correspondingTimeEntryIds: string[] = correspondingTimeEntries.map(oneTimeEntry => oneTimeEntry.timeEntryId);
        const oneTaskToMergeId = oneTaskToMerge.taskId;
        const baseUrl = ''; // is being filled in client?
        const oneLine: ITaskLine = {
          _taskId: oneTaskToMerge.taskId,
          _timeEntryIds: correspondingTimeEntryIds,
          taskNumberUrl: baseUrl ? baseUrl + '/' + oneTaskToMerge.number : '',
          taskNumber: oneTaskToMerge.number,
          taskDescription: oneTaskToMerge.name,
          durationInHours: oneParsedStatistics.durationSumByTaskId[oneTaskToMergeId],
          durationFraction: oneParsedStatistics.durationSumFractionByTaskId[oneTaskToMergeId],
        };
        lines.push(oneLine);
      }
      const durationSum = oneParsedStatistics.overallDurationSum;
      const durationFraction = oneParsedStatistics.overallDurationSumFraction;

      output.push({
        _timeEntryIds,
        category,
        lines,
        durationSum,
        durationFraction,
      });

    }
    return output;
  }

  static async getTimeEntriesByTaskCategory(timeEntryDocsByInterval: ITimeEntryDocument[], groupCategorySelection: string | null) {
    const timeEntriesByCategory: { [category: string]: ITimeEntryDocument[] } = {};
    for (const oneTimeEntryDoc of timeEntryDocsByInterval) {
      const oneTaskId = oneTimeEntryDoc._taskId;

      const correspondingTasks: ITasksDocument[] = await taskController.getViaTaskId(oneTaskId, App.mongoDbOperations);
      if (!correspondingTasks ||
        !correspondingTasks.length ||
        correspondingTasks.length !== 1) {
        console.error('cannot get task to read data from:');
        continue;
      }
      const singleCorrespondingTask = correspondingTasks[0];
      const groupCategory = singleCorrespondingTask.groupCategory;
      if (groupCategory !== groupCategorySelection) {
        // DEBUGGING:
        // console.log('skipping time entry as:' + groupCategory + '!==' + groupCategorySelection);
        continue;
      }

      const taskCategory = singleCorrespondingTask.taskCategory;
      if (!timeEntriesByCategory[taskCategory]) {
        timeEntriesByCategory[taskCategory] = [];
      }
      timeEntriesByCategory[taskCategory].push(oneTimeEntryDoc);
    }
    return timeEntriesByCategory;
  }

  private static async getByBookingDeclaration(timeEntryDocsByInterval: ITimeEntryDocument[]) {
    const outputBuffer: IStatistic[] = [];

    if (!timeEntryDocsByInterval ||
      !timeEntryDocsByInterval.length) {
      console.error('cannot use empty time entries');
      return;
    }
    const mapByBookingDeclarationId: { [bookingDeclarationId: string]: ITimeEntryDocument[] } = {};

    for (const oneTimeEntry of timeEntryDocsByInterval) {
      const bookingDeclarationId = oneTimeEntry._bookingDeclarationId;

      if (!mapByBookingDeclarationId[bookingDeclarationId]) {
        mapByBookingDeclarationId[bookingDeclarationId] = [];
      }
      mapByBookingDeclarationId[bookingDeclarationId].push(oneTimeEntry);
    }

    let overallDurationSumInMilliseconds = 0.0;
    for (const _bookingDeclarationId in mapByBookingDeclarationId) {
      if (Object.prototype.hasOwnProperty.call(mapByBookingDeclarationId, _bookingDeclarationId)) {
        const oneBufferOfTimeEntries = mapByBookingDeclarationId[_bookingDeclarationId];
        if (!oneBufferOfTimeEntries ||
          !oneBufferOfTimeEntries.length) {
          console.error('empty buffer -> continue');
          continue;
        }
        let durationInMilliseconds = 0;
        for (const oneTimeEntry of oneBufferOfTimeEntries) {
          durationInMilliseconds += oneTimeEntry.durationInMilliseconds;
          overallDurationSumInMilliseconds += oneTimeEntry.durationInMilliseconds;
        }

        const bookingsPromise = timeEntriesController.getBooking(_bookingDeclarationId, App.mongoDbOperations);
        const bookingDocs = await bookingsPromise;
        if (!bookingDocs ||
          !bookingDocs.length ||
          bookingDocs.length > 1) {
          console.error('no corresponding booking found -> continue');
          continue;
        }
        const oneBookingDoc: IBookingDeclarationsDocument = bookingDocs[0];
        const code = oneBookingDoc.code;
        const description = oneBookingDoc.description;
        const durationInHours = durationInMilliseconds / DurationFormatter.hoursInMilliseconds;

        outputBuffer.push({
          description: description,
          identifier: code,
          identifierUrl: '',
          durationFraction: 0.0,
          durationInHours: durationInHours,
          uniqueId: _bookingDeclarationId,
          _timeEntryIds: timeEntryDocsByInterval.map(tE => tE.timeEntryId),
        });
      }
    }
    const overallDurationInHours = overallDurationSumInMilliseconds / DurationFormatter.hoursInMilliseconds;
    const statistics: IStatistic[] = [];
    outputBuffer.forEach((oneTemporaryBufferEntry) => {
      statistics.push({
        description: oneTemporaryBufferEntry.description,
        durationFraction: oneTemporaryBufferEntry.durationInHours / overallDurationInHours,
        durationInHours: oneTemporaryBufferEntry.durationInHours,
        identifier: oneTemporaryBufferEntry.identifier,
        identifierUrl: oneTemporaryBufferEntry.identifierUrl,
        uniqueId: oneTemporaryBufferEntry.uniqueId,
        _timeEntryIds: oneTemporaryBufferEntry._timeEntryIds,
      });
    });

    return statistics;
  }

  private static async getByGroupCategory(timeEntryDocsByInterval: ITimeEntryDocument[], groupCategorySelection: string | null): Promise<ITimeSummary | null> {
    const durationSumByTaskIdMap: { [category: string]: { [taskId: string]: number } } = {};
    const durationSumFractionByTaskIdMap: { [category: string]: { [taskId: string]: number } } = {};
    const oneTimeEntryBufferByGroupCategory = await this.getTimeEntriesByTaskCategory(timeEntryDocsByInterval, groupCategorySelection);

    // DEBUGGING:
    // console.log(JSON.stringify(timeEntriesByCategory, null, 4));

    let durationSumOverAllCategories = 0.0;
    const timeSummaryMap: ITimeSummary = {};
    if (!groupCategorySelection) {
      console.error('cannot get time entries by group category as groupCategory:' + groupCategorySelection);
      return null;
    }

    // DEBUGGING:
    // console.log(JSON.stringify(oneTimeEntryBufferByGroupCategory, null, 4));

    for (const taskCategory in oneTimeEntryBufferByGroupCategory) {
      if (!durationSumByTaskIdMap[taskCategory]) {
        durationSumByTaskIdMap[taskCategory] = {};
      }
      if (!durationSumFractionByTaskIdMap[taskCategory]) {
        durationSumFractionByTaskIdMap[taskCategory] = {};
      }
      if (Object.prototype.hasOwnProperty.call(oneTimeEntryBufferByGroupCategory, taskCategory)) {
        const timeEntriesOfOneCategory: ITimeEntryDocument[] = oneTimeEntryBufferByGroupCategory[taskCategory];

        // DEBUGGING:
        // console.log(JSON.stringify(timeEntriesOfOneCategory));

        const oneTimeEntryIds: string[] = [];
        let oneOverallSum = 0.0;
        for (const oneTimeEntry of timeEntriesOfOneCategory) {
          const oneDuration = oneTimeEntry.durationInMilliseconds;
          const taskId = oneTimeEntry._taskId;

          // necessary: the timeEntries could be disabled by either booking or commit...
          if (!durationSumByTaskIdMap[taskCategory][taskId]) {
            durationSumByTaskIdMap[taskCategory][taskId] = 0;
          }
          durationSumByTaskIdMap[taskCategory][taskId] += oneDuration;

          oneOverallSum += oneDuration;
          oneTimeEntryIds.push(oneTimeEntry.timeEntryId);
        }

        timeSummaryMap[taskCategory] = {
          taskCategory: taskCategory,
          overallDurationSum: oneOverallSum,
          overallDurationSumFraction: 0.0,
          _timeEntryIds: oneTimeEntryIds,
          durationSumByTaskId: durationSumByTaskIdMap[taskCategory],
          durationSumFractionByTaskId: durationSumFractionByTaskIdMap[taskCategory],
        };
        durationSumOverAllCategories += oneOverallSum;
      }
    }

    for (const taskCategory in durationSumByTaskIdMap) {
      if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap, taskCategory)) {
        for (const taskId in durationSumByTaskIdMap[taskCategory]) {
          if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap[taskCategory], taskId)) {
            const absolutedurationSumByTaskId = durationSumByTaskIdMap[taskCategory][taskId];
            durationSumFractionByTaskIdMap[taskCategory][taskId] = absolutedurationSumByTaskId / durationSumOverAllCategories;

            // convert to hours:
            durationSumByTaskIdMap[taskCategory][taskId] = absolutedurationSumByTaskId / DurationFormatter.hoursInMilliseconds;
          }
        }
      }
    }

    // DEBUGGING:
    // console.log(JSON.stringify(categoryBufferMap, null, 4));
    for (const oneTaskCat in timeSummaryMap) {
      if (Object.prototype.hasOwnProperty.call(timeSummaryMap, oneTaskCat)) {
        const sumEntry = timeSummaryMap[oneTaskCat];
        sumEntry.overallDurationSumFraction = sumEntry.overallDurationSum / durationSumOverAllCategories;

        // convert to hours:
        timeSummaryMap[oneTaskCat].overallDurationSum = timeSummaryMap[oneTaskCat].overallDurationSum / DurationFormatter.hoursInMilliseconds;
      }
    }

    // DEBUGGING:
    // console.log(JSON.stringify(categoryBufferMap, null, 4));

    return timeSummaryMap;
  }

  static async calculate(startTime: Date, endTime: Date, isBookingBased: boolean, groupCategory: string | null, isDisabledPropertyName?: string, isDisabledPropertyValue?: boolean) {
    try {
      // DEBUGGING:
      // console.log(startTime.toUTCString());
      // console.log(endTime.toUTCString());

      const timeEntryDocsByInterval: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTime, endTime, isDisabledPropertyName, isDisabledPropertyValue);
      if (!timeEntryDocsByInterval || !timeEntryDocsByInterval.length) {
        console.error('no time entries to calculate duration from');
        return null;
      }
      if (!isBookingBased) {
        return CalculateDurationsByInterval.getByGroupCategory(timeEntryDocsByInterval, groupCategory);
      } else {
        return CalculateDurationsByInterval.getByBookingDeclaration(timeEntryDocsByInterval);
      }
    }
    catch (e) {
      console.error('outer exception:');
      console.error(e);
      console.error(JSON.stringify(e, null, 4));
      return e;
    }
  }

  static async getTimeInterval() {

  }
}
