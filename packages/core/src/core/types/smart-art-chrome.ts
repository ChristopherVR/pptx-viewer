/**
 * SmartArt chrome (`dgm:bg` / `dgm:whole`) types.
 *
 * Split out of `smart-art.ts` to keep that file within the repo's per-file
 * line budget; re-exported there so existing imports are unaffected.
 *
 * @module pptx-types/smart-art-chrome
 */

import type { XmlObject } from './common';

/**
 * Background / outline extracted from `dgm:bg` and `dgm:whole`.
 *
 * @example
 * ```ts
 * const chrome: PptxSmartArtChrome = {
 *   backgroundColor: "#F0F0F0",
 *   outlineColor: "#333333",
 *   outlineWidth: 1,
 * };
 * // => satisfies PptxSmartArtChrome
 * ```
 */
export interface PptxSmartArtChrome {
	/**
	 * Background fill colour (hex). When the real `dgm:bg` fill is a gradient
	 * or pattern (see {@link PptxSmartArtChrome.backgroundFillXml}), this is an
	 * APPROXIMATION (the gradient's first stop, or the pattern's foreground
	 * colour) for a consumer that only wants one display colour, not the full fill.
	 */
	backgroundColor?: string;
	/**
	 * Raw `dgm:bg` fill XML, present only when the background is a gradient or
	 * pattern fill (a solid fill is fully captured by {@link PptxSmartArtChrome.backgroundColor}
	 * alone). Round-trip only: `smartart-save-chrome.ts` re-emits this verbatim
	 * instead of flattening the fill to a solid colour on save.
	 */
	backgroundFillXml?: PptxSmartArtRawBackgroundFill;
	/** Outline stroke colour (hex). */
	outlineColor?: string;
	/** Outline stroke width in points. */
	outlineWidth?: number;
}

/**
 * A `dgm:bg` fill this viewer doesn't fully model as first-class chrome
 * (gradient or pattern), preserved verbatim for round-trip. See
 * {@link PptxSmartArtChrome.backgroundFillXml}.
 */
export interface PptxSmartArtRawBackgroundFill {
	/** Local element name of the fill under `dgm:bg` (`gradFill` or `pattFill`). */
	localName: 'gradFill' | 'pattFill';
	/** The fill element's own attributes/children, as parsed. */
	xml: XmlObject;
}
