"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeJSBuffer = void 0;
// Avoids a direct reference to Node.js Buffer, which might not exist in some
// environments (e.g. browsers, Deno, Bun) to prevent bundlers from trying to
// include polyfills.
const BUFFER = /*#__PURE__*/ (() => 'Bu' + 'f'.repeat(2) + 'er')();
exports.NodeJSBuffer = globalThis?.[BUFFER]?.prototype instanceof Uint8Array &&
    'byteLength' in globalThis[BUFFER]
    ? globalThis[BUFFER]
    : /* v8 ignore next -- @preserve */ null;
//# sourceMappingURL=nodejs-buffer.js.map