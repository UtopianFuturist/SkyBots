"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utf8FromBase64Node = void 0;
exports.utf8FromBase64Ponyfill = utf8FromBase64Ponyfill;
const from_string_1 = require("uint8arrays/from-string");
const nodejs_buffer_js_1 = require("./lib/nodejs-buffer.js");
const Buffer = nodejs_buffer_js_1.NodeJSBuffer;
exports.utf8FromBase64Node = Buffer
    ? function utf8FromBase64Node(b64, alphabet = 'base64') {
        return Buffer.from(b64, alphabet).toString('utf8');
    }
    : /* v8 ignore next -- @preserve */ null;
const textDecoder = /*#__PURE__*/ new TextDecoder();
function utf8FromBase64Ponyfill(b64, alphabet) {
    const bytes = (0, from_string_1.fromString)(b64, alphabet);
    return textDecoder.decode(bytes);
}
//# sourceMappingURL=utf8-from-base64.js.map