/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as ToolsOzoneSafelinkDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** Cursor for pagination */
    cursor?: string;
    /** Maximum number of results to return */
    limit?: number;
    /** Filter by specific URLs or domains */
    urls?: string[];
    /** Filter by pattern type */
    patternType?: string;
    /** Filter by action types */
    actions?: string[];
    /** Filter by reason type */
    reason?: string;
    /** Filter by rule creator */
    createdBy?: string;
    /** Sort direction */
    sortDirection?: 'asc' | 'desc' | (string & {});
}
export interface OutputSchema {
    /** Next cursor for pagination. Only present if there are more results. */
    cursor?: string;
    rules: ToolsOzoneSafelinkDefs.UrlRule[];
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
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=queryRules.d.ts.map