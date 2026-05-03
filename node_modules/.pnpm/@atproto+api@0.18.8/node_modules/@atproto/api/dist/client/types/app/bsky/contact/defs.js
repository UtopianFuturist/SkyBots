"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMatchAndContactIndex = isMatchAndContactIndex;
exports.validateMatchAndContactIndex = validateMatchAndContactIndex;
exports.isSyncStatus = isSyncStatus;
exports.validateSyncStatus = validateSyncStatus;
exports.isNotification = isNotification;
exports.validateNotification = validateNotification;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.contact.defs';
const hashMatchAndContactIndex = 'matchAndContactIndex';
function isMatchAndContactIndex(v) {
    return is$typed(v, id, hashMatchAndContactIndex);
}
function validateMatchAndContactIndex(v) {
    return validate(v, id, hashMatchAndContactIndex);
}
const hashSyncStatus = 'syncStatus';
function isSyncStatus(v) {
    return is$typed(v, id, hashSyncStatus);
}
function validateSyncStatus(v) {
    return validate(v, id, hashSyncStatus);
}
const hashNotification = 'notification';
function isNotification(v) {
    return is$typed(v, id, hashNotification);
}
function validateNotification(v) {
    return validate(v, id, hashNotification);
}
//# sourceMappingURL=defs.js.map