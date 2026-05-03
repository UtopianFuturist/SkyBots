/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as ToolsOzoneSafelinkDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** The URL or domain to remove the rule for */
    url: string;
    pattern: ToolsOzoneSafelinkDefs.PatternType;
    /** Optional comment about why the rule is being removed */
    comment?: string;
    /** Optional DID of the user. Only respected when using admin auth. */
    createdBy?: string;
}
export type OutputSchema = ToolsOzoneSafelinkDefs.Event;
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
export declare class RuleNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=removeRule.d.ts.map