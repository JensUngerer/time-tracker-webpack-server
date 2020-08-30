import { MonogDbOperations } from './mongoDbOperations';
import { IPause } from '../../../../common/typescript/iPause';
import { FilterQuery } from 'mongodb';
// @ts-ignore
import routes from '../../../../common/typescript/routes';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { TimeManagement } from './timeManagement';
export class MongoDbLogic {

    constructor(private mongoDbOperations: MonogDbOperations) {

    }

    public patchLastTimeEntryPause(queryObj: FilterQuery<any>, storedDocuments: any[]) {
        return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
            if (!storedDocuments || storedDocuments.length === 0) {
                console.error('no document found which could be patched');
                resolve('error');
                return;
            }
            const singleDoc = storedDocuments[0] as ITimeEntryDocument;
            const pausesArray = singleDoc.pauses;
            if (!pausesArray || pausesArray.length === 0) {
                console.error('cannot use pauses array');
                resolve('errorTwo');
                return;
            }

            const currentPauseObject = pausesArray[pausesArray.length - 1];
            currentPauseObject.endTime = new Date();

            // overwrite the entire pausesArray
            const patchPromise = this.patchDurationsArrayInTimeEntry(pausesArray, queryObj);
            patchPromise.then(resolve);
            patchPromise.catch(reject);
        });
    }

    public storeDurationInPausesOfDocument(queryObj: FilterQuery<any>, documents: ITimeEntryDocument[]): Promise<any> {
        return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
            if (!documents || documents.length === 0 || documents.length > 1) {
                console.error('the documents are empty');
                resolve('the documents are empty');
                return;
            }
            const theSingleDoc = documents[0];
            const thePauses = theSingleDoc.pauses;

            for (let loopCtr = 0; loopCtr < thePauses.length; loopCtr++) {
                const onePause = thePauses[loopCtr];
                onePause.duration = TimeManagement.pauseEntryToDuration(onePause);
            }

            // write the entire array back to the document
            const patchArrayPromise = this.patchDurationsArrayInTimeEntry(thePauses, queryObj);
            patchArrayPromise.then(resolve);
            patchArrayPromise.catch(reject);
        });
    }

    private patchDurationsArrayInTimeEntry(pauses: IPause[], queryObj: FilterQuery<any>) {
        const propertyName = routes.pausesProperty;
        const propValue = pauses;
        const collectionName = routes.timEntriesCollectionName;

        return this.mongoDbOperations.patch(propertyName, propValue, collectionName, queryObj);
    }
}