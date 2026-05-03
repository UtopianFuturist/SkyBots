/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon';
export interface Main {
    $type: 'com.atproto.lexicon.schema';
    /** Indicates the 'version' of the Lexicon language. Must be '1' for the current atproto/Lexicon schema system. */
    lexicon: number;
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "com.atproto.lexicon.schema", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
//# sourceMappingURL=schema.d.ts.map