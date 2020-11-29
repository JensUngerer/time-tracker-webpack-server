import App from '../../app';
import { MongoClient, Cursor, FilterQuery } from 'mongodb';
// @ts-ignore
import * as routes from '../../../../common/typescript/routes.js';

export class MonogDbOperations {
  private mongoClient: MongoClient | null = null;
  private databaseName: string | null = null;
  private url: string | null = null;
  private connection: Promise<MongoClient> | null = null;

  public prepareConnection() {
    this.url = routes.url;
    this.databaseName = routes.databaseName;

    this.mongoClient = new MongoClient(this.url as string, { useNewUrlParser: true, useUnifiedTopology: true });
    this.connection = this.mongoClient.connect();
  }

  public closeConnection(): Promise<void> | null {
    if (this.mongoClient === null) {
      App.logger.error('cannot close connection');
      return null;
    }
    return this.mongoClient.close();
  }

  public patchPush(propertyName: string, propertyValue: any, collectionName: string, queryObj: FilterQuery<any>) {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // App.logger.error('connectionSuccess');
        // App.logger.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        const updateObj: any = { $push: {} };
        updateObj.$push[propertyName] = propertyValue;

        // // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/

        // // DEBUGGING:
        // App.logger.error(JSON.stringify({
        //     queryObj,
        //     updateObj
        // }, null, 4));

        collection.updateOne(queryObj, updateObj, (err: any, result: any) => {
          if (err) {
            App.logger.error('update failed');
            resolve(err);
            return;
          }

          resolve(result);
        });

      });
      this.connection.catch((connectionErr: any) => {
        App.logger.error('error when connecting to db');
        App.logger.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public patch(propertyName: string, propertyValue: any, collectionName: string, queryObj: FilterQuery<any>) {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // App.logger.error('connectionSuccess');
        // App.logger.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
        const updateObj: any = { $set: {} };
        updateObj.$set[propertyName] = propertyValue;

        // DEBUGGING:
        // App.logger.error('calling updateOne');
        // App.logger.error(JSON.stringify({
        //     queryObj,
        //     updateObj
        // }, null, 4));

        collection.updateOne(queryObj, updateObj, (err: any, result: any) => {
          if (err) {
            App.logger.error('update failed');
            resolve(err);
            return;
          }

          resolve(result);
        });
      });
      this.connection.catch((connectionErr: any) => {
        App.logger.error('error when connecting to db');
        App.logger.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public getFiltered(collectionName: string, queryObj?: FilterQuery<any>): Promise<any[]> {
    return new Promise<any>((resolve: (value: any[]) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // App.logger.error('connectionSuccess');
        // App.logger.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        const retrievedFilterQuery = queryObj ? queryObj : {};

        // DEBUGGING:
        // App.logger.error(JSON.stringify({
        //     collectionName,
        //     retrievedFilterQuery
        // }, null, 4));

        const cursor: Cursor<any> = collection.find(retrievedFilterQuery);
        if (!cursor) {
          App.logger.error('!cursor');
          resolve([]);
          this.mongoClient.close();
          return;
        }

        cursor.toArray().then((resolvedData: any[]) => {
          // DEBUGGING:
          // App.logger.error(JSON.stringify(resolvedData, null, 4));

          resolve(resolvedData);
        }).catch(() => {
          resolve([]);
        });
      });

      this.connection.catch((connectionErr: any) => {
        App.logger.error('error when connecting to db');
        App.logger.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public insertOne(data: any, collectionName: string) {
    // https://mongodb.github.io/node-mongodb-native/
    // https://mongodb.github.io/node-mongodb-native/3.2/

    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // App.logger.error('connectionSuccess');
        // App.logger.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        // DEBUGGING:
        // App.logger.info('insertOne');
        // App.logger.info(collectionName);
        // App.logger.info(JSON.stringify(data, null, 4));

        // should no longer be necessary as data _should_ not contain _id
        if (data && data._id) {
          App.logger.error('there is already an id -> returning');
          return;
        }

        collection.insertOne(data, (insertError: any, result: any) => {
          if (insertError) {
            resolve(insertError);
            return;
          }

          // DEBUGGING:
          // App.logger.info(JSON.stringify(result, null, 4));

          resolve(data);
          // this.mongoClient.close();
        });
      });

      this.connection.catch((connectionErr: any) => {
        App.logger.error('error when connecting to db');
        App.logger.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }
}
