"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.isRecord = isMain;
exports.validateMain = validateMain;
exports.validateRecord = validateMain;
exports.isFeedItem = isFeedItem;
exports.validateFeedItem = validateFeedItem;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.graph.starterpack';
const hashMain = 'main';
function isMain(v) {
    return is$typed(v, id, hashMain);
}
function validateMain(v) {
    return validate(v, id, hashMain, true);
}
const hashFeedItem = 'feedItem';
function isFeedItem(v) {
    return is$typed(v, id, hashFeedItem);
}
function validateFeedItem(v) {
    return validate(v, id, hashFeedItem);
}
//# sourceMappingURL=starterpack.js.map