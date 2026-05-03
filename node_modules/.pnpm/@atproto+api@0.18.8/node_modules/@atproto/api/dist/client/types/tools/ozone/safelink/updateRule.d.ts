/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as ToolsOzoneSafelinkDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** The URL or domain to update the rule for */
    url: string;
    pattern: ToolsOzoneSafelinkDefs.PatternType;
    action: ToolsOzoneSafelinkDefs.ActionType;
    reason: ToolsOzoneSafelinkDefs.ReasonType;
    /** Optional comment about the update */
    comment?: string;
    /** Optional DID to credit as the creator. Only respected for admin_token authentication. */
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
//# sourceMappingURL=updateRule.d.ts.map