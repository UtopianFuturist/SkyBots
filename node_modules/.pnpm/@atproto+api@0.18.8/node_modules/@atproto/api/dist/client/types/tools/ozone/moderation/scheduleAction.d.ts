/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as ToolsOzoneModerationDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    action: $Typed<Takedown> | {
        $type: string;
    };
    /** Array of DID subjects to schedule the action for */
    subjects: string[];
    createdBy: string;
    scheduling: SchedulingConfig;
    modTool?: ToolsOzoneModerationDefs.ModTool;
}
export type OutputSchema = ScheduledActionResults;
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
/** Schedule a takedown action */
export interface Takedown {
    $type?: 'tools.ozone.moderation.scheduleAction#takedown';
    comment?: string;
    /** Indicates how long the takedown should be in effect before automatically expiring. */
    durationInHours?: number;
    /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
    acknowledgeAccountSubjects?: boolean;
    /** Names/Keywords of the policies that drove the decision. */
    policies?: string[];
    /** Severity level of the violation (e.g., 'sev-0', 'sev-1', 'sev-2', etc.). */
    severityLevel?: string;
    /** Number of strikes to assign to the user when takedown is applied. */
    strikeCount?: number;
    /** When the strike should expire. If not provided, the strike never expires. */
    strikeExpiresAt?: string;
    /** Email content to be sent to the user upon takedown. */
    emailContent?: string;
    /** Subject of the email to be sent to the user upon takedown. */
    emailSubject?: string;
}
export declare function isTakedown<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.scheduleAction", "takedown">;
export declare function validateTakedown<V>(v: V): ValidationResult<Takedown & V>;
/** Configuration for when the action should be executed */
export interface SchedulingConfig {
    $type?: 'tools.ozone.moderation.scheduleAction#schedulingConfig';
    /** Exact time to execute the action */
    executeAt?: string;
    /** Earliest time to execute the action (for randomized scheduling) */
    executeAfter?: string;
    /** Latest time to execute the action (for randomized scheduling) */
    executeUntil?: string;
}
export declare function isSchedulingConfig<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.scheduleAction", "schedulingConfig">;
export declare function validateSchedulingConfig<V>(v: V): ValidationResult<SchedulingConfig & V>;
export interface ScheduledActionResults {
    $type?: 'tools.ozone.moderation.scheduleAction#scheduledActionResults';
    succeeded: string[];
    failed: FailedScheduling[];
}
export declare function isScheduledActionResults<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.scheduleAction", "scheduledActionResults">;
export declare function validateScheduledActionResults<V>(v: V): ValidationResult<ScheduledActionResults & V>;
export interface FailedScheduling {
    $type?: 'tools.ozone.moderation.scheduleAction#failedScheduling';
    subject: string;
    error: string;
    errorCode?: string;
}
export declare function isFailedScheduling<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.scheduleAction", "failedScheduling">;
export declare function validateFailedScheduling<V>(v: V): ValidationResult<FailedScheduling & V>;
//# sourceMappingURL=scheduleAction.d.ts.map