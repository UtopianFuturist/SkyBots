/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as AppBskyNotificationDefs from './defs.js';
export type QueryParams = {};
export type InputSchema = undefined;
export interface OutputSchema {
    preferences: AppBskyNotificationDefs.Preferences;
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
//# sourceMappingURL=getPreferences.d.ts.map