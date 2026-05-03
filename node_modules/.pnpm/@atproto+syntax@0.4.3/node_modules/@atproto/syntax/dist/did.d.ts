export type DidString<M extends string = string> = `did:${M}:${string}`;
export declare function ensureValidDid<I extends string>(input: I): asserts input is I & DidString;
export declare function ensureValidDidRegex<I extends string>(input: I): asserts input is I & DidString;
export declare function isValidDid<I extends string>(input: I): input is I & DidString;
export declare class InvalidDidError extends Error {
}
//# sourceMappingURL=did.d.ts.map