export type RecordKeyString = string;
export declare function ensureValidRecordKey<I extends string>(input: I): asserts input is I & RecordKeyString;
export declare function isValidRecordKey<I extends string>(input: I): input is I & RecordKeyString;
export declare class InvalidRecordKeyError extends Error {
}
//# sourceMappingURL=recordkey.d.ts.map