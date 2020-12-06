import { AppManager } from './appManager';
import App from './app';
import { configure } from 'log4js';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

// cf. https://stackoverflow.com/questions/41359407/typescript-ignore-imlicitly-any-type-when-importing-js-module
// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';

const port: number = routesConfig.port;
const hostname = routesConfig.hostname;
const loggingFileName = 'timeTracker.log';

App.absolutePathToAppJs = process.argv[1];
const relativePathToLoggingFolder: string = './../../../serverNew/logging';
const absolutePathToLoggingFolder: string = resolve(App.absolutePathToAppJs, relativePathToLoggingFolder);
if (!existsSync(absolutePathToLoggingFolder)) {
  mkdirSync(absolutePathToLoggingFolder);
}
const absolutePathToLoggingFile = resolve(absolutePathToLoggingFolder, loggingFileName);

// setup logging
configure({
  appenders: {
    timeTracker: { type: 'file', filename:  absolutePathToLoggingFile},
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
