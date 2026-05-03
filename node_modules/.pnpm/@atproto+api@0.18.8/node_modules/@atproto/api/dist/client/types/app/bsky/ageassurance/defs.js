"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isState = isState;
exports.validateState = validateState;
exports.isStateMetadata = isStateMetadata;
exports.validateStateMetadata = validateStateMetadata;
exports.isConfig = isConfig;
exports.validateConfig = validateConfig;
exports.isConfigRegion = isConfigRegion;
exports.validateConfigRegion = validateConfigRegion;
exports.isConfigRegionRuleDefault = isConfigRegionRuleDefault;
exports.validateConfigRegionRuleDefault = validateConfigRegionRuleDefault;
exports.isConfigRegionRuleIfDeclaredOverAge = isConfigRegionRuleIfDeclaredOverAge;
exports.validateConfigRegionRuleIfDeclaredOverAge = validateConfigRegionRuleIfDeclaredOverAge;
exports.isConfigRegionRuleIfDeclaredUnderAge = isConfigRegionRuleIfDeclaredUnderAge;
exports.validateConfigRegionRuleIfDeclaredUnderAge = validateConfigRegionRuleIfDeclaredUnderAge;
exports.isConfigRegionRuleIfAssuredOverAge = isConfigRegionRuleIfAssuredOverAge;
exports.validateConfigRegionRuleIfAssuredOverAge = validateConfigRegionRuleIfAssuredOverAge;
exports.isConfigRegionRuleIfAssuredUnderAge = isConfigRegionRuleIfAssuredUnderAge;
exports.validateConfigRegionRuleIfAssuredUnderAge = validateConfigRegionRuleIfAssuredUnderAge;
exports.isConfigRegionRuleIfAccountNewerThan = isConfigRegionRuleIfAccountNewerThan;
exports.validateConfigRegionRuleIfAccountNewerThan = validateConfigRegionRuleIfAccountNewerThan;
exports.isConfigRegionRuleIfAccountOlderThan = isConfigRegionRuleIfAccountOlderThan;
exports.validateConfigRegionRuleIfAccountOlderThan = validateConfigRegionRuleIfAccountOlderThan;
exports.isEvent = isEvent;
exports.validateEvent = validateEvent;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.ageassurance.defs';
const hashState = 'state';
function isState(v) {
    return is$typed(v, id, hashState);
}
function validateState(v) {
    return validate(v, id, hashState);
}
const hashStateMetadata = 'stateMetadata';
function isStateMetadata(v) {
    return is$typed(v, id, hashStateMetadata);
}
function validateStateMetadata(v) {
    return validate(v, id, hashStateMetadata);
}
const hashConfig = 'config';
function isConfig(v) {
    return is$typed(v, id, hashConfig);
}
function validateConfig(v) {
    return validate(v, id, hashConfig);
}
const hashConfigRegion = 'configRegion';
function isConfigRegion(v) {
    return is$typed(v, id, hashConfigRegion);
}
function validateConfigRegion(v) {
    return validate(v, id, hashConfigRegion);
}
const hashConfigRegionRuleDefault = 'configRegionRuleDefault';
function isConfigRegionRuleDefault(v) {
    return is$typed(v, id, hashConfigRegionRuleDefault);
}
function validateConfigRegionRuleDefault(v) {
    return validate(v, id, hashConfigRegionRuleDefault);
}
const hashConfigRegionRuleIfDeclaredOverAge = 'configRegionRuleIfDeclaredOverAge';
function isConfigRegionRuleIfDeclaredOverAge(v) {
    return is$typed(v, id, hashConfigRegionRuleIfDeclaredOverAge);
}
function validateConfigRegionRuleIfDeclaredOverAge(v) {
    return validate(v, id, hashConfigRegionRuleIfDeclaredOverAge);
}
const hashConfigRegionRuleIfDeclaredUnderAge = 'configRegionRuleIfDeclaredUnderAge';
function isConfigRegionRuleIfDeclaredUnderAge(v) {
    return is$typed(v, id, hashConfigRegionRuleIfDeclaredUnderAge);
}
function validateConfigRegionRuleIfDeclaredUnderAge(v) {
    return validate(v, id, hashConfigRegionRuleIfDeclaredUnderAge);
}
const hashConfigRegionRuleIfAssuredOverAge = 'configRegionRuleIfAssuredOverAge';
function isConfigRegionRuleIfAssuredOverAge(v) {
    return is$typed(v, id, hashConfigRegionRuleIfAssuredOverAge);
}
function validateConfigRegionRuleIfAssuredOverAge(v) {
    return validate(v, id, hashConfigRegionRuleIfAssuredOverAge);
}
const hashConfigRegionRuleIfAssuredUnderAge = 'configRegionRuleIfAssuredUnderAge';
function isConfigRegionRuleIfAssuredUnderAge(v) {
    return is$typed(v, id, hashConfigRegionRuleIfAssuredUnderAge);
}
function validateConfigRegionRuleIfAssuredUnderAge(v) {
    return validate(v, id, hashConfigRegionRuleIfAssuredUnderAge);
}
const hashConfigRegionRuleIfAccountNewerThan = 'configRegionRuleIfAccountNewerThan';
function isConfigRegionRuleIfAccountNewerThan(v) {
    return is$typed(v, id, hashConfigRegionRuleIfAccountNewerThan);
}
function validateConfigRegionRuleIfAccountNewerThan(v) {
    return validate(v, id, hashConfigRegionRuleIfAccountNewerThan);
}
const hashConfigRegionRuleIfAccountOlderThan = 'configRegionRuleIfAccountOlderThan';
function isConfigRegionRuleIfAccountOlderThan(v) {
    return is$typed(v, id, hashConfigRegionRuleIfAccountOlderThan);
}
function validateConfigRegionRuleIfAccountOlderThan(v) {
    return validate(v, id, hashConfigRegionRuleIfAccountOlderThan);
}
const hashEvent = 'event';
function isEvent(v) {
    return is$typed(v, id, hashEvent);
}
function validateEvent(v) {
    return validate(v, id, hashEvent);
}
//# sourceMappingURL=defs.js.map