import { AtIdentifierString } from './at-identifier.js';
import { AtUriString } from './aturi_validation.js';
import { DidString } from './did.js';
import { NsidString } from './nsid.js';
import { RecordKeyString } from './recordkey.js';
export * from './aturi_validation.js';
export type { AtIdentifierString, AtUriString, DidString, NsidString, RecordKeyString, };
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
    get did(): DidString;
    get hostname(): AtIdentifierString;
    set hostname(v: string);
    get search(): string;
    set search(v: string);
    get collection(): string;
    get collectionSafe(): NsidString;
    set collection(v: string);
    unsafelySetCollection(v: string): void;
    get rkey(): string;
    get rkeySafe(): RecordKeyString;
    set rkey(v: string);
    unsafelySetRkey(v: string): void;
    get href(): AtUriString;
    toString(): AtUriString;
}
//# sourceMappingURL=aturi.d.ts.map