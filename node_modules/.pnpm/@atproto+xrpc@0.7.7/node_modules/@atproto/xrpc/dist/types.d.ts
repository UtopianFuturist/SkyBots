import { z } from 'zod';
import { ValidationError } from '@atproto/lexicon';
export type QueryParams = Record<string, any>;
export type HeadersMap = Record<string, string | undefined>;
export type { 
/** @deprecated not to be confused with the WHATWG Headers constructor */
HeadersMap as Headers, };
export type Gettable<T> = T | (() => T);
export interface CallOptions {
    encoding?: string;
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export declare const errorResponseBody: z.ZodObject<{
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error?: string | undefined;
    message?: string | undefined;
}, {
    error?: string | undefined;
    message?: string | undefined;
}>;
export type ErrorResponseBody = z.infer<typeof errorResponseBody>;
export declare enum ResponseType {
    /**
     * Network issue, unable to get response from the server.
     */
    Unknown = 1,
    /**
     * Response failed lexicon validation.
     */
    InvalidResponse = 2,
    Success = 200,
    InvalidRequest = 400,
    AuthenticationRequired = 401,
    Forbidden = 403,
    XRPCNotSupported = 404,
    NotAcceptable = 406,
    PayloadTooLarge = 413,
    UnsupportedMediaType = 415,
    RateLimitExceeded = 429,
    InternalServerError = 500,
    MethodNotImplemented = 501,
    UpstreamFailure = 502,
    NotEnoughResources = 503,
    UpstreamTimeout = 504
}
export declare function httpResponseCodeToEnum(status: number): ResponseType;
export declare function httpResponseCodeToName(status: number): string;
export declare const ResponseTypeStrings: {
    readonly 1: "Unknown";
    readonly 2: "Invalid Response";
    readonly 200: "Success";
    readonly 400: "Invalid Request";
    readonly 401: "Authentication Required";
    readonly 403: "Forbidden";
    readonly 404: "XRPC Not Supported";
    readonly 406: "Not Acceptable";
    readonly 413: "Payload Too Large";
    readonly 415: "Unsupported Media Type";
    readonly 429: "Rate Limit Exceeded";
    readonly 500: "Internal Server Error";
    readonly 501: "Method Not Implemented";
    readonly 502: "Upstream Failure";
    readonly 503: "Not Enough Resources";
    readonly 504: "Upstream Timeout";
};
export declare function httpResponseCodeToString(status: number): string;
export declare class XRPCResponse {
    data: any;
    headers: HeadersMap;
    success: boolean;
    constructor(data: any, headers: HeadersMap);
}
export declare class XRPCError extends Error {
    error: string;
    headers?: HeadersMap | undefined;
    success: boolean;
    status: ResponseType;
    constructor(statusCode: number, error?: string, message?: string, headers?: HeadersMap | undefined, options?: ErrorOptions);
    static from(cause: unknown, fallbackStatus?: ResponseType): XRPCError;
}
export declare class XRPCInvalidResponseError extends XRPCError {
    lexiconNsid: string;
    validationError: ValidationError;
    responseBody: unknown;
    constructor(lexiconNsid: string, validationError: ValidationError, responseBody: unknown);
}
//# sourceMappingURL=types.d.ts.map