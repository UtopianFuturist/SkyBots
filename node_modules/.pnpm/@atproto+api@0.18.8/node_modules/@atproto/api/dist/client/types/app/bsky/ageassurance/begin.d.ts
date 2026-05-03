/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as AppBskyAgeassuranceDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** The user's email address to receive Age Assurance instructions. */
    email: string;
    /** The user's preferred language for communication during the Age Assurance process. */
    language: string;
    /** An ISO 3166-1 alpha-2 code of the user's location. */
    countryCode: string;
    /** An optional ISO 3166-2 code of the user's region or state within the country. */
    regionCode?: string;
}
export type OutputSchema = AppBskyAgeassuranceDefs.State;
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
export declare class InvalidEmailError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class DidTooLongError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidInitiationError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class RegionNotSupportedError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=begin.d.ts.map