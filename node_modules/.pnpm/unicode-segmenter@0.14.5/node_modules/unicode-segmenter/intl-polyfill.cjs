"use strict";

var _intlAdapter = require("./intl-adapter.cjs");
(intl => {
  let key = 'Segmenter';
  if (typeof intl !== 'object' || intl.hasOwnProperty(key)) {
    return;
  }
  Object.defineProperty(intl, key, {
    value: _intlAdapter.Segmenter,
    enumerable: false,
    writable: true,
    configurable: true
  });
})(globalThis.Intl);

/* Not a pure module */