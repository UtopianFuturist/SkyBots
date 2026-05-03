/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export type QueryParams = {};
export interface InputSchema {
    serviceDid: string;
    token: string;
    platform: 'ios' | 'android' | 'web' | (string & {});
    appId: string;
    /** Set to true when the actor is age restricted */
    ageRestricted?: boolean;
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
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=registerPush.d.ts.map