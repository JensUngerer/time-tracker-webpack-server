import { AppManager } from './appManager';
import App from './app';

// cf. https://stackoverflow.com/questions/41359407/typescript-ignore-imlicitly-any-type-when-importing-js-module
// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';

const port: number = routesConfig.port;
const hostname = routesConfig.hostname;

const app = new App(port, hostname);
app.configure();
app.configureExpress();
app.configureRest();
app.setupDatabaseConnection();

AppManager.registerAppClosingEvent(app, true);