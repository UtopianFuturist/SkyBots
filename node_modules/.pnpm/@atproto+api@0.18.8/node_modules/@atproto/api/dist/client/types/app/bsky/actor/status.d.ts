/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as AppBskyEmbedExternal from '../embed/external.js';
export interface Main {
    $type: 'app.bsky.actor.status';
    /** The status for the account. */
    status: 'app.bsky.actor.status#live' | (string & {});
    embed?: $Typed<AppBskyEmbedExternal.Main> | {
        $type: string;
    };
    /** The duration of the status in minutes. Applications can choose to impose minimum and maximum limits. */
    durationMinutes?: number;
    createdAt: string;
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.actor.status", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
/** Advertises an account as currently offering live content. */
export declare const LIVE = "app.bsky.actor.status#live";
//# sourceMappingURL=status.d.ts.map