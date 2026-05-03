import { z } from 'zod';
import { CID } from '@atproto/lex-data';
import { Def } from './check';
declare const carHeader: z.ZodObject<{
    version: z.ZodLiteral<1>;
    roots: z.ZodArray<z.ZodEffects<z.ZodUnknown, CID, unknown>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    roots: CID[];
}, {
    version: 1;
    roots: unknown[];
}>;
export type CarHeader = z.infer<typeof carHeader>;
export declare const schema: {
    cid: z.ZodEffects<z.ZodUnknown, CID, unknown>;
    carHeader: z.ZodObject<{
        version: z.ZodLiteral<1>;
        roots: z.ZodArray<z.ZodEffects<z.ZodUnknown, CID, unknown>, "many">;
    }, "strip", z.ZodTypeAny, {
        version: 1;
        roots: CID[];
    }, {
        version: 1;
        roots: unknown[];
    }>;
    bytes: z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>;
    string: z.ZodString;
    array: z.ZodArray<z.ZodUnknown, "many">;
    map: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    unknown: z.ZodUnknown;
};
export declare const def: {
    cid: Def<CID>;
    carHeader: Def<CarHeader>;
    bytes: Def<Uint8Array>;
    string: Def<string>;
    map: Def<Record<string, unknown>>;
    unknown: Def<unknown>;
};
export type ArrayEl<A> = A extends readonly (infer T)[] ? T : never;
export type NotEmptyArray<T> = [T, ...T[]];
export {};
//# sourceMappingURL=types.d.ts.map