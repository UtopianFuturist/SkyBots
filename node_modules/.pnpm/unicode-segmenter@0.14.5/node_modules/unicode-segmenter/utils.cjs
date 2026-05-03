"use strict";

exports.isBMP = isBMP;
exports.isHighSurrogate = isHighSurrogate;
exports.isLowSurrogate = isLowSurrogate;
exports.isSIP = isSIP;
exports.isSMP = isSMP;
exports.isSSP = isSSP;
exports.isTIP = isTIP;
exports.surrogatePairToCodePoint = surrogatePairToCodePoint;
// @ts-check

/** 
 * @deprecated never used
 *
 * @param {number} c UTF-16 code point
 */
function isHighSurrogate(c) {
  return 0xd800 <= c && c <= 0xdbff;
}

/** 
 * @deprecated never used
 *
 * @param {number} c UTF-16 code point
 */
function isLowSurrogate(c) {
  return 0xdc00 <= c && c <= 0xdfff;
}

/** 
 * @deprecated never used
 *
 * @param {number} hi high surrogate
 * @param {number} lo low surrogate
 */
function surrogatePairToCodePoint(hi, lo) {
  return (hi - 0xd800 << 10) + (lo - 0xdc00) + 0x10000;
}

/**
 * @deprecated never used
 *
 * Check if given code point is within the BMP(Basic Multilingual Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
function isBMP(c) {
  return c <= 0xffff;
}

/**
 * @deprecated never used
 *
 * Check if given code point is within the SMP(Supplementary Multilingual Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
function isSMP(c) {
  return 0x10000 <= c && c <= 0x1ffff;
}

/**
 * @deprecated never used
 *
 * Check if given code point is within the SIP(Supplementary Ideographic Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
function isSIP(c) {
  return 0x20000 <= c && c <= 0x2ffff;
}

/**
 * @deprecated never used
 *
 * Check if given code point is within the TIP(Tertiary Ideographic Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
function isTIP(c) {
  return 0x30000 <= c && c <= 0x3ffff;
}

/**
 * @deprecated never used
 *
 * Check if given code point is within the SSP(Supplementary Special-purpose Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
function isSSP(c) {
  return 0xe0000 <= c && c <= 0xeffff;
}