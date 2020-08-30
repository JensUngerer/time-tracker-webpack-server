import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from './../helpers/mongoDbOperations';
import { ITimeRecordsDocumentData } from './../../../../common/typescript/mongoDB/iTimeRecordsDocument';
// @ts-ignore
import * as routes from '../../../../common/typescript/routes.js';

export default {
    post(collectionName: string, line: ITimeRecordsDocumentData, mongoDbOperations: MonogDbOperations): Promise<any> {
        return mongoDbOperations.insertOne(line, collectionName);
    },
    markTimeEntriesAsDeleted(isDisabledPropertyName: string, timeEntryIds: string[], mongoDbOperations: MonogDbOperations): Promise<any> {
        // DEBUGGING
        // console.error('timeEntryIds:' + JSON.stringify(timeEntryIds, null, 4));

        return new Promise<any>((resolve: (value: any) => void) => {
            let timeEntryIdsIndex = 0;
            const promiseThenLoop = () => {
                if (timeEntryIdsIndex < timeEntryIds.length) {
                    const queryObj: FilterQuery<any> = {};
                    queryObj[routes.timeEntryIdProperty] = timeEntryIds[timeEntryIdsIndex];
                    queryObj[routes.isDeletedInClientProperty] = false;

                    const propertyName = isDisabledPropertyName;
                    const propertyValue = true;

                    const promise = mongoDbOperations.patch(propertyName, propertyValue, routes.timEntriesCollectionName, queryObj);
                    promise.then(() => {
                        timeEntryIdsIndex++;
                        promiseThenLoop();
                    });
                    promise.catch((reason: any) => {
                        console.error('an patch operation rejected');
                        console.error(reason);
                        timeEntryIdsIndex++;
                        promiseThenLoop();
                    });
                } else {
                    resolve(true);
                }
            };
            // initial call
            promiseThenLoop();
        });
    }
}