import { ISummarizedTimeEntries } from '../../../../common/typescript/iSummarizedTimeEntries';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { ISummarizedTasks, ITaskLine } from '../../../../common/typescript/summarizedData';
import App from '../../app';
import taskController from '../controllers/taskController';
import timeEntriesController from '../controllers/timeEntriesController';
import { ITimeSummaryByGroupCategory } from './../../../../common/typescript/iTimeSummary';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { MonogDbOperations } from './mongoDbOperations';

export class CalculateDurationsByIntervall {
  static async convertTimeSummaryToSummarizedTasks(input: ISummarizedTimeEntries[], mongoDbOperations: MonogDbOperations) {
    const output: ISummarizedTasks[] = [];
    const tasks = [];
    for (let theOuterIndex = 0; theOuterIndex < input.length; theOuterIndex++) {
      const oneParsedStatistics = input[theOuterIndex];
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
      tasks.forEach((oneTaskToMerge: ITasksDocument) => {
        const oneTaskToMergeId = oneTaskToMerge.taskId;
        const baseUrl = ''; // TODO: read config file! //this.configurationService.configuration.codeOrNumberBaseUrl;
        const oneLine: ITaskLine = {
          taskNumberUrl: baseUrl ? baseUrl + '/' + oneTaskToMerge.number : '',
          taskNumber: oneTaskToMerge.number,
          taskDescription: oneTaskToMerge.name,
          durationInHours: oneParsedStatistics.durationSumByTaskId[oneTaskToMergeId],
          durationFraction: oneParsedStatistics.durationSumFractionByTaskId[oneTaskToMergeId],
        };
        lines.push(oneLine);
      });
      const durationSum = oneParsedStatistics.overallDurationSum;
      const durationFraction = oneParsedStatistics.overallDurationSumFraction;

      output.push({
        category,
        lines,
        durationSum,
        durationFraction,
      });

    }
    return output;
  }

  static async getTimeEntriesByTaskCategory(timeEntryDocsByInterval: ITimeEntryDocument[]) {
    return new Promise<{ [groupCategory: string]: { [category: string]: ITimeEntryDocument[] } }>((resolve: (value?: { [groupCategory: string]: { [category: string]: ITimeEntryDocument[] } }) => void) => {
      const timeEntriesByCategory: { [groupCategory: string]: { [category: string]: ITimeEntryDocument[] } } = {};

      let indexInTimeEntries = 0;
      const loop = async () => {
        if (indexInTimeEntries >= timeEntryDocsByInterval.length) {
          resolve(timeEntriesByCategory);
          // end of loop
          return;
        }

        // loop body (in every iteration)
        const oneTimeEntryDoc: ITimeEntryDocument = timeEntryDocsByInterval[indexInTimeEntries];
        const oneTaskId = oneTimeEntryDoc._taskId;
        try {
          // const groupCategory = await timeEntriesController.getGroupCategoryForTaskId(App.mongoDbOperations, oneTaskId);
          const taskCategory = await timeEntriesController.getCategoryForTaskId(App.mongoDbOperations, oneTaskId, routesConfig.taskCategoryPropertyName);
          const groupCategory = await timeEntriesController.getCategoryForTaskId(App.mongoDbOperations, oneTaskId, routesConfig.groupCategoryPropertyName);
          if (!timeEntriesByCategory[groupCategory]) {
            timeEntriesByCategory[groupCategory] = {};
          }
          if (!timeEntriesByCategory[groupCategory][taskCategory]) {
            timeEntriesByCategory[groupCategory][taskCategory] = [];
          }
          timeEntriesByCategory[groupCategory][taskCategory].push(oneTimeEntryDoc);
          // next iteration in loop
          indexInTimeEntries++;
          loop();
        } catch (e) {
          console.error('getTimeEntriesByTaskCategory threw an error:');
          console.error(e);
          // next iteration in loop
          indexInTimeEntries++;
          loop();
        }
      };
      // initial call
      loop();
    });
  }

  private static getDurationOfTimeEntry(timeEntry: ITimeEntryDocument) {
    return timeEntry.endTime.getTime() - timeEntry.startTime.getTime();
  }

