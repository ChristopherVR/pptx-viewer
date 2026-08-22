/**
 * grid-spacing - pure conversion from an authored `p:gridSpacing` (EMU) into
 * the CSS pixel step used by every binding's snap-to-grid interaction and
 * grid-overlay rendering.
 *
 * `p:gridSpacing` lives under `p:viewPr` in `ppt/viewProps.xml`
 * (`PptxData.viewProperties.gridSpacing`), NOT under `p:presentationPr` in
 * `presProps.xml`. A real PowerPoint file never populates the latter, so a
 * binding reading it always falls back to its hardcoded default and silently
 * ignores the deck's authored grid.
 *
 * Each binding previously hardcoded its own hidden default (8px, 10px, 12px)
 * with no path from the loaded document at all. This is the one decision
 * function that turns an authored `PptxGridSpacing` into a pixel step, so a
 * binding only has to supply its own fallback constant and call this.
 */
import { EMU_PER_PX } from 'pptx-viewer-core';

/** The `cx`/`cy` shape of `PptxGridSpacing`. Only `cx` (horizontal spacing) is
 * used: PowerPoint's grid is square, and every binding's snap step is a
 * single number applied to both axes. */
export interface GridSpacingEmu {
	cx: number;
	cy?: number;
}

/**
 * Convert an authored grid spacing (EMU) to a CSS pixel step, rounding to the
 * nearest integer. Falls back to `fallbackPx` when `gridSpacing` is absent or
 * converts to a non-positive value.
 */
export function computeGridSpacingPx(
	gridSpacing: GridSpacingEmu | undefined,
	fallbackPx: number,
): number {
	if (gridSpacing) {
		const px = Math.round(gridSpacing.cx / EMU_PER_PX);
		if (px > 0) {
			return px;
		}
	}
	return fallbackPx;
}
