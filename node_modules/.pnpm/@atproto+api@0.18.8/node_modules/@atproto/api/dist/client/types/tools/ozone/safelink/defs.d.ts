/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
/** An event for URL safety decisions */
export interface Event {
    $type?: 'tools.ozone.safelink.defs#event';
    /** Auto-incrementing row ID */
    id: number;
    eventType: EventType;
    /** The URL that this rule applies to */
    url: string;
    pattern: PatternType;
    action: ActionType;
    reason: ReasonType;
    /** DID of the user who created this rule */
    createdBy: string;
    createdAt: string;
    /** Optional comment about the decision */
    comment?: string;
}
export declare function isEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.safelink.defs", "event">;
export declare function validateEvent<V>(v: V): ValidationResult<Event & V>;
export type EventType = 'addRule' | 'updateRule' | 'removeRule' | (string & {});
export type PatternType = 'domain' | 'url' | (string & {});
export type ActionType = 'block' | 'warn' | 'whitelist' | (string & {});
export type ReasonType = 'csam' | 'spam' | 'phishing' | 'none' | (string & {});
/** Input for creating a URL safety rule */
export interface UrlRule {
    $type?: 'tools.ozone.safelink.defs#urlRule';
    /** The URL or domain to apply the rule to */
    url: string;
    pattern: PatternType;
    action: ActionType;
    reason: ReasonType;
    /** Optional comment about the decision */
    comment?: string;
    /** DID of the user added the rule. */
    createdBy: string;
    /** Timestamp when the rule was created */
    createdAt: string;
    /** Timestamp when the rule was last updated */
    updatedAt: string;
}
export declare function isUrlRule<V>(v: V): v is import("../../../../util").$TypedObject<V, "tools.ozone.safelink.defs", "urlRule">;
export declare function validateUrlRule<V>(v: V): ValidationResult<UrlRule & V>;
//# sourceMappingURL=defs.d.ts.map