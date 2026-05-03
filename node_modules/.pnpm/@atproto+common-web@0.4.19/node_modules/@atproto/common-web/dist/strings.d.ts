import { LanguageTag, isValidLanguage, parseLanguageString } from '@atproto/syntax';
/**
 * @deprecated Use {@link graphemeLen} from `@atproto/lex-data` instead.
 */
declare const graphemeLenLegacy: (str: string) => number;
export { graphemeLenLegacy as graphemeLen };
/**
 * @deprecated Use {@link utf8Len} from `@atproto/lex-data` instead.
 */
declare const utf8LenLegacy: (string: string) => number;
export { utf8LenLegacy as utf8Len };
/**
 * @deprecated Use {@link LanguageTag} from `@atproto/lex-data` instead.
 */
type LanguageTagLegacy = LanguageTag;
export type { LanguageTagLegacy as LanguageTag };
/**
 * @deprecated Use {@link parseLanguageString} from `@atproto/syntax` instead.
 */
declare const parseLanguageLegacy: typeof parseLanguageString;
export { parseLanguageLegacy as parseLanguage };
/**
 * @deprecated Use {@link isLanguageString} from `@atproto/syntax` instead.
 */
export declare const validateLanguage: typeof isValidLanguage;
/**
 * @deprecated Use {@link toBase64} from `@atproto/lex-data` instead.
 */
export declare const utf8ToB64Url: (utf8: string) => string;
/**
 * @deprecated Use {@link fromBase64} from `@atproto/lex-data` instead.
 */
export declare const b64UrlToUtf8: (b64: string) => string;
//# sourceMappingURL=strings.d.ts.map