"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utf8ToBase64Node = void 0;
exports.utf8ToBase64Ponyfill = utf8ToBase64Ponyfill;
const to_string_1 = require("uint8arrays/to-string");
const nodejs_buffer_js_1 = require("./lib/nodejs-buffer.js");
const uint8array_to_base64_js_1 = require("./uint8array-to-base64.js");
const Buffer = nodejs_buffer_js_1.NodeJSBuffer;
exports.utf8ToBase64Node = Buffer
    ? function utf8ToBase64Node(text, alphabet) {
        const buffer = Buffer.from(text, 'utf8');
        return uint8array_to_base64_js_1.toBase64Node(buffer, alphabet);
    }
    : /* v8 ignore next -- @preserve */ null;
const textEncoder = /*#__PURE__*/ new TextEncoder();
function utf8ToBase64Ponyfill(text, alphabet) {
    const bytes = textEncoder.encode(text);
    return (0, to_string_1.toString)(bytes, alphabet);
}
//# sourceMappingURL=utf8-to-base64.js.map