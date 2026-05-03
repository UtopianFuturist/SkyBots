"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE = void 0;
exports.isMain = isMain;
exports.isRecord = isMain;
exports.validateMain = validateMain;
exports.validateRecord = validateMain;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.actor.status';
const hashMain = 'main';
function isMain(v) {
    return is$typed(v, id, hashMain);
}
function validateMain(v) {
    return validate(v, id, hashMain, true);
}
/** Advertises an account as currently offering live content. */
exports.LIVE = `${id}#live`;
//# sourceMappingURL=status.js.map