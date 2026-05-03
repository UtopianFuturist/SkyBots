"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVerificationView = isVerificationView;
exports.validateVerificationView = validateVerificationView;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.verification.defs';
const hashVerificationView = 'verificationView';
function isVerificationView(v) {
    return is$typed(v, id, hashVerificationView);
}
function validateVerificationView(v) {
    return validate(v, id, hashVerificationView);
}
//# sourceMappingURL=defs.js.map