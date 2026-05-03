/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import type * as AppBskyActorDefs from '../actor/defs.js';
import type * as AppBskyFeedDefs from '../feed/defs.js';
export interface SkeletonSearchPost {
    $type?: 'app.bsky.unspecced.defs#skeletonSearchPost';
    uri: string;
}
export declare function isSkeletonSearchPost<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "skeletonSearchPost">;
export declare function validateSkeletonSearchPost<V>(v: V): ValidationResult<SkeletonSearchPost & V>;
export interface SkeletonSearchActor {
    $type?: 'app.bsky.unspecced.defs#skeletonSearchActor';
    did: string;
}
export declare function isSkeletonSearchActor<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "skeletonSearchActor">;
export declare function validateSkeletonSearchActor<V>(v: V): ValidationResult<SkeletonSearchActor & V>;
export interface SkeletonSearchStarterPack {
    $type?: 'app.bsky.unspecced.defs#skeletonSearchStarterPack';
    uri: string;
}
export declare function isSkeletonSearchStarterPack<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "skeletonSearchStarterPack">;
export declare function validateSkeletonSearchStarterPack<V>(v: V): ValidationResult<SkeletonSearchStarterPack & V>;
export interface TrendingTopic {
    $type?: 'app.bsky.unspecced.defs#trendingTopic';
    topic: string;
    displayName?: string;
    description?: string;
    link: string;
}
export declare function isTrendingTopic<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "trendingTopic">;
export declare function validateTrendingTopic<V>(v: V): ValidationResult<TrendingTopic & V>;
export interface SkeletonTrend {
    $type?: 'app.bsky.unspecced.defs#skeletonTrend';
    topic: string;
    displayName: string;
    link: string;
    startedAt: string;
    postCount: number;
    status?: 'hot' | (string & {});
    category?: string;
    dids: string[];
}
export declare function isSkeletonTrend<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "skeletonTrend">;
export declare function validateSkeletonTrend<V>(v: V): ValidationResult<SkeletonTrend & V>;
export interface TrendView {
    $type?: 'app.bsky.unspecced.defs#trendView';
    topic: string;
    displayName: string;
    link: string;
    startedAt: string;
    postCount: number;
    status?: 'hot' | (string & {});
    category?: string;
    actors: AppBskyActorDefs.ProfileViewBasic[];
}
export declare function isTrendView<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "trendView">;
export declare function validateTrendView<V>(v: V): ValidationResult<TrendView & V>;
export interface ThreadItemPost {
    $type?: 'app.bsky.unspecced.defs#threadItemPost';
    post: AppBskyFeedDefs.PostView;
    /** This post has more parents that were not present in the response. This is just a boolean, without the number of parents. */
    moreParents: boolean;
    /** This post has more replies that were not present in the response. This is a numeric value, which is best-effort and might not be accurate. */
    moreReplies: number;
    /** This post is part of a contiguous thread by the OP from the thread root. Many different OP threads can happen in the same thread. */
    opThread: boolean;
    /** The threadgate created by the author indicates this post as a reply to be hidden for everyone consuming the thread. */
    hiddenByThreadgate: boolean;
    /** This is by an account muted by the viewer requesting it. */
    mutedByViewer: boolean;
}
export declare function isThreadItemPost<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "threadItemPost">;
export declare function validateThreadItemPost<V>(v: V): ValidationResult<ThreadItemPost & V>;
export interface ThreadItemNoUnauthenticated {
    $type?: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated';
}
export declare function isThreadItemNoUnauthenticated<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "threadItemNoUnauthenticated">;
export declare function validateThreadItemNoUnauthenticated<V>(v: V): ValidationResult<ThreadItemNoUnauthenticated & V>;
export interface ThreadItemNotFound {
    $type?: 'app.bsky.unspecced.defs#threadItemNotFound';
}
export declare function isThreadItemNotFound<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "threadItemNotFound">;
export declare function validateThreadItemNotFound<V>(v: V): ValidationResult<ThreadItemNotFound & V>;
export interface ThreadItemBlocked {
    $type?: 'app.bsky.unspecced.defs#threadItemBlocked';
    author: AppBskyFeedDefs.BlockedAuthor;
}
export declare function isThreadItemBlocked<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "threadItemBlocked">;
export declare function validateThreadItemBlocked<V>(v: V): ValidationResult<ThreadItemBlocked & V>;
/** The computed state of the age assurance process, returned to the user in question on certain authenticated requests. */
export interface AgeAssuranceState {
    $type?: 'app.bsky.unspecced.defs#ageAssuranceState';
    /** The timestamp when this state was last updated. */
    lastInitiatedAt?: string;
    /** The status of the age assurance process. */
    status: 'unknown' | 'pending' | 'assured' | 'blocked' | (string & {});
}
export declare function isAgeAssuranceState<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "ageAssuranceState">;
export declare function validateAgeAssuranceState<V>(v: V): ValidationResult<AgeAssuranceState & V>;
/** Object used to store age assurance data in stash. */
export interface AgeAssuranceEvent {
    $type?: 'app.bsky.unspecced.defs#ageAssuranceEvent';
    /** The date and time of this write operation. */
    createdAt: string;
    /** The status of the age assurance process. */
    status: 'unknown' | 'pending' | 'assured' | (string & {});
    /** The unique identifier for this instance of the age assurance flow, in UUID format. */
    attemptId: string;
    /** The email used for AA. */
    email?: string;
    /** The IP address used when initiating the AA flow. */
    initIp?: string;
    /** The user agent used when initiating the AA flow. */
    initUa?: string;
    /** The IP address used when completing the AA flow. */
    completeIp?: string;
    /** The user agent used when completing the AA flow. */
    completeUa?: string;
}
export declare function isAgeAssuranceEvent<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.defs", "ageAssuranceEvent">;
export declare function validateAgeAssuranceEvent<V>(v: V): ValidationResult<AgeAssuranceEvent & V>;
//# sourceMappingURL=defs.d.ts.map