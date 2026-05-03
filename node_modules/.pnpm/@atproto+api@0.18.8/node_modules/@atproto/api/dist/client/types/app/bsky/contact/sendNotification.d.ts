/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export type QueryParams = {};
export interface InputSchema {
    /** The DID of who this notification comes from. */
    from: string;
    /** The DID of who this notification should go to. */
    to: string;
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
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=sendNotification.d.ts.map