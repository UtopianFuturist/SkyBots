/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as AppBskyContactDefs from './defs.js';
export type QueryParams = {};
export type InputSchema = undefined;
export interface OutputSchema {
    syncStatus?: AppBskyContactDefs.SyncStatus;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare class InvalidDidError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InternalError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getSyncStatus.d.ts.map