/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import type * as ComAtprotoSyncDefs from './defs.js';
export type QueryParams = {
    /** Hostname of the host (eg, PDS or relay) being queried. */
    hostname: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    hostname: string;
    /** Recent repo stream event sequence number. May be delayed from actual stream processing (eg, persisted cursor not in-memory cursor). */
    seq?: number;
    /** Number of accounts on the server which are associated with the upstream host. Note that the upstream may actually have more accounts. */
    accountCount?: number;
    status?: ComAtprotoSyncDefs.HostStatus;
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
export declare class HostNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getHostStatus.d.ts.map