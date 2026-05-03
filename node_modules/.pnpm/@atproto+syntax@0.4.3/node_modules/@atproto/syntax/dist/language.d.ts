export type LanguageTag = {
    grandfathered?: string;
    language?: string;
    extlang?: string;
    script?: string;
    region?: string;
    variant?: string;
    extension?: string;
    privateUse?: string;
};
export declare function parseLanguageString(input: string): LanguageTag | null;
/**
 * Validates well-formed BCP 47 syntax
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1}
 */
export declare function isValidLanguage(input: string): boolean;
//# sourceMappingURL=language.d.ts.map