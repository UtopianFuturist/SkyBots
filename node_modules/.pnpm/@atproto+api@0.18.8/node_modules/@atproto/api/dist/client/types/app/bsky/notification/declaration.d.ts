/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
export interface Main {
    $type: 'app.bsky.notification.declaration';
    /** A declaration of the user's preference for allowing activity subscriptions from other users. Absence of a record implies 'followers'. */
    allowSubscriptions: 'followers' | 'mutuals' | 'none' | (string & {});
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.notification.declaration", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
//# sourceMappingURL=declaration.d.ts.map