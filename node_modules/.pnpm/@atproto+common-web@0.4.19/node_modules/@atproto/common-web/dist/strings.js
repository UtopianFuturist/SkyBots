"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.b64UrlToUtf8 = exports.utf8ToB64Url = exports.validateLanguage = exports.parseLanguage = exports.utf8Len = exports.graphemeLen = void 0;
const lex_data_1 = require("@atproto/lex-data");
const syntax_1 = require("@atproto/syntax");
/**
 * @deprecated Use {@link graphemeLen} from `@atproto/lex-data` instead.
 */
const graphemeLenLegacy = lex_data_1.graphemeLen;
exports.graphemeLen = graphemeLenLegacy;
/**
 * @deprecated Use {@link utf8Len} from `@atproto/lex-data` instead.
 */
const utf8LenLegacy = lex_data_1.utf8Len;
exports.utf8Len = utf8LenLegacy;
/**
 * @deprecated Use {@link parseLanguageString} from `@atproto/syntax` instead.
 */
const parseLanguageLegacy = syntax_1.parseLanguageString;
exports.parseLanguage = parseLanguageLegacy;
/**
 * @deprecated Use {@link isLanguageString} from `@atproto/syntax` instead.
 */
exports.validateLanguage = syntax_1.isValidLanguage;
/**
 * @deprecated Use {@link toBase64} from `@atproto/lex-data` instead.
 */
const utf8ToB64Url = (utf8) => {
    return (0, lex_data_1.toBase64)(new TextEncoder().encode(utf8), 'base64url');
};
exports.utf8ToB64Url = utf8ToB64Url;
/**
 * @deprecated Use {@link fromBase64} from `@atproto/lex-data` instead.
 */
const b64UrlToUtf8 = (b64) => {
    return new TextDecoder().decode((0, lex_data_1.fromBase64)(b64, 'base64url'));
};
exports.b64UrlToUtf8 = b64UrlToUtf8;
//# sourceMappingURL=strings.js.map