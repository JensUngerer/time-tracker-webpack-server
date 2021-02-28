import { Application, Response, Request, NextFunction } from 'express';
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
import { getLogger, Logger } from 'log4js';
import mongoose, { Connection, Document, Model, } from 'mongoose';
import { Strategy } from 'passport-local';
import session from 'express-session';

// const MongoStore = connectMongo(session);
// const LocalStrategy = passportLocal.Strategy;

export interface IApp {
  configure(): void;
  configureExpress(): void;
  shutdown(): Promise<boolean>;
  configureRest(): void;
  setupDatabaseConnection(): void;
  closeDataBaseConnection(): Promise<void>;
}


// @ts-ignore
// import { ensureAuthenticated } from 'connect-ensure-authenticated';
import passport from 'passport';
import MongoStore from 'connect-mongo';

interface IUser extends Document<any> {
  username: string;
  hash: string;
}

export class App implements IApp {
  //   private readonly UserSchema: Schema = new mongoose.Schema({
  //     username: String,
  //     hash: String
  // });

  private express: Application;
  private server: Server;
  public static mongoDbOperations: MonogDbOperations;
  static logger: Logger;
  static absolutePathToAppJs: string;

  private User: Model<IUser>;
  private sessionStore: MongoStore;

  private innerAuthentification(username: string, password: string, cb: (err: any, user?: any) => void) {
    this.User.findOne({ username: username })
      .then((user: IUser | null) => {

        if (!user) { return cb(null, false) }

        const isValid = this.validPassword(password, user.hash);

        if (isValid) {
          return cb(null, user);
        } else {
          return cb(null, false);
        }
      })
      .catch((err: any) => {
        cb(err);
      });
  }
  // }

  public constructor(port: number, hostname: string) {
    // setup logging
    const logger = getLogger();
    logger.level = 'debug';
    App.logger = logger;

    this.express = express();
    this.server = this.express.listen(port, hostname, () => {
      App.logger.info('successfully started on: ' + hostname + ':' + port);
    });

    // set up express-session
    const completeDataBaseString = routesConfig.url + '/' + routesConfig.sessionsDataBaseName;
    const mogooseConnection: Connection = mongoose.createConnection(completeDataBaseString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // user: process.env.USER as string,
      // pass: process.env.PW as string
    });
    const UserSchema = new mongoose.Schema<IUser>({
      username: String,
      hash: String
    });
    this.User = mogooseConnection.model<IUser>('User', UserSchema);

    this.localStrategyHandler = new Strategy(
      (username, password, cb) => {
        // console.log(username);
        // console.log(password);
        this.innerAuthentification(username, password, cb);
      }
    );
    const client = mogooseConnection.getClient();
    // { collectionName: routesConfig.sessionsCollectionName, mongoUrl: completeDataBaseString }
    this.sessionStore = new MongoStore({ clientPromise: Promise.resolve(client) });
    // this.sessionStore.
    /**
     *  mongoUrl?: string;
    clientPromise?: Promise<MongoClient>;
    collectionName?: string;
    mongoOptions?: MongoClientOptions;
    dbName?: string;
    ttl?: number;
    touchAfter?: number;
    stringify?: boolean;
    createAutoRemoveIdx?: boolean;
    autoRemove?: 'native' | 'interval' | 'disabled';
    autoRemoveInterval?: number;
    serialize?: (a: any) => any;
    unserialize?: (a: any) => any;
    writeOperationOptions?: CommonOptions;
    transformId?: (a: any) => any;
    crypto?: CryptoOptions;
     */
    // const options: ConnectionMongoOptions = {
    //   // mongoUrl: completeDataBaseString,
    //   clientP: 

    // };
    // // { collectionName, ttl, mongoOptions, autoRemove, autoRemoveInterval, touchAfter, stringify, crypto, ...required }: ConnectMongoOptions
    // // { mongooseConnection: options, collection: process.env.DATA_BASE_SESSIONS_COLLECTION_NAME }
    // const sessionStore = new MongoStore(options)

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

  private validPassword(passwordHash: string, hash: string) {
    return hash === passwordHash;
  }

  private localStrategyHandler: Strategy;

  private serializeUserHandler(user: Express.User, done: (err: any, id?: any) => void) {
    // console.log(JSON.stringify(user, null, 4));
    done(null, (user as any)._id);
  }

  private deserializeUser(id: any, done: (err: any, user?: Express.User) => void) {
    this.User.findById(id, (err: any, user: Express.User) => {
      if (err) { return done(err); }
      done(null, user);
    });
  }

  public configure(): void {
    // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
    this.express.use(bodyParser.text());
    this.express.use(bodyParser.urlencoded({ extended: true }));
    this.express.use(helmet());
    this.express.use(cors());

    passport.use(this.localStrategyHandler);
    passport.serializeUser(this.serializeUserHandler.bind(this));
    passport.deserializeUser(this.deserializeUser.bind(this));

    const sessionHandler = session({
      secret: routesConfig.secret,
      resave: false,
      saveUninitialized: true,
      store: this.sessionStore,
      cookie: {
        maxAge: 1000 * 60 * 60 * 14 // (1 day * 14 hr/1 day * 60 min/1 hr * 60 sec/1 min * 1000 ms / 1 sec)
      }
    });
    this.express.use(sessionHandler);
    const passportInitializeHandler = passport.initialize();
    this.express.use(passportInitializeHandler);
    const passportSessionHanlder = passport.session();
    this.express.use(passportSessionHanlder);


  }

