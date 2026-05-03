/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import type * as AppBskyNotificationDefs from './defs.js';
export type QueryParams = {};
export interface InputSchema {
    chat?: AppBskyNotificationDefs.ChatPreference;
    follow?: AppBskyNotificationDefs.FilterablePreference;
    like?: AppBskyNotificationDefs.FilterablePreference;
    likeViaRepost?: AppBskyNotificationDefs.FilterablePreference;
    mention?: AppBskyNotificationDefs.FilterablePreference;
    quote?: AppBskyNotificationDefs.FilterablePreference;
    reply?: AppBskyNotificationDefs.FilterablePreference;
    repost?: AppBskyNotificationDefs.FilterablePreference;
    repostViaRepost?: AppBskyNotificationDefs.FilterablePreference;
    starterpackJoined?: AppBskyNotificationDefs.Preference;
    subscribedPost?: AppBskyNotificationDefs.Preference;
    unverified?: AppBskyNotificationDefs.Preference;
    verified?: AppBskyNotificationDefs.Preference;
}
export interface OutputSchema {
    preferences: AppBskyNotificationDefs.Preferences;
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
//# sourceMappingURL=putPreferencesV2.d.ts.map