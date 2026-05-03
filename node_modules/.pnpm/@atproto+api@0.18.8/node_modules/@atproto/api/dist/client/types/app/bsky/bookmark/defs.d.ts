/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js';
import type * as AppBskyFeedDefs from '../feed/defs.js';
/** Object used to store bookmark data in stash. */
export interface Bookmark {
    $type?: 'app.bsky.bookmark.defs#bookmark';
    subject: ComAtprotoRepoStrongRef.Main;
}
export declare function isBookmark<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.bookmark.defs", "bookmark">;
export declare function validateBookmark<V>(v: V): ValidationResult<Bookmark & V>;
export interface BookmarkView {
    $type?: 'app.bsky.bookmark.defs#bookmarkView';
    subject: ComAtprotoRepoStrongRef.Main;
    createdAt?: string;
    item: $Typed<AppBskyFeedDefs.BlockedPost> | $Typed<AppBskyFeedDefs.NotFoundPost> | $Typed<AppBskyFeedDefs.PostView> | {
        $type: string;
    };
}
export declare function isBookmarkView<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.bookmark.defs", "bookmarkView">;
export declare function validateBookmarkView<V>(v: V): ValidationResult<BookmarkView & V>;
//# sourceMappingURL=defs.d.ts.map