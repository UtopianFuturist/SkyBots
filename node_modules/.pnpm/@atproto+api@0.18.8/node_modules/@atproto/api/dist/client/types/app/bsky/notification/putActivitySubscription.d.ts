/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as AppBskyNotificationDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    subject: string;
    activitySubscription: AppBskyNotificationDefs.ActivitySubscription;
}
export interface OutputSchema {
    subject: string;
    activitySubscription?: AppBskyNotificationDefs.ActivitySubscription;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'application/json';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=putActivitySubscription.d.ts.map