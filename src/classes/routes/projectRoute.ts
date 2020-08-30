import express, { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import projectController from './../controllers/projectController';
import { App } from '../../app';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { UrlHelpers } from '../helpers/urlHelpers';

const router = express.Router();

const postProject = async (req: Request, res: Response) => {
    const response = await projectController.post(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getProject = async (req: Request, res: Response) => {
    const response = await projectController.get(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const patchProject = async (req: Request, res: Response) => {
    const response = await projectController.patch(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getByTaskIdHandler = async (req: Request, res: Response) => {
    const taskId = UrlHelpers.getIdFromUlr(req.url);
    const response = await projectController.getByTaskId(taskId, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const rootRoute = router.route('/');
rootRoute.post(asyncHandler(postProject));
rootRoute.get(asyncHandler(getProject));
rootRoute.patch(asyncHandler(patchProject));

const byTaskIdRoute = router.route(routesConfig.projectByTaskIdSuffix + '/*');
byTaskIdRoute.get(asyncHandler(getByTaskIdHandler));
export default router;
