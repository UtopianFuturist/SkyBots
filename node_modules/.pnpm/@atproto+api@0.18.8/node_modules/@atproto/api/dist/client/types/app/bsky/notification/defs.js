"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecordDeleted = isRecordDeleted;
exports.validateRecordDeleted = validateRecordDeleted;
exports.isChatPreference = isChatPreference;
exports.validateChatPreference = validateChatPreference;
exports.isFilterablePreference = isFilterablePreference;
exports.validateFilterablePreference = validateFilterablePreference;
exports.isPreference = isPreference;
exports.validatePreference = validatePreference;
exports.isPreferences = isPreferences;
exports.validatePreferences = validatePreferences;
exports.isActivitySubscription = isActivitySubscription;
exports.validateActivitySubscription = validateActivitySubscription;
exports.isSubjectActivitySubscription = isSubjectActivitySubscription;
exports.validateSubjectActivitySubscription = validateSubjectActivitySubscription;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.notification.defs';
const hashRecordDeleted = 'recordDeleted';
function isRecordDeleted(v) {
    return is$typed(v, id, hashRecordDeleted);
}
function validateRecordDeleted(v) {
    return validate(v, id, hashRecordDeleted);
}
const hashChatPreference = 'chatPreference';
function isChatPreference(v) {
    return is$typed(v, id, hashChatPreference);
}
function validateChatPreference(v) {
    return validate(v, id, hashChatPreference);
}
const hashFilterablePreference = 'filterablePreference';
function isFilterablePreference(v) {
    return is$typed(v, id, hashFilterablePreference);
}
function validateFilterablePreference(v) {
    return validate(v, id, hashFilterablePreference);
}
const hashPreference = 'preference';
function isPreference(v) {
    return is$typed(v, id, hashPreference);
}
function validatePreference(v) {
    return validate(v, id, hashPreference);
}
const hashPreferences = 'preferences';
function isPreferences(v) {
    return is$typed(v, id, hashPreferences);
}
function validatePreferences(v) {
    return validate(v, id, hashPreferences);
}
const hashActivitySubscription = 'activitySubscription';
function isActivitySubscription(v) {
    return is$typed(v, id, hashActivitySubscription);
}
function validateActivitySubscription(v) {
    return validate(v, id, hashActivitySubscription);
}
const hashSubjectActivitySubscription = 'subjectActivitySubscription';
function isSubjectActivitySubscription(v) {
    return is$typed(v, id, hashSubjectActivitySubscription);
}
function validateSubjectActivitySubscription(v) {
    return validate(v, id, hashSubjectActivitySubscription);
}
//# sourceMappingURL=defs.js.map