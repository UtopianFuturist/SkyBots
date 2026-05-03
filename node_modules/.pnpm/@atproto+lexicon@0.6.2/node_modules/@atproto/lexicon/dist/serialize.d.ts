import { IpldValue, JsonValue } from '@atproto/common-web';
/**
 * @note this is equivalent to `unknown` because of {@link IpldValue} being `unknown`.
 * @deprecated Use {@link Lex} from `@atproto/lex-data` instead.
 */
export type LexValue = unknown;
/**
 * @deprecated Use {@link TypedLexMap} from `@atproto/lex-data` instead.
 */
export type RepoRecord = Record<string, LexValue>;
/**
 * @deprecated Use `LexValue` from `@atproto/lex-data` instead (which doesn't need conversion to IPLD).
 */
export declare const lexToIpld: (val: LexValue) => IpldValue;
/**
 * @deprecated Use `LexValue` from `@atproto/lex-data` instead instead (which doesn't need conversion to IPLD).
 */
export declare const ipldToLex: (val: IpldValue) => LexValue;
export declare const lexToJson: (val: LexValue) => JsonValue;
export declare const stringifyLex: (val: LexValue) => string;
export declare const jsonToLex: (val: JsonValue) => LexValue;
export declare const jsonStringToLex: (val: string) => LexValue;
//# sourceMappingURL=serialize.d.ts.map