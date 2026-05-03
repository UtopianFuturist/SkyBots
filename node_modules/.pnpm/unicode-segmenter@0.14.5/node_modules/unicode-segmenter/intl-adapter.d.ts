/**
 * Adapter for `Intl.Segmenter` API
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
 *
 * @implements {Intl.Segmenter}
 */
export class Segmenter implements Intl.Segmenter {
    /**
     * @param {string} [locale]
     * @param {Intl.SegmenterOptions} [options={}]
     */
    constructor(locale?: string, options?: Intl.SegmenterOptions);
    /**
     * Impelements {@link Intl.Segmenter.segment}
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment
     *
     * @param {string} input
     * @return {SegmentsAdapter}
     */
    segment(input: string): SegmentsAdapter;
    /**
     * Impelements {@link Intl.Segmenter.resolvedOptions}
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/resolvedOptions
     * @return {Intl.ResolvedSegmenterOptions}
     */
    resolvedOptions(): Intl.ResolvedSegmenterOptions;
    /** @type {string} */
    [p_locale]: string;
    /** @type {Intl.ResolvedSegmenterOptions["granularity"]} */
    [p_granularity]: Intl.ResolvedSegmenterOptions["granularity"];
}
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment/Segments
 * @implements {Intl.Segments}
 */
declare class SegmentsAdapter implements Intl.Segments {
    /**
     * @param {string} input
     */
    constructor(input: string);
    /** @type {string} */
    input: string;
    /**
     * Impelements {@link Intl.Segments.containing}
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment/Segments/containing
     *
     * @param {number} [codeUnitIndex=0]
     * @return {Intl.SegmentData} A resolved segment data
     */
    containing(codeUnitIndex?: number): Intl.SegmentData;
    /**
     * @return {Intl.SegmentIterator<Intl.SegmentData>}
     */
    [Symbol.iterator](): Intl.SegmentIterator<Intl.SegmentData>;
}
declare const p_locale: unique symbol;
declare const p_granularity: unique symbol;
export {};
