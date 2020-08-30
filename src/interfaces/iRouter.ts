import { IRouterMatcher } from "express-serve-static-core";

export interface IRouter {
    timeEntry: IRouterMatcher<any>
}