"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CID = exports.SHA512_HASH_CODE = exports.SHA256_HASH_CODE = exports.RAW_DATA_CODEC = exports.CBOR_DATA_CODEC = void 0;
exports.multihashEquals = multihashEquals;
exports.asMultiformatsCID = asMultiformatsCID;
exports.isRawCid = isRawCid;
exports.isDaslCid = isDaslCid;
exports.isCborCid = isCborCid;
exports.checkCid = checkCid;
exports.isCid = isCid;
exports.ifCid = ifCid;
exports.asCid = asCid;
exports.decodeCid = decodeCid;
exports.parseCid = parseCid;
exports.validateCidString = validateCidString;
exports.parseCidSafe = parseCidSafe;
exports.ensureValidCidString = ensureValidCidString;
exports.isCidForBytes = isCidForBytes;
exports.createCid = createCid;
exports.cidForCbor = cidForCbor;
exports.cidForRawBytes = cidForRawBytes;
exports.cidForRawHash = cidForRawHash;
const cid_1 = require("multiformats/cid");
Object.defineProperty(exports, "CID", { enumerable: true, get: function () { return cid_1.CID; } });
const digest_1 = require("multiformats/hashes/digest");
const sha2_1 = require("multiformats/hashes/sha2");
const util_js_1 = require("./lib/util.js");
const object_js_1 = require("./object.js");
const uint8array_js_1 = require("./uint8array.js");
/**
 * Codec code that indicates the CID references a CBOR-encoded data structure.
 *
 * Used when encoding structured data in AT Protocol repositories.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
exports.CBOR_DATA_CODEC = 0x71;
/**
 * Codec code that indicates the CID references raw binary data (like media blobs).
 *
 * Used in DASL CIDs for binary blobs like images and media.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
exports.RAW_DATA_CODEC = 0x55;
/**
 * Hash code that indicates that a CID uses SHA-256.
 */
exports.SHA256_HASH_CODE = sha2_1.sha256.code;
/**
 * Hash code that indicates that a CID uses SHA-512.
 */
exports.SHA512_HASH_CODE = sha2_1.sha512.code;
/**
 * Compares two {@link Multihash} for equality.
 *
 * @param a - First {@link Multihash}
 * @param b - Second {@link Multihash}
 * @returns `true` if both multihashes have the same code and digest
 */
function multihashEquals(a, b) {
    if (a === b)
        return true;
    return a.code === b.code && (0, uint8array_js_1.ui8Equals)(a.digest, b.digest);
}
/**
 * Converts a {@link Cid} to a multiformats {@link CID} instance.
 *
 * @deprecated Packages depending on `@atproto/lex-data` should use the
 * {@link Cid} interface instead of relying on `multiformats`'s {@link CID}
 * implementation directly. This is to avoid compatibility issues, and in order
 * to allow better portability, compatibility and future updates.
 */
function asMultiformatsCID(input) {
    const cid = 
    // Already a multiformats CID instance
    cid_1.CID.asCID(input) ??
        // Create a new multiformats CID instance
        cid_1.CID.create(input.version, input.code, (0, digest_1.create)(input.multihash.code, input.multihash.digest));
    // @NOTE: the "satisfies" operator is used here to ensure that the Cid
    // interface is indeed compatible with multiformats' CID implementation, which
    // allows us to safely rely on multiformats' CID implementation where Cid are
    // needed.
    return cid;
}
/**
 * Type guard to check if a CID is a raw binary CID.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is a version 1 CID with raw multicodec
 */
function isRawCid(cid) {
    return cid.version === 1 && cid.code === exports.RAW_DATA_CODEC;
}
/**
 * Type guard to check if a CID is DASL compliant.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is DASL compliant (v1, raw/dag-cbor, sha256)
 */
function isDaslCid(cid) {
    return (cid.version === 1 &&
        (cid.code === exports.RAW_DATA_CODEC || cid.code === exports.CBOR_DATA_CODEC) &&
        cid.multihash.code === exports.SHA256_HASH_CODE &&
        cid.multihash.digest.byteLength === 0x20 // Should always be 32 bytes (256 bits) for SHA-256, but double-checking anyways
    );
}
/**
 * Type guard to check if a CID is a DAG-CBOR CID.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is a DAG-CBOR CID (v1, dag-cbor, sha256)
 */
function isCborCid(cid) {
    return cid.code === exports.CBOR_DATA_CODEC && isDaslCid(cid);
}
function checkCid(cid, options) {
    switch (options?.flavor) {
        case undefined:
            return true;
        case 'cbor':
            return isCborCid(cid);
        case 'dasl':
            return isDaslCid(cid);
        case 'raw':
            return isRawCid(cid);
        default:
            throw new TypeError(`Unknown CID flavor: ${options?.flavor}`);
    }
}
function isCid(value, options) {
    return isCidImplementation(value) && checkCid(value, options);
}
function ifCid(value, options) {
    if (isCid(value, options))
        return value;
    return null;
}
function asCid(value, options) {
    if (isCid(value, options))
        return value;
    throw new Error(`Invalid ${options?.flavor ? `${options.flavor} CID` : 'CID'} "${value}"`);
}
function decodeCid(cidBytes, options) {
    const cid = cid_1.CID.decode(cidBytes);
    return asCid(cid, options);
}
function parseCid(input, options) {
    const cid = cid_1.CID.parse(input);
    return asCid(cid, options);
}
/**
 * Validates that a string is a valid CID representation.
 *
 * Unlike {@link parseCid}, this function returns a boolean instead of throwing.
 * It also verifies that the string is the canonical representation of the CID.
 *
 * @param input - The string to validate
 * @param options - Optional flavor constraints
 * @returns `true` if the string is a valid CID
 */
