"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUri = isValidUri;
function isValidUri(input) {
    return /^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input);
}
//# sourceMappingURL=uri.js.map