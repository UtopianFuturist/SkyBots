"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvent = isEvent;
exports.validateEvent = validateEvent;
exports.isUrlRule = isUrlRule;
exports.validateUrlRule = validateUrlRule;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.safelink.defs';
const hashEvent = 'event';
function isEvent(v) {
    return is$typed(v, id, hashEvent);
}
function validateEvent(v) {
    return validate(v, id, hashEvent);
}
const hashUrlRule = 'urlRule';
function isUrlRule(v) {
    return is$typed(v, id, hashUrlRule);
}
function validateUrlRule(v) {
    return validate(v, id, hashUrlRule);
}
//# sourceMappingURL=defs.js.map