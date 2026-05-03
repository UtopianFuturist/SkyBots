"use strict";

exports.isAlphabetic = isAlphabetic;
exports.isAlphanumeric = isAlphanumeric;
exports.isLetter = isLetter;
exports.isNumeric = isNumeric;
var _core = require("./core.cjs");
var _general_data = require("./_general_data.cjs");
// @ts-check

/**
 * Check if the given code point is included in Unicode \\p{L} general property
 *
 * @param {number} cp
 * @return boolean
 */
function isLetter(cp) {
  return (0, _core.findUnicodeRangeIndex)(cp, _general_data.letter_ranges) >= 0;
}

/**
 * Check if the given code point is included in Unicode \\p{Alphabetic} dervied property
 *
 * @param {number} cp
 * @return boolean
 */
function isAlphabetic(cp) {
  return (0, _core.findUnicodeRangeIndex)(cp, _general_data.alphabetic_ranges) >= 0;
}

/**
 * Check if the given code point is included in Unicode \\p{N} general property
 *
 * @param {number} cp
 * @return boolean true if 
 */
function isNumeric(cp) {
  return (0, _core.findUnicodeRangeIndex)(cp, _general_data.numeric_ranges) >= 0;
}

/**
 * @param {number} cp
 * @return boolean true
 */
function isAlphanumeric(cp) {
  return isAlphabetic(cp) || isNumeric(cp);
}