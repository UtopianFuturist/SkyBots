"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utf8LenNode = void 0;
exports.utf8LenCompute = utf8LenCompute;
const nodejs_buffer_js_1 = require("./lib/nodejs-buffer.js");
// @NOTE This file is not meant to be exported directly. Instead, we re-export
// public functions from ./utf8.ts. The reason for this separation is that this
// file allows to test both the NodeJS-optimized and ponyfill implementations.
exports.utf8LenNode = nodejs_buffer_js_1.NodeJSBuffer
    ? function utf8LenNode(string) {
        return nodejs_buffer_js_1.NodeJSBuffer.byteLength(string, 'utf8');
    }
    : /* v8 ignore next -- @preserve */ null;
function utf8LenCompute(string) {
    // The code below is similar to TextEncoder's implementation of UTF-8
    // encoding. However, using TextEncoder to get the byte length is slower
    // as it requires allocating a new Uint8Array and copying data:
    // return new TextEncoder().encode(string).byteLength
    // The base length is the string length (all ASCII)
    let len = string.length;
    let code;
    // The loop calculates the number of additional bytes needed for
    // non-ASCII characters
    for (let i = 0; i < string.length; i += 1) {
        code = string.charCodeAt(i);
        if (code <= 0x7f) {
            // ASCII, 1 byte
        }
        else if (code <= 0x7ff) {
            // 2 bytes char
            len += 1;
        }
        else {
            // 3 bytes char
            len += 2;
            // If the current char is a high surrogate, and the next char is a low
            // surrogate, skip the next char as the total is a 4 bytes char
            // (represented as a surrogate pair in UTF-16) and was already accounted
            // for.
            if (code >= 0xd800 && code <= 0xdbff) {
                code = string.charCodeAt(i + 1);
                if (code >= 0xdc00 && code <= 0xdfff) {
                    i++;
                }
            }
        }
    }
    return len;
}
//# sourceMappingURL=utf8-len.js.map