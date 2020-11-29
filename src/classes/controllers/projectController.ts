import { MonogDbOperations } from './../helpers/mongoDbOperations';
import { Request } from 'express';
// @ts-ignore
import routes from '../../../../common/typescript/routes.js';
import { IProject } from './../../../../common/typescript/iProject';
import _ from 'lodash';
import { IProjectsDocument } from './../../../../common/typescript/mongoDB/iProjectsDocument';
import { FilterQuery } from 'mongodb';
import { Serialization } from './../../../../common/typescript/helpers/serialization';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import App from '../../app';

export default {
  getByTaskId(taskId: string, mongoDbOperations: MonogDbOperations) {
    return new Promise((resolve: (value?: any) => void) => {
      const queryObj: any = {};
      queryObj[routes.taskIdProperty] = taskId;

      const taskDocuments = mongoDbOperations.getFiltered(routes.tasksCollectionName, queryObj);
      taskDocuments.then((taskDocuments: ITasksDocument[]) => {
        if (taskDocuments.length !== 1) {
          resolve(null);
          return;
        }

        const singleTaskDocument = taskDocuments[0];
        const projectId = singleTaskDocument._projectId;

        const projectIdFilterObj: FilterQuery<any> = {};
        projectIdFilterObj[routes.projectIdProperty] = projectId;

        const projectsPromise = mongoDbOperations.getFiltered(routes.projectsCollectionName, projectIdFilterObj);
        projectsPromise.then((projectDocs: IProjectsDocument[]) => {
          if (projectDocs.length !== 1) {
            App.logger.error('more than one project found for:' + projectId);
            // App.logger.error(JSON.stringify(projectDocs, null, 4));
            resolve(null);
            return;
          }
          resolve(projectDocs[0]);
        });
      });
      taskDocuments.catch(() => {
        App.logger.error('tasks rejected');
        resolve(null);
      });
    });

  },
  post(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    // DEBUGGING:
    // App.logger.info(req.body);

    const body = Serialization.deSerialize<any>(req.body);

    // DEBUGGING:
    // App.logger.info(JSON.stringify(body, null, 4));

    const project: IProject = body[routes.projectBodyProperty];

    const extendedProject: IProjectsDocument = _.clone(project) as IProjectsDocument;
    extendedProject.isDisabled = false;
    // should not be necessary
    // delete extendedProject._id;
    // this is undefined
    // App.logger.error(extendedProject._id);

    return mongoDbOperations.insertOne(extendedProject, routes.projectsCollectionName);
  },
  get(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const filterQuery: FilterQuery<any> = {};
    filterQuery[routes.isDisabledProperty] = false;

    return mongoDbOperations.getFiltered(routes.projectsCollectionName, filterQuery);
  },
  patch(req: Request, mongoDbOperations: MonogDbOperations): Promise<any> {
    const body = Serialization.deSerialize<any>(req.body);

    // DEBUGGING:
    // App.logger.info(JSON.stringify(body, null, 4));

    const propertyName = body[routes.httpPatchIdPropertyToUpdateName]; // 'isDeletedInClient';
    const propertyValue = body[routes.httpPatchIdPropertyToUpdateValue]; //true;
    const idPropertyName = body[routes.httpPatchIdPropertyName];
    const projectId = body[routes.httpPatchIdPropertyValue];

    // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
    const theQueryObj: FilterQuery<any> = { /*query: {}*/ };
    theQueryObj[idPropertyName] = projectId;

    // DEBUGGING:
    // App.logger.error(JSON.stringify({
    //     propertyName: propertyName,
    //     propertyValue: propertyValue,
    //     idPropertyName: idPropertyName,
    //     projectId: projectId,
    //     theQueryObj: theQueryObj
    // }, null, 4));

    return mongoDbOperations.patch(propertyName, propertyValue, routes.projectsCollectionName, theQueryObj);
  },
};
