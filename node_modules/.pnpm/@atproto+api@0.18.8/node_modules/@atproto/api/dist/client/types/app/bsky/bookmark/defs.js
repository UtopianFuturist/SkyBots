"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBookmark = isBookmark;
exports.validateBookmark = validateBookmark;
exports.isBookmarkView = isBookmarkView;
exports.validateBookmarkView = validateBookmarkView;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.bookmark.defs';
const hashBookmark = 'bookmark';
function isBookmark(v) {
    return is$typed(v, id, hashBookmark);
}
function validateBookmark(v) {
    return validate(v, id, hashBookmark);
}
const hashBookmarkView = 'bookmarkView';
function isBookmarkView(v) {
    return is$typed(v, id, hashBookmarkView);
}
function validateBookmarkView(v) {
    return validate(v, id, hashBookmarkView);
}
//# sourceMappingURL=defs.js.map