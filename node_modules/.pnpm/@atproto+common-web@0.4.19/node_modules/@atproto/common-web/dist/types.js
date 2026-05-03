"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.def = exports.schema = void 0;
const zod_1 = require("zod");
const lex_data_1 = require("@atproto/lex-data");
const cidSchema = zod_1.z.unknown().transform((obj, ctx) => {
    const cid = lex_data_1.CID.asCID(obj);
    if (cid == null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Not a valid CID',
        });
        return zod_1.z.NEVER;
    }
    return cid;
});
const carHeader = zod_1.z.object({
    version: zod_1.z.literal(1),
    roots: zod_1.z.array(cidSchema),
});
exports.schema = {
    cid: cidSchema,
    carHeader,
    bytes: zod_1.z.instanceof(Uint8Array),
    string: zod_1.z.string(),
    array: zod_1.z.array(zod_1.z.unknown()),
    map: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    unknown: zod_1.z.unknown(),
};
exports.def = {
    cid: {
        name: 'cid',
        schema: exports.schema.cid,
    },
    carHeader: {
        name: 'CAR header',
        schema: exports.schema.carHeader,
    },
    bytes: {
        name: 'bytes',
        schema: exports.schema.bytes,
    },
    string: {
        name: 'string',
        schema: exports.schema.string,
    },
    map: {
        name: 'map',
        schema: exports.schema.map,
    },
    unknown: {
        name: 'unknown',
        schema: exports.schema.unknown,
    },
};
//# sourceMappingURL=types.js.map