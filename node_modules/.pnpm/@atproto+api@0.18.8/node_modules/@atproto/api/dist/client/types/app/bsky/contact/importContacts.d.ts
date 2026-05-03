/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as AppBskyContactDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** JWT to authenticate the call. Use the JWT received as a response to the call to `app.bsky.contact.verifyPhone`. */
    token: string;
    /** List of phone numbers in global E.164 format (e.g., '+12125550123'). Phone numbers that cannot be normalized into a valid phone number will be discarded. Should not repeat the 'phone' input used in `app.bsky.contact.verifyPhone`. */
    contacts: string[];
}
export interface OutputSchema {
    /** The users that matched during import and their indexes on the input contacts, so the client can correlate with its local list. */
    matchesAndContactIndexes: AppBskyContactDefs.MatchAndContactIndex[];
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
export declare class InvalidDidError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidContactsError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class TooManyContactsError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidTokenError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InternalError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=importContacts.d.ts.map