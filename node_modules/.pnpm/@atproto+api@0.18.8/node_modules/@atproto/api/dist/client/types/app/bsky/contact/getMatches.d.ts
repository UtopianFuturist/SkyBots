/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as AppBskyActorDefs from '../actor/defs.js';
export type QueryParams = {
    limit?: number;
    cursor?: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    matches: AppBskyActorDefs.ProfileView[];
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
export declare class InvalidLimitError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidCursorError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InternalError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getMatches.d.ts.map