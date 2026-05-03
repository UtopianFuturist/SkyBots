import { Base64Alphabet } from './uint8array-base64.js';
declare global {
    interface Uint8ArrayConstructor {
        /**
         * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64 Uint8Array.fromBase64()}
         */
        fromBase64?: (b64: string, options?: {
            /** @default 'base64' */
            alphabet?: 'base64' | 'base64url';
            lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial';
        }) => Uint8Array;
    }
}
export declare const fromBase64Native: ((b64: string, alphabet?: Base64Alphabet) => Uint8Array) | null;
export declare const fromBase64Node: ((b64: string, alphabet?: Base64Alphabet) => Uint8Array) | null;
export declare function fromBase64Ponyfill(b64: string, alphabet?: Base64Alphabet): Uint8Array;
//# sourceMappingURL=uint8array-from-base64.d.ts.map