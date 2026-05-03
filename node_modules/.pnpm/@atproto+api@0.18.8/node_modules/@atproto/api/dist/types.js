"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAtprotoServiceType = isAtprotoServiceType;
exports.isDid = isDid;
exports.assertDid = assertDid;
exports.asDid = asDid;
exports.isAtprotoProxy = isAtprotoProxy;
exports.assertAtprotoProxy = assertAtprotoProxy;
exports.asAtprotoProxy = asAtprotoProxy;
function isAtprotoServiceType(input) {
    return !input.includes(' ') && !input.includes('#');
}
function isDid(input) {
    if (!input.startsWith('did:'))
        return false;
    if (input.length < 8)
        return false;
    if (input.length > 2048)
        return false;
    const msidx = input.indexOf(':', 4);
    return msidx > 4 && msidx < input.length - 1;
}
function assertDid(input) {
    if (!isDid(input))
        throw new TypeError(`Invalid DID: ${input}`);
}
function asDid(input) {
    assertDid(input);
    return input;
}
function isAtprotoProxy(input) {
    const { length, [0]: did, [1]: service } = input.split('#');
    return length === 2 && isDid(did) && isAtprotoServiceType(service);
}
function assertAtprotoProxy(input) {
    if (!isAtprotoProxy(input)) {
        throw new TypeError(`Invalid DID reference: ${input} (must be of the form did:example:alice#service)`);
    }
}
function asAtprotoProxy(input) {
    assertAtprotoProxy(input);
    return input;
}
//# sourceMappingURL=types.js.map