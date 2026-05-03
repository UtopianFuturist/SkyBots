import { CID } from 'multiformats/cid';
import { z } from 'zod';
export declare const typedJsonBlobRef: z.ZodObject<{
    $type: z.ZodLiteral<"blob">;
    ref: z.ZodEffects<z.ZodUnknown, CID, unknown>;
    mimeType: z.ZodString;
    size: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    $type: "blob";
    ref: CID;
    mimeType: string;
    size: number;
}, {
    $type: "blob";
    mimeType: string;
    size: number;
    ref?: unknown;
}>;
export type TypedJsonBlobRef = z.infer<typeof typedJsonBlobRef>;
export declare const untypedJsonBlobRef: z.ZodObject<{
    cid: z.ZodString;
    mimeType: z.ZodString;
}, "strict", z.ZodTypeAny, {
    mimeType: string;
    cid: string;
}, {
    mimeType: string;
    cid: string;
}>;
export type UntypedJsonBlobRef = z.infer<typeof untypedJsonBlobRef>;
export declare const jsonBlobRef: z.ZodUnion<[z.ZodObject<{
    $type: z.ZodLiteral<"blob">;
    ref: z.ZodEffects<z.ZodUnknown, CID, unknown>;
    mimeType: z.ZodString;
    size: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    $type: "blob";
    ref: CID;
    mimeType: string;
    size: number;
}, {
    $type: "blob";
    mimeType: string;
    size: number;
    ref?: unknown;
}>, z.ZodObject<{
    cid: z.ZodString;
    mimeType: z.ZodString;
}, "strict", z.ZodTypeAny, {
    mimeType: string;
    cid: string;
}, {
    mimeType: string;
    cid: string;
}>]>;
export type JsonBlobRef = z.infer<typeof jsonBlobRef>;
export declare class BlobRef {
    ref: CID;
    mimeType: string;
    size: number;
    original: JsonBlobRef;
    constructor(ref: CID, mimeType: string, size: number, original?: JsonBlobRef);
    static asBlobRef(obj: unknown): BlobRef | null;
    static fromJsonRef(json: JsonBlobRef): BlobRef;
    ipld(): JsonBlobRef;
    toJSON(): unknown;
}
//# sourceMappingURL=blob-refs.d.ts.map