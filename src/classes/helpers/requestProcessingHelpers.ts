import { Request } from 'express';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { FilterQuery } from 'mongodb';
import { Serialization } from './../../,,/../../../common/typescript/helpers/serialization';

export class RequestProcessingHelpers {
    public static getFilerQuery(req: Request): FilterQuery<any> {
        const body = Serialization.deSerialize<any>(req.body);

        const idPropertyName = body[routesConfig.httpPatchIdPropertyName];
        const timeEntryId = body[routesConfig.httpPatchIdPropertyValue];
        // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
        const theQueryObj: FilterQuery<any> = {};
        theQueryObj[idPropertyName] = timeEntryId;

        return theQueryObj;
    }
}