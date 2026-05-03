/**
 * @template {number} [T=number]
 * @typedef {[from: number, to: number, category: T]} CategorizedUnicodeRange
 */
/**
 * @typedef {CategorizedUnicodeRange<0>} UnicodeRange
 */
/**
 * @typedef {string & { __tag: 'UnicodeDataEncoding' }} UnicodeDataEncoding
 *
 * Encoding for array of {@link UnicodeRange}, items separated by comma.
 *
 * Each {@link UnicodeDataRow} packed as a base36 integer:
 *
 * padding  = to - from
 * encoding = base36(from) + ',' + base36(padding)
 *
 * Notes:
 * - base36 can hold surprisingly large numbers in a few characters.
 * - The biggest codepoint is 0xE01F0 (918,000) at this point
 * - The max value of a category is 23; https://www.unicode.org/reports/tr29/tr29-45.html#Table_Word_Break_Property_Values
 * - The longest range is 42,720; CJK UNIFIED IDEOGRAPH-20000..CJK UNIFIED IDEOGRAPH-2A6DF
 */
/**
 * @template {number} [T=number]
 * @param {UnicodeDataEncoding} data
 * @param {string} [cats='']
 * @returns {Array<CategorizedUnicodeRange<T>>}
 */
export function decodeUnicodeData<T extends number = number>(data: UnicodeDataEncoding, cats?: string): Array<CategorizedUnicodeRange<T>>;
/**
 * @template {object} Ext
 * @typedef {{
 *   segment: string,
 *   index: number,
 *   input: string,
 * } & Ext} SegmentOutput
 */
/**
 * @template {object} T
 * @typedef {IterableIterator<SegmentOutput<T>>} Segmenter
 */
/**
 * @template {number} [T=number]
 * @param {number} cp
 * @param {CategorizedUnicodeRange<T>[]} ranges
 * @return {number} index of matched unicode range, or -1 if no match
 */
export function findUnicodeRangeIndex<T extends number = number>(cp: number, ranges: CategorizedUnicodeRange<T>[], lo?: number, hi?: number): number;
export type CategorizedUnicodeRange<T extends number = number> = [from: number, to: number, category: T];
export type UnicodeRange = CategorizedUnicodeRange<0>;
/**
 *
 * Encoding for array of {@link UnicodeRange}, items separated by comma.
 *
 * Each {@link UnicodeDataRow} packed as a base36 integer:
 *
 * padding  = to - from
 * encoding = base36(from) + ',' + base36(padding)
 *
 * Notes:
 * - base36 can hold surprisingly large numbers in a few characters.
 * - The biggest codepoint is 0xE01F0 (918,000) at this point
 * - The max value of a category is 23; https://www.unicode.org/reports/tr29/tr29-45.html#Table_Word_Break_Property_Values
 * - The longest range is 42,720; CJK UNIFIED IDEOGRAPH-20000..CJK UNIFIED IDEOGRAPH-2A6DF
 */
export type UnicodeDataEncoding = string & {
    __tag: "UnicodeDataEncoding";
};
export type SegmentOutput<Ext extends object> = {
    segment: string;
    index: number;
    input: string;
} & Ext;
export type Segmenter<T extends object> = IterableIterator<SegmentOutput<T>>;
