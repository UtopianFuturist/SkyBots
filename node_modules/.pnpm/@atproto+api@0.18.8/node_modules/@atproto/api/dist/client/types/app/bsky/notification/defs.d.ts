/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
export interface RecordDeleted {
    $type?: 'app.bsky.notification.defs#recordDeleted';
}
export declare function isRecordDeleted<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "recordDeleted">;
export declare function validateRecordDeleted<V>(v: V): ValidationResult<RecordDeleted & V>;
export interface ChatPreference {
    $type?: 'app.bsky.notification.defs#chatPreference';
    include: 'all' | 'accepted' | (string & {});
    push: boolean;
}
export declare function isChatPreference<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "chatPreference">;
export declare function validateChatPreference<V>(v: V): ValidationResult<ChatPreference & V>;
export interface FilterablePreference {
    $type?: 'app.bsky.notification.defs#filterablePreference';
    include: 'all' | 'follows' | (string & {});
    list: boolean;
    push: boolean;
}
export declare function isFilterablePreference<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "filterablePreference">;
export declare function validateFilterablePreference<V>(v: V): ValidationResult<FilterablePreference & V>;
export interface Preference {
    $type?: 'app.bsky.notification.defs#preference';
    list: boolean;
    push: boolean;
}
export declare function isPreference<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "preference">;
export declare function validatePreference<V>(v: V): ValidationResult<Preference & V>;
export interface Preferences {
    $type?: 'app.bsky.notification.defs#preferences';
    chat: ChatPreference;
    follow: FilterablePreference;
    like: FilterablePreference;
    likeViaRepost: FilterablePreference;
    mention: FilterablePreference;
    quote: FilterablePreference;
    reply: FilterablePreference;
    repost: FilterablePreference;
    repostViaRepost: FilterablePreference;
    starterpackJoined: Preference;
    subscribedPost: Preference;
    unverified: Preference;
    verified: Preference;
}
export declare function isPreferences<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "preferences">;
export declare function validatePreferences<V>(v: V): ValidationResult<Preferences & V>;
export interface ActivitySubscription {
    $type?: 'app.bsky.notification.defs#activitySubscription';
    post: boolean;
    reply: boolean;
}
export declare function isActivitySubscription<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "activitySubscription">;
export declare function validateActivitySubscription<V>(v: V): ValidationResult<ActivitySubscription & V>;
/** Object used to store activity subscription data in stash. */
export interface SubjectActivitySubscription {
    $type?: 'app.bsky.notification.defs#subjectActivitySubscription';
    subject: string;
    activitySubscription: ActivitySubscription;
}
export declare function isSubjectActivitySubscription<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.defs", "subjectActivitySubscription">;
export declare function validateSubjectActivitySubscription<V>(v: V): ValidationResult<SubjectActivitySubscription & V>;
//# sourceMappingURL=defs.d.ts.map