"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isModTool = isModTool;
exports.validateModTool = validateModTool;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'com.atproto.moderation.createReport';
function toKnownErr(e) {
    return e;
}
const hashModTool = 'modTool';
function isModTool(v) {
    return is$typed(v, id, hashModTool);
}
function validateModTool(v) {
    return validate(v, id, hashModTool);
}
//# sourceMappingURL=createReport.js.map