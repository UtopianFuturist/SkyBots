/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as ToolsOzoneSafelinkDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** The URL or domain to apply the rule to */
    url: string;
    pattern: ToolsOzoneSafelinkDefs.PatternType;
    action: ToolsOzoneSafelinkDefs.ActionType;
    reason: ToolsOzoneSafelinkDefs.ReasonType;
    /** Optional comment about the decision */
    comment?: string;
    /** Author DID. Only respected when using admin auth */
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
export declare class InvalidUrlError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class RuleAlreadyExistsError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=addRule.d.ts.map