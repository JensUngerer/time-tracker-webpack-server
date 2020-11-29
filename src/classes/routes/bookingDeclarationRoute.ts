import express, { Request, Response } from 'express';
import bookingDeclarationController from '../controllers/bookingDeclarationController';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import App from '../../app';

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
  // App.logger.info('getViaId');

  const response = await bookingDeclarationController.getViaId(req, App.mongoDbOperations);
  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};
const rootRoute = router.route('/');
rootRoute.post(postBookingDeclaration);

const getViaProjectIdRoute = router.route(routesConfig.bookingDeclarationsByProjectIdSuffix + '/*');
getViaProjectIdRoute.get(getViaProjectId);

const getViaIdRoute = router.route('/*');
getViaIdRoute.get(getViaId);

// DEBUGGING:
// App.logger.info(getViaProjectIdRoute.path);

export default router;
