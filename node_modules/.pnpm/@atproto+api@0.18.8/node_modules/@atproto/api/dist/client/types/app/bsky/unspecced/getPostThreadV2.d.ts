/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as AppBskyFeedDefs from '../feed/defs.js';
import type * as AppBskyUnspeccedDefs from './defs.js';
export type QueryParams = {
    /** Reference (AT-URI) to post record. This is the anchor post, and the thread will be built around it. It can be any post in the tree, not necessarily a root post. */
    anchor: string;
    /** Whether to include parents above the anchor. */
    above?: boolean;
    /** How many levels of replies to include below the anchor. */
    below?: number;
    /** Maximum of replies to include at each level of the thread, except for the direct replies to the anchor, which are (NOTE: currently, during unspecced phase) all returned (NOTE: later they might be paginated). */
    branchingFactor?: number;
    /** Sorting for the thread replies. */
    sort?: 'newest' | 'oldest' | 'top' | (string & {});
};
export type InputSchema = undefined;
export interface OutputSchema {
    /** A flat list of thread items. The depth of each item is indicated by the depth property inside the item. */
    thread: ThreadItem[];
    threadgate?: AppBskyFeedDefs.ThreadgateView;
    /** Whether this thread has additional replies. If true, a call can be made to the `getPostThreadOtherV2` endpoint to retrieve them. */
    hasOtherReplies: boolean;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
export interface ThreadItem {
    $type?: 'app.bsky.unspecced.getPostThreadV2#threadItem';
    uri: string;
    /** The nesting level of this item in the thread. Depth 0 means the anchor item. Items above have negative depths, items below have positive depths. */
    depth: number;
    value: $Typed<AppBskyUnspeccedDefs.ThreadItemPost> | $Typed<AppBskyUnspeccedDefs.ThreadItemNoUnauthenticated> | $Typed<AppBskyUnspeccedDefs.ThreadItemNotFound> | $Typed<AppBskyUnspeccedDefs.ThreadItemBlocked> | {
        $type: string;
    };
}
export declare function isThreadItem<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.unspecced.getPostThreadV2", "threadItem">;
export declare function validateThreadItem<V>(v: V): ValidationResult<ThreadItem & V>;
//# sourceMappingURL=getPostThreadV2.d.ts.map