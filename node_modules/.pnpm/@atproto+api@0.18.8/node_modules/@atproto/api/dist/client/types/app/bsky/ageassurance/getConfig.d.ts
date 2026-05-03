/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as AppBskyAgeassuranceDefs from './defs.js';
export type QueryParams = {};
export type InputSchema = undefined;
export type OutputSchema = AppBskyAgeassuranceDefs.Config;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getConfig.d.ts.map