function validateCidString(input, options) {
    return parseCidSafe(input, options)?.toString() === input;
}
function parseCidSafe(input, options) {
    try {
        return parseCid(input, options);
    }
    catch {
        return null;
    }
}
/**
 * Ensures that a string is a valid CID representation.
 *
 * @param input - The string to validate
 * @param options - Optional flavor constraints
 * @throws If the string is not a valid CID
 */
function ensureValidCidString(input, options) {
    if (!validateCidString(input, options)) {
        throw new Error(`Invalid CID string "${input}"`);
    }
}
/**
 * Verifies whether the multihash of a given {@link cid} matches the hash of the provided {@link bytes}.
 * @params cid The CID to match against the bytes.
 * @params bytes The bytes to verify.
 * @returns true if the CID matches the bytes, false otherwise.
 */
async function isCidForBytes(cid, bytes) {
    if (cid.multihash.code === sha2_1.sha256.code) {
        const multihash = await sha2_1.sha256.digest(bytes);
        return multihashEquals(multihash, cid.multihash);
    }
    if (cid.multihash.code === sha2_1.sha512.code) {
        const multihash = await sha2_1.sha512.digest(bytes);
        return multihashEquals(multihash, cid.multihash);
    }
    // Don't know how to verify other multihash codes
    throw new Error(`Unsupported CID multihash code: ${(0, util_js_1.toHexString)(cid.multihash.code)}`);
}
/**
 * Creates a CID from a multicodec, multihash code, and digest.
 *
 * @param code - The multicodec content type code
 * @param multihashCode - The multihash algorithm code
 * @param digest - The raw hash digest bytes
 * @returns A new CIDv1 instance
 *
 * @example
 * ```typescript
 * import { createCid, RAW_DATA_CODEC, SHA256_HASH_CODE } from '@atproto/lex-data'
 *
 * const cid = createCid(RAW_DATA_CODEC, SHA256_HASH_CODE, hashDigest)
 * ```
 */
function createCid(code, multihashCode, digest) {
    const cid = cid_1.CID.createV1(code, (0, digest_1.create)(multihashCode, digest));
    return cid;
}
/**
 * Creates a DAG-CBOR CID for the given CBOR bytes.
 *
 * Computes the SHA-256 hash of the bytes and creates a CIDv1 with DAG-CBOR multicodec.
 *
 * @param bytes - The CBOR-encoded bytes to hash
 * @returns A promise that resolves to the CborCid
 */
async function cidForCbor(bytes) {
    const multihash = await sha2_1.sha256.digest(bytes);
    return cid_1.CID.createV1(exports.CBOR_DATA_CODEC, multihash);
}
/**
 * Creates a raw CID for the given binary bytes.
 *
 * Computes the SHA-256 hash of the bytes and creates a CIDv1 with raw multicodec.
 *
 * @param bytes - The raw binary bytes to hash
 * @returns A promise that resolves to the RawCid
 */
async function cidForRawBytes(bytes) {
    const multihash = await sha2_1.sha256.digest(bytes);
    return cid_1.CID.createV1(exports.RAW_DATA_CODEC, multihash);
}
/**
 * Creates a raw CID from an existing SHA-256 hash digest.
 *
 * @param digest - The SHA-256 hash digest (must be 32 bytes)
 * @returns A RawCid with the given digest
 * @throws If the digest is not a valid SHA-256 hash (not 32 bytes)
 */
function cidForRawHash(digest) {
    // Fool-proofing
    if (digest.length !== 0x20) {
        throw new Error(`Invalid SHA-256 hash length: ${(0, util_js_1.toHexString)(digest.length)}`);
    }
    return createCid(exports.RAW_DATA_CODEC, sha2_1.sha256.code, digest);
}
function isCidImplementation(value) {
    if (cid_1.CID.asCID(value)) {
        // CIDs created using older multiformats versions did not have a "bytes"
        // property.
        return value.bytes != null;
    }
    else {
        // Unknown implementation, do a structural check
        try {
            if (!(0, object_js_1.isObject)(value))
                return false;
            const val = value;
            if (val.version !== 0 && val.version !== 1)
                return false;
            if (!(0, util_js_1.isUint8)(val.code))
                return false;
            if (!(0, object_js_1.isObject)(val.multihash))
                return false;
            const mh = val.multihash;
            if (!(0, util_js_1.isUint8)(mh.code))
                return false;
            if (!(mh.digest instanceof Uint8Array))
                return false;
            // Ensure that the bytes array is consistent with other properties
            if (!(val.bytes instanceof Uint8Array))
                return false;
            if (val.bytes[0] !== val.version)
                return false;
            if (val.bytes[1] !== val.code)
                return false;
            if (val.bytes[2] !== mh.code)
                return false;
            if (val.bytes[3] !== mh.digest.length)
                return false;
            if (val.bytes.length !== 4 + mh.digest.length)
                return false;
            if (!(0, uint8array_js_1.ui8Equals)(val.bytes.subarray(4), mh.digest))
                return false;
            if (typeof val.equals !== 'function')
                return false;
            if (val.equals(val) !== true)
                return false;
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=cid.js.map