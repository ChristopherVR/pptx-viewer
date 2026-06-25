import type { PptxElement } from 'pptx-viewer-core';

import { DEFAULT_COLOR_CHANGE_TOLERANCE } from '../internal/shared';

/**
 * Pure (Angular-free) helpers for the `<a:clrChange>` colour-change image
 * effect. Kept out of the component so they can be unit-tested without TestBed
 * or a DOM, mirroring `model3d-renderer-helpers.ts`.
 */

/** Parsed `<a:clrChange>` parameters needed to drive the chroma-key. */
export interface ClrChangeParams {
	clrFrom: string;
	clrTo: string;
	/** Whether the target colour becomes fully transparent (alpha = 0). */
	clrToTransparent: boolean;
	/** Match tolerance percentage (0-100). */
	tolerance: number;
}

/**
 * Extract the colour-change effect from an element, or `undefined` when the
 * element carries no `imageEffects.clrChange` (or its `clrFrom` is empty).
 *
 * `clrFrom` is the source colour that must be present for the effect to do
 * anything, so a blank `clrFrom` is treated as "no effect" (matching React,
 * where the `clrChange` branch only fires when a valid effect object exists).
 */
export function getClrChangeParams(el: PptxElement): ClrChangeParams | undefined {
	const effects =
		'imageEffects' in el
			? (
					el as {
						imageEffects?: {
							clrChange?: { clrFrom?: string; clrTo?: string; clrToTransparent?: boolean };
						};
					}
				).imageEffects
			: undefined;
	const clrChange = effects?.clrChange;
	if (!clrChange || !clrChange.clrFrom) {
		return undefined;
	}
	return {
		clrFrom: clrChange.clrFrom,
		clrTo: clrChange.clrTo ?? clrChange.clrFrom,
		clrToTransparent: Boolean(clrChange.clrToTransparent),
		tolerance: DEFAULT_COLOR_CHANGE_TOLERANCE,
	};
}
