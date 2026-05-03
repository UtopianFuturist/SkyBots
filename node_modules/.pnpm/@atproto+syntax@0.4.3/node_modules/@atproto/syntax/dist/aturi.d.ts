import { AtIdentifierString } from './at-identifier.js';
import { AtUriString } from './aturi_validation.js';
export * from './aturi_validation.js';
export declare const ATP_URI_REGEX: RegExp;
export declare class AtUri {
    hash: string;
    host: AtIdentifierString;
    pathname: string;
    searchParams: URLSearchParams;
    constructor(uri: string, base?: string | AtUri);
    static make(handleOrDid: string, collection?: string, rkey?: string): AtUri;
    get protocol(): string;
    get origin(): `at://did:${string}:${string}` | `at://${string}.${string}`;
    get hostname(): string;
    set hostname(v: string);
    get search(): string;
    set search(v: string);
    get collection(): string;
    set collection(v: string);
    get rkey(): string;
    set rkey(v: string);
    get href(): AtUriString;
    toString(): AtUriString;
}
//# sourceMappingURL=aturi.d.ts.map