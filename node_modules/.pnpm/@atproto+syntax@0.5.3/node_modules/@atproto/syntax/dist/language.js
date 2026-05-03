"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLanguageString = parseLanguageString;
exports.isValidLanguage = isValidLanguage;
const BCP47_REGEXP = /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>x(-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>x(-[A-Za-z0-9]{1,8})+))$/;
function parseLanguageString(input) {
    const parsed = input.match(BCP47_REGEXP);
    if (!parsed?.groups)
        return null;
    const { groups } = parsed;
    return {
        grandfathered: groups.grandfathered,
        language: groups.language,
        extlang: groups.extlang,
        script: groups.script,
        region: groups.region,
        variant: groups.variant,
        extension: groups.extension,
        privateUse: groups.privateUseA || groups.privateUseB,
    };
}
/**
 * Validates well-formed BCP 47 syntax
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1}
 */
function isValidLanguage(input) {
    return BCP47_REGEXP.test(input);
}
//# sourceMappingURL=language.js.map