"use strict";

var _general = require("./general.cjs");
Object.keys(_general).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _general[key]) return;
  exports[key] = _general[key];
});
var _emoji = require("./emoji.cjs");
Object.keys(_emoji).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _emoji[key]) return;
  exports[key] = _emoji[key];
});
var _grapheme = require("./grapheme.cjs");
Object.keys(_grapheme).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _grapheme[key]) return;
  exports[key] = _grapheme[key];
});
var _utils = require("./utils.cjs");
Object.keys(_utils).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _utils[key]) return;
  exports[key] = _utils[key];
});