import express, { Request, Response } from 'express';
import taskController from './../controllers/taskController';
import { App } from '../../app';
import { UrlHelpers } from '../helpers/urlHelpers';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';

const router = express.Router();

const postTask = async (req: Request, res: Response) => {
    const response = await taskController.post(req, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getTask = async (req: Request, res: Response) => {
    const response = await taskController.get(req, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const patchTask = async (req: Request, res: Response) => {
    const response = await taskController.patch(req, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getTaskViaProjectId = async (req: Request, res: Response) => {
    const projectId = UrlHelpers.getIdFromUlr(req.url);

    const response = await taskController.getViaProjectId(projectId, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getViaTaskId = async (req: Request, res: Response) => {
    // DEBUGGING:
    // console.log(req.url);

    const taskId = UrlHelpers.getIdFromUlr(req.url);

    // DEBUGGING:
    // console.log(taskId);

    const singleTaskDocuments = await taskController.getViaTaskId(taskId, App.mongoDbOperations);

    const stringifiedResponse = Serialization.serialize(singleTaskDocuments);
    res.send(stringifiedResponse);
};

const rootRoute = router.route('/');
rootRoute.post(postTask);
rootRoute.get(getTask);
rootRoute.patch(patchTask);

const idRoute = router.route(routesConfig.taskIdSuffix + '/*');
idRoute.get(getViaTaskId);

const rootRouteWithId = router.route('/*');
rootRouteWithId.get(getTaskViaProjectId);

export default router;
