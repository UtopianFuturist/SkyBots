/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
/** The access level granted based on Age Assurance data we've processed. */
export type Access = 'unknown' | 'none' | 'safe' | 'full' | (string & {});
/** The status of the Age Assurance process. */
export type Status = 'unknown' | 'pending' | 'assured' | 'blocked' | (string & {});
/** The user's computed Age Assurance state. */
export interface State {
    $type?: 'app.bsky.ageassurance.defs#state';
    /** The timestamp when this state was last updated. */
    lastInitiatedAt?: string;
    status: Status;
    access: Access;
}
export declare function isState<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "state">;
export declare function validateState<V>(v: V): ValidationResult<State & V>;
/** Additional metadata needed to compute Age Assurance state client-side. */
export interface StateMetadata {
    $type?: 'app.bsky.ageassurance.defs#stateMetadata';
    /** The account creation timestamp. */
    accountCreatedAt?: string;
}
export declare function isStateMetadata<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "stateMetadata">;
export declare function validateStateMetadata<V>(v: V): ValidationResult<StateMetadata & V>;
export interface Config {
    $type?: 'app.bsky.ageassurance.defs#config';
    /** The per-region Age Assurance configuration. */
    regions: ConfigRegion[];
}
export declare function isConfig<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "config">;
export declare function validateConfig<V>(v: V): ValidationResult<Config & V>;
/** The Age Assurance configuration for a specific region. */
export interface ConfigRegion {
    $type?: 'app.bsky.ageassurance.defs#configRegion';
    /** The ISO 3166-1 alpha-2 country code this configuration applies to. */
    countryCode: string;
    /** The ISO 3166-2 region code this configuration applies to. If omitted, the configuration applies to the entire country. */
    regionCode?: string;
    /** The ordered list of Age Assurance rules that apply to this region. Rules should be applied in order, and the first matching rule determines the access level granted. The rules array should always include a default rule as the last item. */
    rules: ($Typed<ConfigRegionRuleDefault> | $Typed<ConfigRegionRuleIfDeclaredOverAge> | $Typed<ConfigRegionRuleIfDeclaredUnderAge> | $Typed<ConfigRegionRuleIfAssuredOverAge> | $Typed<ConfigRegionRuleIfAssuredUnderAge> | $Typed<ConfigRegionRuleIfAccountNewerThan> | $Typed<ConfigRegionRuleIfAccountOlderThan> | {
        $type: string;
    })[];
}
export declare function isConfigRegion<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegion">;
export declare function validateConfigRegion<V>(v: V): ValidationResult<ConfigRegion & V>;
/** Age Assurance rule that applies by default. */
export interface ConfigRegionRuleDefault {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleDefault';
    access: Access;
}
export declare function isConfigRegionRuleDefault<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleDefault">;
export declare function validateConfigRegionRuleDefault<V>(v: V): ValidationResult<ConfigRegionRuleDefault & V>;
/** Age Assurance rule that applies if the user has declared themselves equal-to or over a certain age. */
export interface ConfigRegionRuleIfDeclaredOverAge {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfDeclaredOverAge';
    /** The age threshold as a whole integer. */
    age: number;
    access: Access;
}
export declare function isConfigRegionRuleIfDeclaredOverAge<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfDeclaredOverAge">;
export declare function validateConfigRegionRuleIfDeclaredOverAge<V>(v: V): ValidationResult<ConfigRegionRuleIfDeclaredOverAge & V>;
/** Age Assurance rule that applies if the user has declared themselves under a certain age. */
export interface ConfigRegionRuleIfDeclaredUnderAge {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfDeclaredUnderAge';
    /** The age threshold as a whole integer. */
    age: number;
    access: Access;
}
export declare function isConfigRegionRuleIfDeclaredUnderAge<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfDeclaredUnderAge">;
export declare function validateConfigRegionRuleIfDeclaredUnderAge<V>(v: V): ValidationResult<ConfigRegionRuleIfDeclaredUnderAge & V>;
/** Age Assurance rule that applies if the user has been assured to be equal-to or over a certain age. */
export interface ConfigRegionRuleIfAssuredOverAge {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAssuredOverAge';
    /** The age threshold as a whole integer. */
    age: number;
    access: Access;
}
export declare function isConfigRegionRuleIfAssuredOverAge<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfAssuredOverAge">;
export declare function validateConfigRegionRuleIfAssuredOverAge<V>(v: V): ValidationResult<ConfigRegionRuleIfAssuredOverAge & V>;
/** Age Assurance rule that applies if the user has been assured to be under a certain age. */
export interface ConfigRegionRuleIfAssuredUnderAge {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAssuredUnderAge';
    /** The age threshold as a whole integer. */
    age: number;
    access: Access;
}
export declare function isConfigRegionRuleIfAssuredUnderAge<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfAssuredUnderAge">;
export declare function validateConfigRegionRuleIfAssuredUnderAge<V>(v: V): ValidationResult<ConfigRegionRuleIfAssuredUnderAge & V>;
/** Age Assurance rule that applies if the account is equal-to or newer than a certain date. */
export interface ConfigRegionRuleIfAccountNewerThan {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAccountNewerThan';
    /** The date threshold as a datetime string. */
    date: string;
    access: Access;
}
export declare function isConfigRegionRuleIfAccountNewerThan<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfAccountNewerThan">;
export declare function validateConfigRegionRuleIfAccountNewerThan<V>(v: V): ValidationResult<ConfigRegionRuleIfAccountNewerThan & V>;
/** Age Assurance rule that applies if the account is older than a certain date. */
export interface ConfigRegionRuleIfAccountOlderThan {
    $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAccountOlderThan';
    /** The date threshold as a datetime string. */
    date: string;
    access: Access;
}
export declare function isConfigRegionRuleIfAccountOlderThan<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "configRegionRuleIfAccountOlderThan">;
export declare function validateConfigRegionRuleIfAccountOlderThan<V>(v: V): ValidationResult<ConfigRegionRuleIfAccountOlderThan & V>;
/** Object used to store Age Assurance data in stash. */
export interface Event {
    $type?: 'app.bsky.ageassurance.defs#event';
    /** The date and time of this write operation. */
    createdAt: string;
    /** The unique identifier for this instance of the Age Assurance flow, in UUID format. */
    attemptId: string;
    /** The status of the Age Assurance process. */
    status: 'unknown' | 'pending' | 'assured' | 'blocked' | (string & {});
    /** The access level granted based on Age Assurance data we've processed. */
    access: 'unknown' | 'none' | 'safe' | 'full' | (string & {});
    /** The ISO 3166-1 alpha-2 country code provided when beginning the Age Assurance flow. */
    countryCode: string;
    /** The ISO 3166-2 region code provided when beginning the Age Assurance flow. */
    regionCode?: string;
    /** The email used for Age Assurance. */
    email?: string;
    /** The IP address used when initiating the Age Assurance flow. */
    initIp?: string;
    /** The user agent used when initiating the Age Assurance flow. */
    initUa?: string;
    /** The IP address used when completing the Age Assurance flow. */
    completeIp?: string;
    /** The user agent used when completing the Age Assurance flow. */
    completeUa?: string;
}
export declare function isEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.ageassurance.defs", "event">;
export declare function validateEvent<V>(v: V): ValidationResult<Event & V>;
//# sourceMappingURL=defs.d.ts.map