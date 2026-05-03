/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
export type QueryParams = {};
export type InputSchema = undefined;
export interface OutputSchema {
    checkEmailConfirmed?: boolean;
    liveNow?: LiveNowConfig[];
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
export interface LiveNowConfig {
    $type?: 'app.bsky.unspecced.getConfig#liveNowConfig';
    did: string;
    domains: string[];
}
export declare function isLiveNowConfig<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.getConfig", "liveNowConfig">;
export declare function validateLiveNowConfig<V>(v: V): ValidationResult<LiveNowConfig & V>;
//# sourceMappingURL=getConfig.d.ts.map