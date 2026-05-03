/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
import type * as ComAtprotoSyncDefs from './defs.js';
export type QueryParams = {
    limit?: number;
    cursor?: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    /** Sort order is not formally specified. Recommended order is by time host was first seen by the server, with oldest first. */
    hosts: Host[];
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
export declare function toKnownErr(e: any): any;
export interface Host {
    $type?: 'com.atproto.sync.listHosts#host';
    /** hostname of server; not a URL (no scheme) */
    hostname: string;
    /** Recent repo stream event sequence number. May be delayed from actual stream processing (eg, persisted cursor not in-memory cursor). */
    seq?: number;
    accountCount?: number;
    status?: ComAtprotoSyncDefs.HostStatus;
}
export declare function isHost<V>(v: V): v is import("../../../../util").$TypedObject<V, "com.atproto.sync.listHosts", "host">;
export declare function validateHost<V>(v: V): ValidationResult<Host & V>;
//# sourceMappingURL=listHosts.d.ts.map