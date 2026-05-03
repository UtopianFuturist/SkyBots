/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as AppBskyAgeassuranceDefs from './defs.js';
export type QueryParams = {
    countryCode: string;
    regionCode?: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    state: AppBskyAgeassuranceDefs.State;
    metadata: AppBskyAgeassuranceDefs.StateMetadata;
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
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getState.d.ts.map