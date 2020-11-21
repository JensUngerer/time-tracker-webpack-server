import { Application, Response, Request } from 'express';
import { Server } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';
import { MonogDbOperations } from './classes/helpers/mongoDbOperations';

import timeRecordRoutes from './classes/routes/timeRecordRoutes';
import taskRoute from './classes/routes//taskRoute';
import projectRoute from './classes/routes//projectRoute';
import timeEntries from './classes/routes//timeEntries';
import bookingDeclarationRoute from './classes/routes//bookingDeclarationRoute';

export interface IApp {
  configure(): void;
  configureExpress(): void;
  shutdown(): Promise<boolean>;
  configureRest(): void;
  setupDatabaseConnection(): void;
  closeDataBaseConnection(): Promise<void>;
}

export class App implements IApp {
  private express: Application;
  private server: Server;
  public static mongoDbOperations: MonogDbOperations;

  public constructor(port: number, hostname: string) {
    this.express = express();
    this.server = this.express.listen(port, hostname, () => {
      console.log('successfully started on: ' + hostname + ':' + port);
    });
  }

  public setupDatabaseConnection() {
    App.mongoDbOperations = new MonogDbOperations();
    App.mongoDbOperations.prepareConnection();
  }

  public closeDataBaseConnection(): Promise<void> {
    const promiseOrNull = App.mongoDbOperations.closeConnection();
    if (promiseOrNull !== null) {
      return promiseOrNull;
    }
    return Promise.reject();
  }

  public configure(): void {
    // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
    this.express.use(bodyParser.text());
    this.express.use(bodyParser.urlencoded({ extended: true }));
    this.express.use(helmet());
    this.express.use(cors());
  }

  public configureExpress(): void {
    const absolutePathToAppJs = process.argv[1];
    const relativePathToAppJs: string = './../../../client/dist/mtt-client';
    const pathStr: string = path.resolve(absolutePathToAppJs, relativePathToAppJs);

    this.express.use(express.static(pathStr));

    // https://stackoverflow.com/questions/25216761/express-js-redirect-to-default-page-instead-of-cannot-get
    // https://stackoverflow.com/questions/30546524/making-angular-routes-work-with-express-routes
    // https://stackoverflow.com/questions/26917424/angularjs-and-express-routing-404
    // https://stackoverflow.com/questions/26079611/node-js-typeerror-path-must-be-absolute-or-specify-root-to-res-sendfile-failed
    this.express.get('/', (request: Request, response: Response) => {
      // DEBUGGING:
      // console.log(request.url);
      // console.log(pathStr);
      response.sendFile('index.html', { root: pathStr });
    });
    this.express.get('/' + routesConfig.viewsPrefix + '*', (request: Request, response: Response) => {
      // DEBUGGING:
      // console.log(request.url);
      // console.log(pathStr);
      response.sendFile('index.html', { root: pathStr });
    });
  }

  public configureRest() {
    // http://expressjs.com/de/api.html#router
    this.express.use(routesConfig.timeRecord, timeRecordRoutes);
    this.express.use(routesConfig.task, taskRoute);
    this.express.use(routesConfig.project, projectRoute);
    this.express.use(routesConfig.timeEntries, timeEntries);
    this.express.use(routesConfig.bookingDeclaration, bookingDeclarationRoute);
  }

  public shutdown(): Promise<boolean> {
    return new Promise<boolean>((resolve: (value: boolean) => void, reject: (value: any) => void) => {
      // https://hackernoon.com/graceful-shutdown-in-nodejs-2f8f59d1c357
      this.server.close((err: Error | undefined) => {
        if (err) {
          console.error('error when closing the http-server');
          // console.error(err);
          // console.error(JSON.stringify(err, null, 4));
          reject(err);
          return;
        }
        console.error('http-server successfully closed');

        resolve(true)
      });
    });
  }
}

export default App;
