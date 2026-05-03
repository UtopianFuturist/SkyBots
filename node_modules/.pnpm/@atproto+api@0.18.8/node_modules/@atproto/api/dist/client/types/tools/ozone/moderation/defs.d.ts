/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs.js';
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js';
import type * as ChatBskyConvoDefs from '../../../chat/bsky/convo/defs.js';
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs.js';
import type * as AppBskyAgeassuranceDefs from '../../../app/bsky/ageassurance/defs.js';
import type * as ComAtprotoServerDefs from '../../../com/atproto/server/defs.js';
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js';
export interface ModEventView {
    $type?: 'tools.ozone.moderation.defs#modEventView';
    id: number;
    event: $Typed<ModEventTakedown> | $Typed<ModEventReverseTakedown> | $Typed<ModEventComment> | $Typed<ModEventReport> | $Typed<ModEventLabel> | $Typed<ModEventAcknowledge> | $Typed<ModEventEscalate> | $Typed<ModEventMute> | $Typed<ModEventUnmute> | $Typed<ModEventMuteReporter> | $Typed<ModEventUnmuteReporter> | $Typed<ModEventEmail> | $Typed<ModEventResolveAppeal> | $Typed<ModEventDivert> | $Typed<ModEventTag> | $Typed<AccountEvent> | $Typed<IdentityEvent> | $Typed<RecordEvent> | $Typed<ModEventPriorityScore> | $Typed<AgeAssuranceEvent> | $Typed<AgeAssuranceOverrideEvent> | $Typed<RevokeAccountCredentialsEvent> | $Typed<ScheduleTakedownEvent> | $Typed<CancelScheduledTakedownEvent> | {
        $type: string;
    };
    subject: $Typed<ComAtprotoAdminDefs.RepoRef> | $Typed<ComAtprotoRepoStrongRef.Main> | $Typed<ChatBskyConvoDefs.MessageRef> | {
        $type: string;
    };
    subjectBlobCids: string[];
    createdBy: string;
    createdAt: string;
    creatorHandle?: string;
    subjectHandle?: string;
    modTool?: ModTool;
}
export declare function isModEventView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventView">;
export declare function validateModEventView<V>(v: V): ValidationResult<ModEventView & V>;
export interface ModEventViewDetail {
    $type?: 'tools.ozone.moderation.defs#modEventViewDetail';
    id: number;
    event: $Typed<ModEventTakedown> | $Typed<ModEventReverseTakedown> | $Typed<ModEventComment> | $Typed<ModEventReport> | $Typed<ModEventLabel> | $Typed<ModEventAcknowledge> | $Typed<ModEventEscalate> | $Typed<ModEventMute> | $Typed<ModEventUnmute> | $Typed<ModEventMuteReporter> | $Typed<ModEventUnmuteReporter> | $Typed<ModEventEmail> | $Typed<ModEventResolveAppeal> | $Typed<ModEventDivert> | $Typed<ModEventTag> | $Typed<AccountEvent> | $Typed<IdentityEvent> | $Typed<RecordEvent> | $Typed<ModEventPriorityScore> | $Typed<AgeAssuranceEvent> | $Typed<AgeAssuranceOverrideEvent> | $Typed<RevokeAccountCredentialsEvent> | $Typed<ScheduleTakedownEvent> | $Typed<CancelScheduledTakedownEvent> | {
        $type: string;
    };
    subject: $Typed<RepoView> | $Typed<RepoViewNotFound> | $Typed<RecordView> | $Typed<RecordViewNotFound> | {
        $type: string;
    };
    subjectBlobs: BlobView[];
    createdBy: string;
    createdAt: string;
    modTool?: ModTool;
}
export declare function isModEventViewDetail<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventViewDetail">;
export declare function validateModEventViewDetail<V>(v: V): ValidationResult<ModEventViewDetail & V>;
export interface SubjectStatusView {
    $type?: 'tools.ozone.moderation.defs#subjectStatusView';
    id: number;
    subject: $Typed<ComAtprotoAdminDefs.RepoRef> | $Typed<ComAtprotoRepoStrongRef.Main> | $Typed<ChatBskyConvoDefs.MessageRef> | {
        $type: string;
    };
    hosting?: $Typed<AccountHosting> | $Typed<RecordHosting> | {
        $type: string;
    };
    subjectBlobCids?: string[];
    subjectRepoHandle?: string;
    /** Timestamp referencing when the last update was made to the moderation status of the subject */
    updatedAt: string;
    /** Timestamp referencing the first moderation status impacting event was emitted on the subject */
    createdAt: string;
    reviewState: SubjectReviewState;
    /** Sticky comment on the subject. */
    comment?: string;
    /** Numeric value representing the level of priority. Higher score means higher priority. */
    priorityScore?: number;
    muteUntil?: string;
    muteReportingUntil?: string;
    lastReviewedBy?: string;
    lastReviewedAt?: string;
    lastReportedAt?: string;
    /** Timestamp referencing when the author of the subject appealed a moderation action */
    lastAppealedAt?: string;
    takendown?: boolean;
    /** True indicates that the a previously taken moderator action was appealed against, by the author of the content. False indicates last appeal was resolved by moderators. */
    appealed?: boolean;
    suspendUntil?: string;
    tags?: string[];
    accountStats?: AccountStats;
    recordsStats?: RecordsStats;
    accountStrike?: AccountStrike;
    /** Current age assurance state of the subject. */
    ageAssuranceState?: 'pending' | 'assured' | 'unknown' | 'reset' | 'blocked' | (string & {});
    /** Whether or not the last successful update to age assurance was made by the user or admin. */
    ageAssuranceUpdatedBy?: 'admin' | 'user' | (string & {});
}
export declare function isSubjectStatusView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "subjectStatusView">;
export declare function validateSubjectStatusView<V>(v: V): ValidationResult<SubjectStatusView & V>;
/** Detailed view of a subject. For record subjects, the author's repo and profile will be returned. */
export interface SubjectView {
    $type?: 'tools.ozone.moderation.defs#subjectView';
    type: ComAtprotoModerationDefs.SubjectType;
    subject: string;
    status?: SubjectStatusView;
    repo?: RepoViewDetail;
    profile?: {
        $type: string;
    };
    record?: RecordViewDetail;
}
export declare function isSubjectView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "subjectView">;
export declare function validateSubjectView<V>(v: V): ValidationResult<SubjectView & V>;
/** Statistics about a particular account subject */
export interface AccountStats {
    $type?: 'tools.ozone.moderation.defs#accountStats';
    /** Total number of reports on the account */
    reportCount?: number;
    /** Total number of appeals against a moderation action on the account */
    appealCount?: number;
    /** Number of times the account was suspended */
    suspendCount?: number;
    /** Number of times the account was escalated */
    escalateCount?: number;
    /** Number of times the account was taken down */
    takedownCount?: number;
}
export declare function isAccountStats<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "accountStats">;
export declare function validateAccountStats<V>(v: V): ValidationResult<AccountStats & V>;
/** Statistics about a set of record subject items */
export interface RecordsStats {
    $type?: 'tools.ozone.moderation.defs#recordsStats';
    /** Cumulative sum of the number of reports on the items in the set */
    totalReports?: number;
    /** Number of items that were reported at least once */
    reportedCount?: number;
    /** Number of items that were escalated at least once */
    escalatedCount?: number;
    /** Number of items that were appealed at least once */
    appealedCount?: number;
    /** Total number of item in the set */
    subjectCount?: number;
    /** Number of item currently in "reviewOpen" or "reviewEscalated" state */
    pendingCount?: number;
    /** Number of item currently in "reviewNone" or "reviewClosed" state */
    processedCount?: number;
    /** Number of item currently taken down */
    takendownCount?: number;
}
export declare function isRecordsStats<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordsStats">;
export declare function validateRecordsStats<V>(v: V): ValidationResult<RecordsStats & V>;
/** Strike information for an account */
export interface AccountStrike {
    $type?: 'tools.ozone.moderation.defs#accountStrike';
    /** Current number of active strikes (excluding expired strikes) */
    activeStrikeCount?: number;
    /** Total number of strikes ever received (including expired strikes) */
    totalStrikeCount?: number;
    /** Timestamp of the first strike received */
    firstStrikeAt?: string;
    /** Timestamp of the most recent strike received */
    lastStrikeAt?: string;
}
export declare function isAccountStrike<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "accountStrike">;
export declare function validateAccountStrike<V>(v: V): ValidationResult<AccountStrike & V>;
export type SubjectReviewState = 'tools.ozone.moderation.defs#reviewOpen' | 'tools.ozone.moderation.defs#reviewEscalated' | 'tools.ozone.moderation.defs#reviewClosed' | 'tools.ozone.moderation.defs#reviewNone' | (string & {});
/** Moderator review status of a subject: Open. Indicates that the subject needs to be reviewed by a moderator */
export declare const REVIEWOPEN = "tools.ozone.moderation.defs#reviewOpen";
/** Moderator review status of a subject: Escalated. Indicates that the subject was escalated for review by a moderator */
export declare const REVIEWESCALATED = "tools.ozone.moderation.defs#reviewEscalated";
/** Moderator review status of a subject: Closed. Indicates that the subject was already reviewed and resolved by a moderator */
export declare const REVIEWCLOSED = "tools.ozone.moderation.defs#reviewClosed";
/** Moderator review status of a subject: Unnecessary. Indicates that the subject does not need a review at the moment but there is probably some moderation related metadata available for it */
export declare const REVIEWNONE = "tools.ozone.moderation.defs#reviewNone";
/** Take down a subject permanently or temporarily */
export interface ModEventTakedown {
    $type?: 'tools.ozone.moderation.defs#modEventTakedown';
    comment?: string;
    /** Indicates how long the takedown should be in effect before automatically expiring. */
    durationInHours?: number;
    /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
    acknowledgeAccountSubjects?: boolean;
    /** Names/Keywords of the policies that drove the decision. */
    policies?: string[];
    /** Severity level of the violation (e.g., 'sev-0', 'sev-1', 'sev-2', etc.). */
    severityLevel?: string;
    /** List of services where the takedown should be applied. If empty or not provided, takedown is applied on all configured services. */
    targetServices?: ('appview' | 'pds' | (string & {}))[];
    /** Number of strikes to assign to the user for this violation. */
    strikeCount?: number;
    /** When the strike should expire. If not provided, the strike never expires. */
    strikeExpiresAt?: string;
}
export declare function isModEventTakedown<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventTakedown">;
export declare function validateModEventTakedown<V>(v: V): ValidationResult<ModEventTakedown & V>;
/** Revert take down action on a subject */
export interface ModEventReverseTakedown {
    $type?: 'tools.ozone.moderation.defs#modEventReverseTakedown';
    /** Describe reasoning behind the reversal. */
    comment?: string;
    /** Names/Keywords of the policy infraction for which takedown is being reversed. */
    policies?: string[];
    /** Severity level of the violation. Usually set from the last policy infraction's severity. */
    severityLevel?: string;
    /** Number of strikes to subtract from the user's strike count. Usually set from the last policy infraction's severity. */
    strikeCount?: number;
}
export declare function isModEventReverseTakedown<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventReverseTakedown">;
export declare function validateModEventReverseTakedown<V>(v: V): ValidationResult<ModEventReverseTakedown & V>;
/** Resolve appeal on a subject */
export interface ModEventResolveAppeal {
    $type?: 'tools.ozone.moderation.defs#modEventResolveAppeal';
    /** Describe resolution. */
    comment?: string;
}
export declare function isModEventResolveAppeal<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventResolveAppeal">;
export declare function validateModEventResolveAppeal<V>(v: V): ValidationResult<ModEventResolveAppeal & V>;
/** Add a comment to a subject. An empty comment will clear any previously set sticky comment. */
export interface ModEventComment {
    $type?: 'tools.ozone.moderation.defs#modEventComment';
    comment?: string;
    /** Make the comment persistent on the subject */
    sticky?: boolean;
}
export declare function isModEventComment<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventComment">;
export declare function validateModEventComment<V>(v: V): ValidationResult<ModEventComment & V>;
/** Report a subject */
export interface ModEventReport {
    $type?: 'tools.ozone.moderation.defs#modEventReport';
    comment?: string;
    /** Set to true if the reporter was muted from reporting at the time of the event. These reports won't impact the reviewState of the subject. */
    isReporterMuted?: boolean;
    reportType: ComAtprotoModerationDefs.ReasonType;
}
export declare function isModEventReport<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventReport">;
export declare function validateModEventReport<V>(v: V): ValidationResult<ModEventReport & V>;
/** Apply/Negate labels on a subject */
export interface ModEventLabel {
    $type?: 'tools.ozone.moderation.defs#modEventLabel';
    comment?: string;
    createLabelVals: string[];
    negateLabelVals: string[];
    /** Indicates how long the label will remain on the subject. Only applies on labels that are being added. */
    durationInHours?: number;
}
export declare function isModEventLabel<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventLabel">;
export declare function validateModEventLabel<V>(v: V): ValidationResult<ModEventLabel & V>;
/** Set priority score of the subject. Higher score means higher priority. */
export interface ModEventPriorityScore {
    $type?: 'tools.ozone.moderation.defs#modEventPriorityScore';
    comment?: string;
    score: number;
}
export declare function isModEventPriorityScore<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventPriorityScore">;
export declare function validateModEventPriorityScore<V>(v: V): ValidationResult<ModEventPriorityScore & V>;
/** Age assurance info coming directly from users. Only works on DID subjects. */
export interface AgeAssuranceEvent {
    $type?: 'tools.ozone.moderation.defs#ageAssuranceEvent';
    /** The date and time of this write operation. */
    createdAt: string;
    /** The unique identifier for this instance of the age assurance flow, in UUID format. */
    attemptId: string;
    /** The status of the Age Assurance process. */
    status: 'unknown' | 'pending' | 'assured' | (string & {});
    access?: AppBskyAgeassuranceDefs.Access;
    /** The ISO 3166-1 alpha-2 country code provided when beginning the Age Assurance flow. */
    countryCode?: string;
    /** The ISO 3166-2 region code provided when beginning the Age Assurance flow. */
    regionCode?: string;
    /** The IP address used when initiating the AA flow. */
    initIp?: string;
    /** The user agent used when initiating the AA flow. */
    initUa?: string;
    /** The IP address used when completing the AA flow. */
    completeIp?: string;
    /** The user agent used when completing the AA flow. */
    completeUa?: string;
}
export declare function isAgeAssuranceEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "ageAssuranceEvent">;
export declare function validateAgeAssuranceEvent<V>(v: V): ValidationResult<AgeAssuranceEvent & V>;
/** Age assurance status override by moderators. Only works on DID subjects. */
export interface AgeAssuranceOverrideEvent {
    $type?: 'tools.ozone.moderation.defs#ageAssuranceOverrideEvent';
    /** The status to be set for the user decided by a moderator, overriding whatever value the user had previously. Use reset to default to original state. */
    status: 'assured' | 'reset' | 'blocked' | (string & {});
    access?: AppBskyAgeassuranceDefs.Access;
    /** Comment describing the reason for the override. */
    comment: string;
}
export declare function isAgeAssuranceOverrideEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "ageAssuranceOverrideEvent">;
export declare function validateAgeAssuranceOverrideEvent<V>(v: V): ValidationResult<AgeAssuranceOverrideEvent & V>;
/** Account credentials revocation by moderators. Only works on DID subjects. */
export interface RevokeAccountCredentialsEvent {
    $type?: 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent';
    /** Comment describing the reason for the revocation. */
    comment: string;
}
export declare function isRevokeAccountCredentialsEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "revokeAccountCredentialsEvent">;
export declare function validateRevokeAccountCredentialsEvent<V>(v: V): ValidationResult<RevokeAccountCredentialsEvent & V>;
export interface ModEventAcknowledge {
    $type?: 'tools.ozone.moderation.defs#modEventAcknowledge';
    comment?: string;
    /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
    acknowledgeAccountSubjects?: boolean;
}
export declare function isModEventAcknowledge<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventAcknowledge">;
export declare function validateModEventAcknowledge<V>(v: V): ValidationResult<ModEventAcknowledge & V>;
export interface ModEventEscalate {
    $type?: 'tools.ozone.moderation.defs#modEventEscalate';
    comment?: string;
}
export declare function isModEventEscalate<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventEscalate">;
export declare function validateModEventEscalate<V>(v: V): ValidationResult<ModEventEscalate & V>;
/** Mute incoming reports on a subject */
export interface ModEventMute {
    $type?: 'tools.ozone.moderation.defs#modEventMute';
    comment?: string;
    /** Indicates how long the subject should remain muted. */
    durationInHours: number;
}
export declare function isModEventMute<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventMute">;
export declare function validateModEventMute<V>(v: V): ValidationResult<ModEventMute & V>;
/** Unmute action on a subject */
export interface ModEventUnmute {
    $type?: 'tools.ozone.moderation.defs#modEventUnmute';
    /** Describe reasoning behind the reversal. */
    comment?: string;
}
export declare function isModEventUnmute<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventUnmute">;
export declare function validateModEventUnmute<V>(v: V): ValidationResult<ModEventUnmute & V>;
/** Mute incoming reports from an account */
export interface ModEventMuteReporter {
    $type?: 'tools.ozone.moderation.defs#modEventMuteReporter';
    comment?: string;
    /** Indicates how long the account should remain muted. Falsy value here means a permanent mute. */
    durationInHours?: number;
}
export declare function isModEventMuteReporter<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventMuteReporter">;
export declare function validateModEventMuteReporter<V>(v: V): ValidationResult<ModEventMuteReporter & V>;
/** Unmute incoming reports from an account */
export interface ModEventUnmuteReporter {
    $type?: 'tools.ozone.moderation.defs#modEventUnmuteReporter';
    /** Describe reasoning behind the reversal. */
    comment?: string;
}
export declare function isModEventUnmuteReporter<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventUnmuteReporter">;
export declare function validateModEventUnmuteReporter<V>(v: V): ValidationResult<ModEventUnmuteReporter & V>;
/** Keep a log of outgoing email to a user */
export interface ModEventEmail {
    $type?: 'tools.ozone.moderation.defs#modEventEmail';
    /** The subject line of the email sent to the user. */
    subjectLine: string;
    /** The content of the email sent to the user. */
    content?: string;
    /** Additional comment about the outgoing comm. */
    comment?: string;
    /** Names/Keywords of the policies that necessitated the email. */
    policies?: string[];
    /** Severity level of the violation. Normally 'sev-1' that adds strike on repeat offense */
    severityLevel?: string;
    /** Number of strikes to assign to the user for this violation. Normally 0 as an indicator of a warning and only added as a strike on a repeat offense. */
    strikeCount?: number;
    /** When the strike should expire. If not provided, the strike never expires. */
    strikeExpiresAt?: string;
    /** Indicates whether the email was successfully delivered to the user's inbox. */
    isDelivered?: boolean;
}
export declare function isModEventEmail<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventEmail">;
export declare function validateModEventEmail<V>(v: V): ValidationResult<ModEventEmail & V>;
/** Divert a record's blobs to a 3rd party service for further scanning/tagging */
export interface ModEventDivert {
    $type?: 'tools.ozone.moderation.defs#modEventDivert';
    comment?: string;
}
export declare function isModEventDivert<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventDivert">;
export declare function validateModEventDivert<V>(v: V): ValidationResult<ModEventDivert & V>;
/** Add/Remove a tag on a subject */
export interface ModEventTag {
    $type?: 'tools.ozone.moderation.defs#modEventTag';
    /** Tags to be added to the subject. If already exists, won't be duplicated. */
    add: string[];
    /** Tags to be removed to the subject. Ignores a tag If it doesn't exist, won't be duplicated. */
    remove: string[];
    /** Additional comment about added/removed tags. */
    comment?: string;
}
export declare function isModEventTag<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modEventTag">;
export declare function validateModEventTag<V>(v: V): ValidationResult<ModEventTag & V>;
/** Logs account status related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface AccountEvent {
    $type?: 'tools.ozone.moderation.defs#accountEvent';
    comment?: string;
    /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
    active: boolean;
    status?: 'unknown' | 'deactivated' | 'deleted' | 'takendown' | 'suspended' | 'tombstoned' | (string & {});
    timestamp: string;
}
export declare function isAccountEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "accountEvent">;
export declare function validateAccountEvent<V>(v: V): ValidationResult<AccountEvent & V>;
/** Logs identity related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface IdentityEvent {
    $type?: 'tools.ozone.moderation.defs#identityEvent';
    comment?: string;
    handle?: string;
    pdsHost?: string;
    tombstone?: boolean;
    timestamp: string;
}
export declare function isIdentityEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "identityEvent">;
export declare function validateIdentityEvent<V>(v: V): ValidationResult<IdentityEvent & V>;
/** Logs lifecycle event on a record subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface RecordEvent {
    $type?: 'tools.ozone.moderation.defs#recordEvent';
    comment?: string;
    op: 'create' | 'update' | 'delete' | (string & {});
    cid?: string;
    timestamp: string;
}
export declare function isRecordEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordEvent">;
export declare function validateRecordEvent<V>(v: V): ValidationResult<RecordEvent & V>;
/** Logs a scheduled takedown action for an account. */
export interface ScheduleTakedownEvent {
    $type?: 'tools.ozone.moderation.defs#scheduleTakedownEvent';
    comment?: string;
    executeAt?: string;
    executeAfter?: string;
    executeUntil?: string;
}
export declare function isScheduleTakedownEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "scheduleTakedownEvent">;
export declare function validateScheduleTakedownEvent<V>(v: V): ValidationResult<ScheduleTakedownEvent & V>;
/** Logs cancellation of a scheduled takedown action for an account. */
export interface CancelScheduledTakedownEvent {
    $type?: 'tools.ozone.moderation.defs#cancelScheduledTakedownEvent';
    comment?: string;
}
export declare function isCancelScheduledTakedownEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "cancelScheduledTakedownEvent">;
export declare function validateCancelScheduledTakedownEvent<V>(v: V): ValidationResult<CancelScheduledTakedownEvent & V>;
export interface RepoView {
    $type?: 'tools.ozone.moderation.defs#repoView';
    did: string;
    handle: string;
    email?: string;
    relatedRecords: {
        [_ in string]: unknown;
    }[];
    indexedAt: string;
    moderation: Moderation;
    invitedBy?: ComAtprotoServerDefs.InviteCode;
    invitesDisabled?: boolean;
    inviteNote?: string;
    deactivatedAt?: string;
    threatSignatures?: ComAtprotoAdminDefs.ThreatSignature[];
}
export declare function isRepoView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "repoView">;
export declare function validateRepoView<V>(v: V): ValidationResult<RepoView & V>;
export interface RepoViewDetail {
    $type?: 'tools.ozone.moderation.defs#repoViewDetail';
    did: string;
    handle: string;
    email?: string;
    relatedRecords: {
        [_ in string]: unknown;
    }[];
    indexedAt: string;
    moderation: ModerationDetail;
    labels?: ComAtprotoLabelDefs.Label[];
    invitedBy?: ComAtprotoServerDefs.InviteCode;
    invites?: ComAtprotoServerDefs.InviteCode[];
    invitesDisabled?: boolean;
    inviteNote?: string;
    emailConfirmedAt?: string;
    deactivatedAt?: string;
    threatSignatures?: ComAtprotoAdminDefs.ThreatSignature[];
}
export declare function isRepoViewDetail<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "repoViewDetail">;
export declare function validateRepoViewDetail<V>(v: V): ValidationResult<RepoViewDetail & V>;
export interface RepoViewNotFound {
    $type?: 'tools.ozone.moderation.defs#repoViewNotFound';
    did: string;
}
export declare function isRepoViewNotFound<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "repoViewNotFound">;
export declare function validateRepoViewNotFound<V>(v: V): ValidationResult<RepoViewNotFound & V>;
export interface RecordView {
    $type?: 'tools.ozone.moderation.defs#recordView';
    uri: string;
    cid: string;
    value: {
        [_ in string]: unknown;
    };
    blobCids: string[];
    indexedAt: string;
    moderation: Moderation;
    repo: RepoView;
}
export declare function isRecordView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordView">;
export declare function validateRecordView<V>(v: V): ValidationResult<RecordView & V>;
export interface RecordViewDetail {
    $type?: 'tools.ozone.moderation.defs#recordViewDetail';
    uri: string;
    cid: string;
    value: {
        [_ in string]: unknown;
    };
    blobs: BlobView[];
    labels?: ComAtprotoLabelDefs.Label[];
    indexedAt: string;
    moderation: ModerationDetail;
    repo: RepoView;
}
export declare function isRecordViewDetail<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordViewDetail">;
export declare function validateRecordViewDetail<V>(v: V): ValidationResult<RecordViewDetail & V>;
export interface RecordViewNotFound {
    $type?: 'tools.ozone.moderation.defs#recordViewNotFound';
    uri: string;
}
export declare function isRecordViewNotFound<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordViewNotFound">;
export declare function validateRecordViewNotFound<V>(v: V): ValidationResult<RecordViewNotFound & V>;
export interface Moderation {
    $type?: 'tools.ozone.moderation.defs#moderation';
    subjectStatus?: SubjectStatusView;
}
export declare function isModeration<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "moderation">;
export declare function validateModeration<V>(v: V): ValidationResult<Moderation & V>;
export interface ModerationDetail {
    $type?: 'tools.ozone.moderation.defs#moderationDetail';
    subjectStatus?: SubjectStatusView;
}
export declare function isModerationDetail<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "moderationDetail">;
export declare function validateModerationDetail<V>(v: V): ValidationResult<ModerationDetail & V>;
export interface BlobView {
    $type?: 'tools.ozone.moderation.defs#blobView';
    cid: string;
    mimeType: string;
    size: number;
    createdAt: string;
    details?: $Typed<ImageDetails> | $Typed<VideoDetails> | {
        $type: string;
    };
    moderation?: Moderation;
}
export declare function isBlobView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "blobView">;
export declare function validateBlobView<V>(v: V): ValidationResult<BlobView & V>;
export interface ImageDetails {
    $type?: 'tools.ozone.moderation.defs#imageDetails';
    width: number;
    height: number;
}
export declare function isImageDetails<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "imageDetails">;
export declare function validateImageDetails<V>(v: V): ValidationResult<ImageDetails & V>;
export interface VideoDetails {
    $type?: 'tools.ozone.moderation.defs#videoDetails';
    width: number;
    height: number;
    length: number;
}
export declare function isVideoDetails<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "videoDetails">;
export declare function validateVideoDetails<V>(v: V): ValidationResult<VideoDetails & V>;
export interface AccountHosting {
    $type?: 'tools.ozone.moderation.defs#accountHosting';
    status: 'takendown' | 'suspended' | 'deleted' | 'deactivated' | 'unknown' | (string & {});
    updatedAt?: string;
    createdAt?: string;
    deletedAt?: string;
    deactivatedAt?: string;
    reactivatedAt?: string;
}
export declare function isAccountHosting<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "accountHosting">;
export declare function validateAccountHosting<V>(v: V): ValidationResult<AccountHosting & V>;
export interface RecordHosting {
    $type?: 'tools.ozone.moderation.defs#recordHosting';
    status: 'deleted' | 'unknown' | (string & {});
    updatedAt?: string;
    createdAt?: string;
    deletedAt?: string;
}
export declare function isRecordHosting<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "recordHosting">;
export declare function validateRecordHosting<V>(v: V): ValidationResult<RecordHosting & V>;
export interface ReporterStats {
    $type?: 'tools.ozone.moderation.defs#reporterStats';
    did: string;
    /** The total number of reports made by the user on accounts. */
    accountReportCount: number;
    /** The total number of reports made by the user on records. */
    recordReportCount: number;
    /** The total number of accounts reported by the user. */
    reportedAccountCount: number;
    /** The total number of records reported by the user. */
    reportedRecordCount: number;
    /** The total number of accounts taken down as a result of the user's reports. */
    takendownAccountCount: number;
    /** The total number of records taken down as a result of the user's reports. */
    takendownRecordCount: number;
    /** The total number of accounts labeled as a result of the user's reports. */
    labeledAccountCount: number;
    /** The total number of records labeled as a result of the user's reports. */
    labeledRecordCount: number;
}
export declare function isReporterStats<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "reporterStats">;
export declare function validateReporterStats<V>(v: V): ValidationResult<ReporterStats & V>;
/** Moderation tool information for tracing the source of the action */
export interface ModTool {
    $type?: 'tools.ozone.moderation.defs#modTool';
    /** Name/identifier of the source (e.g., 'automod', 'ozone/workspace') */
    name: string;
    /** Additional arbitrary metadata about the source */
    meta?: {
        [_ in string]: unknown;
    };
}
export declare function isModTool<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "modTool">;
export declare function validateModTool<V>(v: V): ValidationResult<ModTool & V>;
/** Moderation event timeline event for a PLC create operation */
export declare const TIMELINEEVENTPLCCREATE = "tools.ozone.moderation.defs#timelineEventPlcCreate";
/** Moderation event timeline event for generic PLC operation */
export declare const TIMELINEEVENTPLCOPERATION = "tools.ozone.moderation.defs#timelineEventPlcOperation";
/** Moderation event timeline event for a PLC tombstone operation */
export declare const TIMELINEEVENTPLCTOMBSTONE = "tools.ozone.moderation.defs#timelineEventPlcTombstone";
/** View of a scheduled moderation action */
export interface ScheduledActionView {
    $type?: 'tools.ozone.moderation.defs#scheduledActionView';
    /** Auto-incrementing row ID */
    id: number;
    /** Type of action to be executed */
    action: 'takedown' | (string & {});
    /** Serialized event object that will be propagated to the event when performed */
    eventData?: {
        [_ in string]: unknown;
    };
    /** Subject DID for the action */
    did: string;
    /** Exact time to execute the action */
    executeAt?: string;
    /** Earliest time to execute the action (for randomized scheduling) */
    executeAfter?: string;
    /** Latest time to execute the action (for randomized scheduling) */
    executeUntil?: string;
    /** Whether execution time should be randomized within the specified range */
    randomizeExecution?: boolean;
    /** DID of the user who created this scheduled action */
    createdBy: string;
    /** When the scheduled action was created */
    createdAt: string;
    /** When the scheduled action was last updated */
    updatedAt?: string;
    /** Current status of the scheduled action */
    status: 'pending' | 'executed' | 'cancelled' | 'failed' | (string & {});
    /** When the action was last attempted to be executed */
    lastExecutedAt?: string;
    /** Reason for the last execution failure */
    lastFailureReason?: string;
    /** ID of the moderation event created when action was successfully executed */
    executionEventId?: number;
}
export declare function isScheduledActionView<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.moderation.defs", "scheduledActionView">;
export declare function validateScheduledActionView<V>(v: V): ValidationResult<ScheduledActionView & V>;
//# sourceMappingURL=defs.d.ts.map