/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js';
export interface Main {
    $type: 'app.bsky.feed.repost';
    subject: ComAtprotoRepoStrongRef.Main;
    createdAt: string;
    via?: ComAtprotoRepoStrongRef.Main;
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.feed.repost", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
//# sourceMappingURL=repost.d.ts.map