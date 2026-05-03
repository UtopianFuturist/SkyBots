import { Base64Alphabet } from './uint8array-base64.js';
declare global {
    interface Uint8Array {
        /**
         * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64 Uint8Array.prototype.toBase64()}
         */
        toBase64?: (options?: {
            /** @default 'base64' */
            alphabet?: 'base64' | 'base64url';
            omitPadding?: boolean;
        }) => string;
    }
}
export declare const toBase64Native: ((bytes: Uint8Array, alphabet?: Base64Alphabet) => string) | null;
export declare const toBase64Node: ((bytes: Uint8Array, alphabet?: Base64Alphabet) => string) | null;
export declare function toBase64Ponyfill(bytes: Uint8Array, alphabet?: Base64Alphabet): string;
//# sourceMappingURL=uint8array-to-base64.d.ts.map