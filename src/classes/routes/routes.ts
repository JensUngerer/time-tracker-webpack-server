import express from 'express';
// @ts-ignore
import * as routesConfig from './../../../../common/typescript/routes.js';

import timeRecordRoutes from './timeRecordRoutes';
import taskRoute from './taskRoute';
import projectRoute from './projectRoute';
import timeEntries from './timeEntries';
import bookingDeclarationRoute from './bookingDeclarationRoute'

// https://github.com/czechboy0-deprecated/Express-4x-Typescript-Sample/blob/master/routes/users.ts
// https://github.com/linnovate/mean/blob/master/server/config/express.js
const router = express.Router();

// https://github.com/linnovate/mean/blob/master/server/routes/index.route.js
router.use(routesConfig.timeRecord, timeRecordRoutes);
router.use(routesConfig.task, taskRoute);
router.use(routesConfig.project, projectRoute);
router.use(routesConfig.timeEntries, timeEntries);
router.use(routesConfig.bookingDeclaration, bookingDeclarationRoute);

export default router;
