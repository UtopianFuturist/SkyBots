import { DidString } from './did.js';
import { HandleString } from './handle.js';
/**
 * An "at-identifier" string - either a {@link DidString} or a {@link HandleString}
 *
 * @example `"did:plc:1234..."`, `"did:web:example.com"` or `"alice.bsky.social"`
 */
export type AtIdentifierString = DidString | HandleString;
/**
 * Discriminates {@link HandleString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a handle, `false` otherwise
 */
export declare function isHandleIdentifier(id: AtIdentifierString): id is HandleString;
/**
 * Discriminates {@link DidString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a DID, `false` otherwise
 */
export declare function isDidIdentifier(id: AtIdentifierString): id is DidString;
/**
 * Validates that a string is a valid {@link AtIdentifierString} format string,
 * throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'datetime' format requirements.
 * @see {@link AtIdentifierString}
 */
export declare function assertAtIdentifierString<I>(input: I): asserts input is I & AtIdentifierString;
/**
 * Casts a string to a {@link AtIdentifierString} if it is a valid at-identifier
 * string, throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'at-identifier' format requirements.
 * @see {@link AtIdentifierString}
 */
export declare function asAtIdentifierString<I>(input: I): I & AtIdentifierString;
/**
 * Type guard that checks if a value is a valid AT identifier (DID or handle).
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid AT identifier
 * @see {@link AtIdentifierString}
 */
export declare function isAtIdentifierString<I>(input: I): input is I & AtIdentifierString;
/**
 * Returns the input if it is a valid {@link AtIdentifierString} format string, or
 * `undefined` if it is not.
 *
 * @see {@link AtIdentifierString}
 */
export declare function ifAtIdentifierString<I>(input: I): undefined | (I & AtIdentifierString);
export { assertAtIdentifierString as ensureValidAtIdentifier, isAtIdentifierString as isValidAtIdentifier, };
//# sourceMappingURL=at-identifier.d.ts.map