  static async calculate(startTime: Date, endTime: Date, isDisabledPropertyName?: string, isDisabledPropertyValue?: boolean) {
    try {
      // DEBUGGING:
      // console.log(startTime.toUTCString());
      // console.log(endTime.toUTCString());

      const timeEntryDocsByIntervall: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTime, endTime, isDisabledPropertyName, isDisabledPropertyValue);
      if (!timeEntryDocsByIntervall || !timeEntryDocsByIntervall.length) {
        console.error('no time entries to calculate duration from');
        return null;
      }
      const durationSumByTaskIdMap: { [category: string]: { [taskId: string]: number } } = {};
      const durationSumFractionByTaskIdMap: { [category: string]: { [taskId: string]: number } } = {};
      const timeEntriesByCategory = await this.getTimeEntriesByTaskCategory(timeEntryDocsByIntervall);

      // DEBUGGING:
      // console.log(JSON.stringify(timeEntriesByCategory, null, 4));

      let durationSumOverAllCategories = 0.0;
      const categoryBufferMap: ITimeSummaryByGroupCategory = {};

      for (const groupCategory in timeEntriesByCategory) {
        if (Object.prototype.hasOwnProperty.call(timeEntriesByCategory, groupCategory)) {
          const oneTimeEntryBufferByGroupCategory = timeEntriesByCategory[groupCategory];

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
              // const oneTaskIds: string[] = [];
              let oneOverallSum = 0.0;
              timeEntriesOfOneCategory.forEach(oneTimeEntry => {
                const oneDuration = this.getDurationOfTimeEntry(oneTimeEntry);

                if (typeof durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] === 'undefined') {
                  durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] = 0;
                }
                durationSumByTaskIdMap[taskCategory][oneTimeEntry._taskId] += oneDuration;

                oneOverallSum += oneDuration;
                oneTimeEntryIds.push(oneTimeEntry.timeEntryId);
                // oneTaskIds.push(oneTimeEntry._taskId);
              });
              if (!categoryBufferMap[groupCategory]) {
                categoryBufferMap[groupCategory] = {};
              }
              categoryBufferMap[groupCategory][taskCategory] = {
                taskCategory: taskCategory,
                overallDurationSum: oneOverallSum,
                overallDurationSumFraction: -1.0,
                _timeEntryIds: oneTimeEntryIds,
                durationSumByTaskId: durationSumByTaskIdMap[taskCategory],
                durationSumFractionByTaskId: durationSumFractionByTaskIdMap[taskCategory],
                // taskIds: oneTaskIds
              };
              durationSumOverAllCategories += oneOverallSum;
            }
          }

        }
      }


      // DEBUGGING:
      // console.log(JSON.stringify(categoryBufferMap, null, 4));

      for (const taskCategory in durationSumByTaskIdMap) {
        if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap, taskCategory)) {
          // const element = durationSumByTaskIdMap[taskCategory];
          for (const taskId in durationSumByTaskIdMap[taskCategory]) {
            if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap[taskCategory], taskId)) {
              const absolutedurationSumByTaskId = durationSumByTaskIdMap[taskCategory][taskId];
              durationSumFractionByTaskIdMap[taskCategory][taskId] = absolutedurationSumByTaskId / durationSumOverAllCategories;

              // convert to hours:
              durationSumByTaskIdMap[taskCategory][taskId] = (((absolutedurationSumByTaskId / 1000) / 60) / 60);
            }
          }
        }
      }

      // DEBUGGING:
      // console.log(JSON.stringify(categoryBufferMap, null, 4));

      for (const oneGroupCatName in categoryBufferMap) {
        if (Object.prototype.hasOwnProperty.call(categoryBufferMap, oneGroupCatName)) {
          const oneSubMapForSpecificGroupCat = categoryBufferMap[oneGroupCatName];
          for (const oneTaskCat in oneSubMapForSpecificGroupCat) {
            if (Object.prototype.hasOwnProperty.call(oneSubMapForSpecificGroupCat, oneTaskCat)) {
              const sumEntry = oneSubMapForSpecificGroupCat[oneTaskCat];
              sumEntry.overallDurationSumFraction = sumEntry.overallDurationSum / durationSumOverAllCategories;

              // convert to hours:
              oneSubMapForSpecificGroupCat[oneTaskCat].overallDurationSum = (((oneSubMapForSpecificGroupCat[oneTaskCat].overallDurationSum / 1000) / 60) / 60);
            }
          }

        }
      }

      // DEBUGGING:
      // console.log(JSON.stringify(categoryBufferMap, null, 4));

      return categoryBufferMap;
      // return Object.values(categoryBufferMap);
      // return null;
    }
    catch (e) {
      console.error('outer exception:');
      console.error(e);
      console.error(JSON.stringify(e, null, 4));
      return e;
    }
  }
}
