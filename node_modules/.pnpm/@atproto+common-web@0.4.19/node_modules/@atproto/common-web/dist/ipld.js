"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipldEquals = exports.ipldToJson = exports.jsonToIpld = void 0;
const lex_data_1 = require("@atproto/lex-data");
const lex_json_1 = require("@atproto/lex-json");
/**
 * Converts a JSON-compatible value to an IPLD-compatible value.
 * @deprecated Use {@link jsonToLex} from `@atproto/lex-cbor` instead.
 */
const jsonToIpld = (val) => {
    return (0, lex_json_1.jsonToLex)(val, { strict: false });
};
exports.jsonToIpld = jsonToIpld;
/**
 * Converts an IPLD-compatible value to a JSON-compatible value.
 * @deprecated Use {@link lexToJson} from `@atproto/lex-cbor` instead.
 */
const ipldToJson = (val) => {
    // Legacy behavior(s)
    if (val === undefined)
        return val;
    if (Number.isNaN(val))
        return val;
    return (0, lex_json_1.lexToJson)(val);
};
exports.ipldToJson = ipldToJson;
/**
 * Compares two IPLD-compatible values for deep equality.
 * @deprecated Use {@link lexEquals} from `@atproto/lex-cbor` instead.
 */
const ipldEquals = (a, b) => {
    if (!(0, lex_data_1.lexEquals)(a, b))
        return false;
    // @NOTE The previous implementation used "===" which treats NaN as unequal to
    // NaN.
    if (Number.isNaN(a))
        return false;
    return true;
};
exports.ipldEquals = ipldEquals;
//# sourceMappingURL=ipld.js.map