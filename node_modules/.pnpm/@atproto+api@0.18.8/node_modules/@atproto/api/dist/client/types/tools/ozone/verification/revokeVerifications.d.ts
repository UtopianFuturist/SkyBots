/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
export type QueryParams = {};
export interface InputSchema {
    /** Array of verification record uris to revoke */
    uris: string[];
    /** Reason for revoking the verification. This is optional and can be omitted if not needed. */
    revokeReason?: string;
}
export interface OutputSchema {
    /** List of verification uris successfully revoked */
    revokedVerifications: string[];
    /** List of verification uris that couldn't be revoked, including failure reasons */
    failedRevocations: RevokeError[];
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
/** Error object for failed revocations */
export interface RevokeError {
    $type?: 'tools.ozone.verification.revokeVerifications#revokeError';
    /** The AT-URI of the verification record that failed to revoke. */
    uri: string;
    /** Description of the error that occurred during revocation. */
    error: string;
}
export declare function isRevokeError<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.verification.revokeVerifications", "revokeError">;
export declare function validateRevokeError<V>(v: V): ValidationResult<RevokeError & V>;
//# sourceMappingURL=revokeVerifications.d.ts.map