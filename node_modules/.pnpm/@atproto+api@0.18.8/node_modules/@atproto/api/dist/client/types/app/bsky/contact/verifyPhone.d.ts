/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export type QueryParams = {};
export interface InputSchema {
    /** The phone number to verify. Should be the same as the one passed to `app.bsky.contact.startPhoneVerification`. */
    phone: string;
    /** The code received via SMS as a result of the call to `app.bsky.contact.startPhoneVerification`. */
    code: string;
}
export interface OutputSchema {
    /** JWT to be used in a call to `app.bsky.contact.importContacts`. It is only valid for a single call. */
    token: string;
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
export declare class RateLimitExceededError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidDidError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidPhoneError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidCodeError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InternalError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=verifyPhone.d.ts.map