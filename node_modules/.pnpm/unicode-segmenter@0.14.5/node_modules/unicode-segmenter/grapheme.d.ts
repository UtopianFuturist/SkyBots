/**
 * Unicode segmentation by extended grapheme rules.
 *
 * This is fully compatible with the {@link Intl.Segmenter.segment} API
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment
 *
 * @param {string} input
 * @return {GraphemeSegmenter} iterator for grapheme cluster segments
 */
export function graphemeSegments(input: string): GraphemeSegmenter;
/**
 * Count number of extended grapheme clusters in given text.
 *
 * NOTE:
 *
 * This function is a small wrapper around {@link graphemeSegments}.
 *
 * If you call it more than once at a time, consider memoization
 * or use {@link graphemeSegments} or {@link splitGraphemes} once instead
 *
 * @param {string} text
 * @return {number} count of grapheme clusters
 */
export function countGraphemes(text: string): number;
/**
 * Split given text into extended grapheme clusters.
 *
 * @param {string} text
 * @return {IterableIterator<string>} iterator for grapheme clusters
 *
 * @see {@link graphemeSegments} if you need extra information.
 *
 * @example
 * [...splitGraphemes('abc')] // => ['a', 'b', 'c']
 */
export function splitGraphemes(text: string): IterableIterator<string>;
export type GC_Any = import("./_grapheme_data.js").GC_Any;
export type GraphemeCategoryNum = import("./_grapheme_data.js").GraphemeCategoryNum;
export type GraphemeCategoryRange = import("./_grapheme_data.js").GraphemeCategoryRange;
export type GraphemeSegmentExtra = {
    /**
     * The first code point of the segment
     */
    _hd: number;
    /**
     * Beginning Grapheme_Cluster_Break category of the segment
     */
    _catBegin: GraphemeCategoryNum;
    /**
     * Ending Grapheme_Cluster_Break category of the segment
     */
    _catEnd: GraphemeCategoryNum;
};
export type GraphemeSegmenter = import("./core.js").Segmenter<GraphemeSegmentExtra>;
import { GraphemeCategory } from './_grapheme_data.js';
export { GraphemeCategory, countGraphemes as countGrapheme };
