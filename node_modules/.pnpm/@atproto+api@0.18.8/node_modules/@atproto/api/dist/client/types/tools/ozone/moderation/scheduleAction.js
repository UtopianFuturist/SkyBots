"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isTakedown = isTakedown;
exports.validateTakedown = validateTakedown;
exports.isSchedulingConfig = isSchedulingConfig;
exports.validateSchedulingConfig = validateSchedulingConfig;
exports.isScheduledActionResults = isScheduledActionResults;
exports.validateScheduledActionResults = validateScheduledActionResults;
exports.isFailedScheduling = isFailedScheduling;
exports.validateFailedScheduling = validateFailedScheduling;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.moderation.scheduleAction';
function toKnownErr(e) {
    return e;
}
const hashTakedown = 'takedown';
function isTakedown(v) {
    return is$typed(v, id, hashTakedown);
}
function validateTakedown(v) {
    return validate(v, id, hashTakedown);
}
const hashSchedulingConfig = 'schedulingConfig';
function isSchedulingConfig(v) {
    return is$typed(v, id, hashSchedulingConfig);
}
function validateSchedulingConfig(v) {
    return validate(v, id, hashSchedulingConfig);
}
const hashScheduledActionResults = 'scheduledActionResults';
function isScheduledActionResults(v) {
    return is$typed(v, id, hashScheduledActionResults);
}
function validateScheduledActionResults(v) {
    return validate(v, id, hashScheduledActionResults);
}
const hashFailedScheduling = 'failedScheduling';
function isFailedScheduling(v) {
    return is$typed(v, id, hashFailedScheduling);
}
function validateFailedScheduling(v) {
    return validate(v, id, hashFailedScheduling);
}
//# sourceMappingURL=scheduleAction.js.map