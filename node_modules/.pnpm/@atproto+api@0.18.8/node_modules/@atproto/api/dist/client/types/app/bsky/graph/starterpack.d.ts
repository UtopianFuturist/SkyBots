/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import type * as AppBskyRichtextFacet from '../richtext/facet.js';
export interface Main {
    $type: 'app.bsky.graph.starterpack';
    /** Display name for starter pack; can not be empty. */
    name: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    /** Reference (AT-URI) to the list record. */
    list: string;
    feeds?: FeedItem[];
    createdAt: string;
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.graph.starterpack", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
export interface FeedItem {
    $type?: 'app.bsky.graph.starterpack#feedItem';
    uri: string;
}
export declare function isFeedItem<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.graph.starterpack", "feedItem">;
export declare function validateFeedItem<V>(v: V): ValidationResult<FeedItem & V>;
//# sourceMappingURL=starterpack.d.ts.map