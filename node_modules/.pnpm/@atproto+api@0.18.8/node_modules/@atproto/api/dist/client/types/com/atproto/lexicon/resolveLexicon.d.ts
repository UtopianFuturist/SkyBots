/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as ComAtprotoLexiconSchema from './schema.js';
export type QueryParams = {
    /** The lexicon NSID to resolve. */
    nsid: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    /** The CID of the lexicon schema record. */
    cid: string;
    schema: ComAtprotoLexiconSchema.Main;
    /** The AT-URI of the lexicon schema record. */
    uri: string;
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
export declare class LexiconNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=resolveLexicon.d.ts.map