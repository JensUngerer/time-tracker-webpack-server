import { AppManager } from './appManager';
import App from './app';
import { configure } from 'log4js';

// cf. https://stackoverflow.com/questions/41359407/typescript-ignore-imlicitly-any-type-when-importing-js-module
// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';

const port: number = routesConfig.port;
const hostname = routesConfig.hostname;

// setup logging
configure({
  appenders: {
    timeTracker: { type: 'file', filename: 'timeTracker.log' },
    timeTrackerConsole: { type: 'console' },
  },
  categories: { default: { appenders: ['timeTracker', 'timeTrackerConsole'], level: 'debug' } },
});

// start app
const app = new App(port, hostname);
app.configure();
app.configureExpress();
app.configureRest();
app.setupDatabaseConnection();

AppManager.registerAppClosingEvent(app, true);
