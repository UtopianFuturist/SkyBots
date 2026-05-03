"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isEvent = isEvent;
exports.validateEvent = validateEvent;
exports.isAccountCreated = isAccountCreated;
exports.validateAccountCreated = validateAccountCreated;
exports.isEmailUpdated = isEmailUpdated;
exports.validateEmailUpdated = validateEmailUpdated;
exports.isEmailConfirmed = isEmailConfirmed;
exports.validateEmailConfirmed = validateEmailConfirmed;
exports.isPasswordUpdated = isPasswordUpdated;
exports.validatePasswordUpdated = validatePasswordUpdated;
exports.isHandleUpdated = isHandleUpdated;
exports.validateHandleUpdated = validateHandleUpdated;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.hosting.getAccountHistory';
function toKnownErr(e) {
    return e;
}
const hashEvent = 'event';
function isEvent(v) {
    return is$typed(v, id, hashEvent);
}
function validateEvent(v) {
    return validate(v, id, hashEvent);
}
const hashAccountCreated = 'accountCreated';
function isAccountCreated(v) {
    return is$typed(v, id, hashAccountCreated);
}
function validateAccountCreated(v) {
    return validate(v, id, hashAccountCreated);
}
const hashEmailUpdated = 'emailUpdated';
function isEmailUpdated(v) {
    return is$typed(v, id, hashEmailUpdated);
}
function validateEmailUpdated(v) {
    return validate(v, id, hashEmailUpdated);
}
const hashEmailConfirmed = 'emailConfirmed';
function isEmailConfirmed(v) {
    return is$typed(v, id, hashEmailConfirmed);
}
function validateEmailConfirmed(v) {
    return validate(v, id, hashEmailConfirmed);
}
const hashPasswordUpdated = 'passwordUpdated';
function isPasswordUpdated(v) {
    return is$typed(v, id, hashPasswordUpdated);
}
function validatePasswordUpdated(v) {
    return validate(v, id, hashPasswordUpdated);
}
const hashHandleUpdated = 'handleUpdated';
function isHandleUpdated(v) {
    return is$typed(v, id, hashHandleUpdated);
}
function validateHandleUpdated(v) {
    return validate(v, id, hashHandleUpdated);
}
//# sourceMappingURL=getAccountHistory.js.map