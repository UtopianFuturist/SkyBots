"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphemeLenNative = void 0;
exports.graphemeLenPonyfill = graphemeLenPonyfill;
const grapheme_1 = require("unicode-segmenter/grapheme");
// @TODO: Drop usage of "unicode-segmenter" package when Intl.Segmenter is
// widely supported.
// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
const segmenter = 'Segmenter' in Intl && typeof Intl.Segmenter === 'function'
    ? /*#__PURE__*/ new Intl.Segmenter()
    : /* v8 ignore next -- @preserve */ null;
exports.graphemeLenNative = segmenter
    ? function graphemeLenNative(str) {
        let length = 0;
        for (const _ of segmenter.segment(str))
            length++;
        return length;
    }
    : /* v8 ignore next -- @preserve */ null;
function graphemeLenPonyfill(str) {
    return (0, grapheme_1.countGraphemes)(str);
}
//# sourceMappingURL=utf8-grapheme-len.js.map