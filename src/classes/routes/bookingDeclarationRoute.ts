import express, { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { App } from '../../app';
import bookingDeclarationController from '../controllers/bookingDeclarationController';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { Serialization } from '../../../../common/typescript/helpers/serialization';

const router = express.Router();

const postBookingDeclaration = async (req: Request, res: Response) => {
    const response = await bookingDeclarationController.post(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getViaProjectId = async (req: Request, res: Response) => {
    const response = await bookingDeclarationController.getViaProjectId(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};

const getViaId = async (req: Request, res: Response) => {
    // DEBUGGING:
    // console.log('getViaId');

    const response = await bookingDeclarationController.getViaId(req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
};
const rootRoute = router.route('/');
rootRoute.post(asyncHandler(postBookingDeclaration));

const getViaProjectIdRoute = router.route(routesConfig.bookingDeclarationsByProjectIdSuffix + '/*');
getViaProjectIdRoute.get(asyncHandler(getViaProjectId));

const getViaIdRoute = router.route('/*');
getViaIdRoute.get(asyncHandler(getViaId));

// DEBUGGING:
// console.log(getViaProjectIdRoute.path);

export default router;
