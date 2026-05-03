/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
export interface Main {
    $type: 'app.bsky.feed.postgate';
    createdAt: string;
    /** Reference (AT-URI) to the post record. */
    post: string;
    /** List of AT-URIs embedding this post that the author has detached from. */
    detachedEmbeddingUris?: string[];
    /** List of rules defining who can embed this post. If value is an empty array or is undefined, no particular rules apply and anyone can embed. */
    embeddingRules?: ($Typed<DisableRule> | {
        $type: string;
    })[];
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.feed.postgate", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
/** Disables embedding of this post. */
export interface DisableRule {
    $type?: 'app.bsky.feed.postgate#disableRule';
}
export declare function isDisableRule<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.feed.postgate", "disableRule">;
export declare function validateDisableRule<V>(v: V): ValidationResult<DisableRule & V>;
//# sourceMappingURL=postgate.d.ts.map