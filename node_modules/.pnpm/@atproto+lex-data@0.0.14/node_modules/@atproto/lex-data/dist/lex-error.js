"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexError = void 0;
/**
 * Error class for Lexicon-related errors.
 *
 * LexError extends the standard JavaScript {@link Error} with AT
 * Protocol-specific functionality including an `error` code property and
 * methods for representation as (XRPC) error responses payloads.
 *
 * @typeParam N - The specific error code type
 */
class LexError extends Error {
    error;
    name = 'LexError';
    /**
     * @param error - The error code identifying the type of error, typically used in XRPC error payloads
     * @param message - Optional human-readable error message
     * @param options - Standard Error options (e.g., cause)
     */
    constructor(error, message, // Defaults to empty string in Error constructor
    options) {
        super(message, options);
        this.error = error;
    }
    /**
     * Returns a string representation of this error.
     *
     * @returns A formatted string: "LexErrorClass: [MyErrorCode] My message"
     */
    toString() {
        return `${this.name}: [${this.error}] ${this.message}`;
    }
    /**
     * Converts this error to a JSON-serializable object.
     *
     * @returns The error data suitable for JSON serialization
     * @note The `error` generic is *not* constrained to {@link N} to allow subclasses to override the error code type.
     */
    toJSON() {
        const { error, message } = this;
        return { error, message: message || undefined };
    }
}
exports.LexError = LexError;
//# sourceMappingURL=lex-error.js.map