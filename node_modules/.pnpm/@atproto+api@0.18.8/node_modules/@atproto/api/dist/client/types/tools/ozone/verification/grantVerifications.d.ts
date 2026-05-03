/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
import type * as ToolsOzoneVerificationDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    /** Array of verification requests to process */
    verifications: VerificationInput[];
}
export interface OutputSchema {
    verifications: ToolsOzoneVerificationDefs.VerificationView[];
    failedVerifications: GrantError[];
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
export interface VerificationInput {
    $type?: 'tools.ozone.verification.grantVerifications#verificationInput';
    /** The did of the subject being verified */
    subject: string;
    /** Handle of the subject the verification applies to at the moment of verifying. */
    handle: string;
    /** Display name of the subject the verification applies to at the moment of verifying. */
    displayName: string;
    /** Timestamp for verification record. Defaults to current time when not specified. */
    createdAt?: string;
}
export declare function isVerificationInput<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.verification.grantVerifications", "verificationInput">;
export declare function validateVerificationInput<V>(v: V): ValidationResult<VerificationInput & V>;
/** Error object for failed verifications. */
export interface GrantError {
    $type?: 'tools.ozone.verification.grantVerifications#grantError';
    /** Error message describing the reason for failure. */
    error: string;
    /** The did of the subject being verified */
    subject: string;
}
export declare function isGrantError<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.verification.grantVerifications", "grantError">;
export declare function validateGrantError<V>(v: V): ValidationResult<GrantError & V>;
//# sourceMappingURL=grantVerifications.d.ts.map