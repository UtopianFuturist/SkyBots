export type TidString = string;
export declare function ensureValidTid<I extends string>(input: I): asserts input is I & TidString;
export declare function isValidTid<I extends string>(input: I): input is I & TidString;
export declare class InvalidTidError extends Error {
}
//# sourceMappingURL=tid.d.ts.map