  public configureExpress(): void {
    const relativePathToAppJs: string = './../../../client/dist/mtt-client';
    const pathStr: string = path.resolve(App.absolutePathToAppJs, relativePathToAppJs);

    // https://medium.com/javascript-in-plain-english/excluding-routes-from-calling-express-middleware-with-express-unless-3389ab4117ef
    // this.express.use(ensureAuthenticated().unless({
    //   path: ['/' + routesConfig.viewsPrefix + '*', '/', '/api/login', 'api/login-status', '/api/logout']
    // }));
    const ensureAuthenticatedHanlder = (req: Request, res: Response, next: NextFunction) => {
      // console.log(req.url);

      /**
      /styles.7c679b653e27c931f689.css
      /runtime-es2015.a4dadbc03350107420a4.js
      /polyfills-es2015.d74b108abb35193b00e4.js
      /main-es2015.3505e6209b4b969c1d73.js
      /scripts.1b91bff80e5970cfd35f.js
      /assets/config/config.json
      /MaterialIcons-Regular.cff684e59ffb052d72cb.woff2
      /stopwatch-2-32.ico
      */
      const allowedUrls = [
        '/styles',
        '/runtime',
        '/polyfills',
        '/main',
        '/scripts',
        '/assets',
        '/MaterialIcons-Regular',
        '/stopwatch-2-32.ico',
        '/favicon.ico',
        '/api/',
        '/vendor',
        '/' + routesConfig.viewsPrefix,
        routesConfig.bookingDeclaration,
        routesConfig.timeRecord,
        routesConfig.task,
        routesConfig.project,
        routesConfig.timeEntries
      ];
      let isAllowed = false;
      allowedUrls.forEach((oneAllowedUrlPrefix: string) => {
        if (req.url.startsWith(oneAllowedUrlPrefix)) {
          isAllowed = true;
        }
      });
      if (req.url === '/') {
        isAllowed = true;
      }
      if (isAllowed) {
        next('route');
      } else {
        const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
        const DEFAULT_NOT_AUTHENTICATED_MESSAGE = 'Authentication required';

        res.status(HTTP_STATUS_CODE_UNAUTHORIZED);
        res.json({ message: DEFAULT_NOT_AUTHENTICATED_MESSAGE });
      }
    };
    this.express.use(ensureAuthenticatedHanlder)

    this.express.post('/api/login', (req: Request, res: Response, next: NextFunction) => {
      const body = JSON.parse(req.body);

      this.innerAuthentification(body.username, body.password, (err: any, user?: any) => {
        if (err) {
          console.error(JSON.stringify(err));
          next(err);
          return;
        }
        if (!user) {
          const noUserMsg = 'no user:' + JSON.stringify(user, null, 4);
          console.error(noUserMsg);
          next(noUserMsg);
          return;
        }
        req.login(user, (errForLogin: any) => {
          if (errForLogin) {
            const errForLoginMsg = 'errorForLoging:' + JSON.stringify(errForLogin, null, 4);
            console.error(errForLoginMsg);
            next(errForLoginMsg);
            return;
          }
          res.status(200).send('login-was-successful');
        })
      });
    });
    this.express.get('/api/login-status', (req, res) => {
      // https://stackoverflow.com/questions/18739725/how-to-know-if-user-is-logged-in-with-passport-js
      req.isAuthenticated() ? res.status(200).send(JSON.stringify({ isLoggedIn: true })) : res.status(200).send(JSON.stringify({ isLoggedIn: false }));
    });

    // Visiting this route logs the user out
    this.express.post('/api/logout', (req, res, next) => {
      req.logout();
      res.status(200).send('logout-was-successful');
    });

    this.express.use('/', express.static(pathStr));

    // https://stackoverflow.com/questions/25216761/express-js-redirect-to-default-page-instead-of-cannot-get
    // https://stackoverflow.com/questions/30546524/making-angular-routes-work-with-express-routes
    // https://stackoverflow.com/questions/26917424/angularjs-and-express-routing-404
    // https://stackoverflow.com/questions/26079611/node-js-typeerror-path-must-be-absolute-or-specify-root-to-res-sendfile-failed
    this.express.get('/' + routesConfig.viewsPrefix + '*', (request: Request, response: Response) => {
      // DEBUGGING:
      // App.logger.info(request.url);
      // App.logger.info(pathStr);
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
          App.logger.error('error when closing the http-server');
          // App.logger.error(err);
          // App.logger.error(JSON.stringify(err, null, 4));
          reject(err);
          return;
        }
        App.logger.error('http-server successfully closed');

        resolve(true);
      });
    });
  }
}

export default App;
