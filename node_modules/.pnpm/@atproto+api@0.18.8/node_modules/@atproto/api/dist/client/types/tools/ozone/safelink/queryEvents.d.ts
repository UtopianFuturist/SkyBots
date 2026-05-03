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
    /** Sort direction */
    sortDirection?: 'asc' | 'desc' | (string & {});
}
export interface OutputSchema {
    /** Next cursor for pagination. Only present if there are more results. */
    cursor?: string;
    events: ToolsOzoneSafelinkDefs.Event[];
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
//# sourceMappingURL=queryEvents.d.ts.map