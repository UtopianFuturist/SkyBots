/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import type * as AppBskyActorDefs from '../actor/defs.js';
/** Associates a profile with the positional index of the contact import input in the call to `app.bsky.contact.importContacts`, so clients can know which phone caused a particular match. */
export interface MatchAndContactIndex {
    $type?: 'app.bsky.contact.defs#matchAndContactIndex';
    match: AppBskyActorDefs.ProfileView;
    /** The index of this match in the import contact input. */
    contactIndex: number;
}
export declare function isMatchAndContactIndex<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.contact.defs", "matchAndContactIndex">;
export declare function validateMatchAndContactIndex<V>(v: V): ValidationResult<MatchAndContactIndex & V>;
export interface SyncStatus {
    $type?: 'app.bsky.contact.defs#syncStatus';
    /** Last date when contacts where imported. */
    syncedAt: string;
    /** Number of existing contact matches resulting of the user imports and of their imported contacts having imported the user. Matches stop being counted when the user either follows the matched contact or dismisses the match. */
    matchesCount: number;
}
export declare function isSyncStatus<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.contact.defs", "syncStatus">;
export declare function validateSyncStatus<V>(v: V): ValidationResult<SyncStatus & V>;
/** A stash object to be sent via bsync representing a notification to be created. */
export interface Notification {
    $type?: 'app.bsky.contact.defs#notification';
    /** The DID of who this notification comes from. */
    from: string;
    /** The DID of who this notification should go to. */
    to: string;
}
export declare function isNotification<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.contact.defs", "notification">;
export declare function validateNotification<V>(v: V): ValidationResult<Notification & V>;
//# sourceMappingURL=defs.d.ts.map