/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export type QueryParams = {
    /** The scope reference (starts with 'ref:') */
    scope: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    /** The full oauth permission scope */
    scope: string;
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
export declare class InvalidScopeReferenceError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=dereferenceScope.d.ts.map