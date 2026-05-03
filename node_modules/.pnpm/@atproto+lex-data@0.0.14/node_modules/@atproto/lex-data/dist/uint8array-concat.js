"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ui8ConcatNode = void 0;
exports.ui8ConcatPonyfill = ui8ConcatPonyfill;
const nodejs_buffer_js_1 = require("./lib/nodejs-buffer.js");
const Buffer = nodejs_buffer_js_1.NodeJSBuffer;
exports.ui8ConcatNode = Buffer
    ? function ui8ConcatNode(array) {
        return Buffer.concat(array);
    }
    : /* v8 ignore next -- @preserve */ null;
function ui8ConcatPonyfill(array) {
    let totalLength = 0;
    for (const arr of array)
        totalLength += arr.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of array) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
//# sourceMappingURL=uint8array-concat.js.map