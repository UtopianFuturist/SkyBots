"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHexString = toHexString;
exports.isUint8 = isUint8;
function toHexString(number) {
    return `0x${number.toString(16).padStart(2, '0')}`;
}
function isUint8(val) {
    return Number.isInteger(val) && val >= 0 && val < 256;
}
//# sourceMappingURL=util.js.map