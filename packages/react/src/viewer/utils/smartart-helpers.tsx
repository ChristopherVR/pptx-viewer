import type { PptxElement, PptxSmartArtData, SmartArtStyle } from 'pptx-viewer-core';
import {
	resolvePalette as sharedResolvePalette,
	SMARTART_DEFAULT_PALETTE,
} from 'pptx-viewer-shared';

/**
 * Thin element-level adapters over the shared SmartArt palette/style helpers.
 *
 * Everything else this module used to carry (palette cycling, opacity, shadow,
 * stroke, truncation, tree building, the named-layout -> category map and the
 * chrome wrapper) either already lived in `pptx-viewer-shared` and was
 * re-exported here for history's sake, or existed only to feed React's private
 * SmartArt layout tree. That tree now routes through the shared engine
 * (`computeSmartArtLayout`), so the re-exports and the category map went with
 * it. Import the shared symbols directly.
 */

/** Resolve palette from an element's smartArtData; prefers color-transform fills. */
export function resolvePalette(el: PptxElement): string[] {
	return el.type === 'smartArt' ? sharedResolvePalette(el.smartArtData) : SMARTART_DEFAULT_PALETTE;
}

/** Resolve style from an element's smartArtData. */
export function resolveStyle(el: PptxElement): SmartArtStyle {
	if (el.type !== 'smartArt' || !el.smartArtData) {
		return 'flat';
	}
	return el.smartArtData.style ?? 'flat';
}

/** Resolve palette directly from a PptxSmartArtData object. */
export function resolveSmartArtDataPalette(data: PptxSmartArtData): string[] {
	return sharedResolvePalette(data);
}
