/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export type QueryParams = {};
export interface InputSchema {
    /** The subject's DID to dismiss the match with. */
    subject: string;
}
export interface OutputSchema {
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
export declare class InternalError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=dismissMatch.d.ts.map