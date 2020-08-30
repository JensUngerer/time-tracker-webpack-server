import { MonogDbOperations } from './../helpers/mongoDbOperations';
import { Request } from 'express';
// @ts-ignore
import routes from '../../../../common/typescript/routes.js';
import {IBookingDeclaration} from './../../../../common/typescript/iBookingDeclaration';
import { UrlHelpers } from '../helpers/urlHelpers';
import { FilterQuery } from 'mongodb';
import { IBookingDeclarationsDocument } from './../../../../common/typescript/mongoDB/iBookingDeclarationsDocument';
import { Serialization } from '../../../../common/typescript/helpers/serialization';

export default {
    post(req: Request, mongoDbOperations: MonogDbOperations) {
        const body = Serialization.deSerialize<any>(req.body);

        const bookingDeclaration: IBookingDeclaration = body[routes.bookingDeclarationProperty];
        const bookingDeclarationDocument: IBookingDeclarationsDocument = bookingDeclaration as IBookingDeclarationsDocument;
        bookingDeclarationDocument.isDisabled = false;

        return mongoDbOperations.insertOne(bookingDeclaration, routes.bookingDeclarationsCollectionName);
    },
    getViaId(req: Request, mongoDbOperations: MonogDbOperations) {
        const bookingDeclarationId = UrlHelpers.getIdFromUlr(req.url);
        const queryObj: FilterQuery<any> = {};
        queryObj[routes.bookingDeclarationBookingDeclarationIdProperty] = bookingDeclarationId;
        queryObj[routes.isDisabledProperty] = false;

        return mongoDbOperations.getFiltered(routes.bookingDeclarationsCollectionName, queryObj);
    },
    getViaProjectId(req: Request, mongoDbOperations: MonogDbOperations) {
        const projectId = UrlHelpers.getIdFromUlr(req.url);
        const queryObj: FilterQuery<any> = {};
        queryObj[routes.isDisabledProperty] = false;
        queryObj[routes.bookingDeclarationProjectIdsProperty] = projectId;
        // https://stackoverflow.com/questions/18148166/find-document-with-array-that-contains-a-specific-value
        // https://docs.mongodb.com/manual/tutorial/query-arrays/
        return mongoDbOperations.getFiltered(routes.bookingDeclarationsCollectionName, queryObj);
    }
}