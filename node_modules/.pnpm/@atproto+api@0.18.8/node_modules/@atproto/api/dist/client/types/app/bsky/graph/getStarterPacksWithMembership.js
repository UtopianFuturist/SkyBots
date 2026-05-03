"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isStarterPackWithMembership = isStarterPackWithMembership;
exports.validateStarterPackWithMembership = validateStarterPackWithMembership;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.graph.getStarterPacksWithMembership';
function toKnownErr(e) {
    return e;
}
const hashStarterPackWithMembership = 'starterPackWithMembership';
function isStarterPackWithMembership(v) {
    return is$typed(v, id, hashStarterPackWithMembership);
}
function validateStarterPackWithMembership(v) {
    return validate(v, id, hashStarterPackWithMembership);
}
//# sourceMappingURL=getStarterPacksWithMembership.js.map