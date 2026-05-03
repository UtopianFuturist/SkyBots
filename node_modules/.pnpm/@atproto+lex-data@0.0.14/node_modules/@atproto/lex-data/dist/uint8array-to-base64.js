"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBase64Node = exports.toBase64Native = void 0;
exports.toBase64Ponyfill = toBase64Ponyfill;
const to_string_1 = require("uint8arrays/to-string");
const nodejs_buffer_js_1 = require("./lib/nodejs-buffer.js");
const Buffer = nodejs_buffer_js_1.NodeJSBuffer;
exports.toBase64Native = typeof Uint8Array.prototype.toBase64 === 'function'
    ? function toBase64Native(bytes, alphabet = 'base64') {
        return bytes.toBase64({ alphabet, omitPadding: true });
    }
    : /* v8 ignore next -- @preserve */ null;
exports.toBase64Node = Buffer
    ? function toBase64Node(bytes, alphabet = 'base64') {
        const buffer = bytes instanceof Buffer ? bytes : Buffer.from(bytes);
        const b64 = buffer.toString(alphabet);
        // @NOTE We strip padding for strict compatibility with
        // uint8arrays.toString behavior. Tests failing because of the presence of
        // padding are not really synonymous with an actual error and we might
        // (should?) actually want to keep the padding at some point.
        return b64.charCodeAt(b64.length - 1) === /* '=' */ 0x3d
            ? b64.charCodeAt(b64.length - 2) === /* '=' */ 0x3d
                ? b64.slice(0, -2) // '=='
                : b64.slice(0, -1) // '='
            : b64;
    }
    : /* v8 ignore next -- @preserve */ null;
function toBase64Ponyfill(bytes, alphabet = 'base64') {
    return (0, to_string_1.toString)(bytes, alphabet);
}
//# sourceMappingURL=uint8array-to-base64.js.map