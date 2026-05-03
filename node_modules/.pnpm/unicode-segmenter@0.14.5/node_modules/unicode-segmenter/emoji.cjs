"use strict";

exports.isEmoji = isEmoji;
exports.isEmojiPresentation = isEmojiPresentation;
exports.isExtendedPictographic = isExtendedPictographic;
var _core = require("./core.cjs");
var _emoji_data = require("./_emoji_data.cjs");
// @ts-check

/**
 * An alias to {@link isExtendedPictographic}
 *
 * @deprecated in favor of {@link isExtendedPictographic}, will be removed in v1.
 *
 * @param {number} cp
 * @return boolean
 */
function isEmoji(cp) {
  return isExtendedPictographic(cp);
}

/**
 * Check if the given code point is included in Unicode \\p{Emoji_Presentation} script property
 *
 * @param {number} cp
 * @return boolean
 */
function isEmojiPresentation(cp) {
  return (0, _core.findUnicodeRangeIndex)(cp, _emoji_data.emoji_presentation_ranges) >= 0;
}

/**
 * Check if the given code point is included in Unicode \\p{Extended_Pictographic} script property
 *
 * @param {number} cp
 * @return boolean
 */
function isExtendedPictographic(cp) {
  return (0, _core.findUnicodeRangeIndex)(cp, _emoji_data.extended_pictographic_ranges) >= 0;
}