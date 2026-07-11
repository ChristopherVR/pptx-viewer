/**
 * Pure (framework-agnostic) helpers for the image adjustments + crop inspector
 * panel. Readers extract current values from a PptxElement (falling back to
 * sensible defaults); patch-builders produce shallow-merge-ready
 * `Partial<PptxElement>` objects safe to pass to each binding's element-update
 * action. Mirrors the pattern used by `gradient-picker.ts` / `text-advanced.ts`.
 *
 * Scope: brightness/contrast/saturation (`PptxImageEffects`) and the four crop
 * insets (`PptxImageProperties.cropLeft/Top/Right/Bottom`). Other image effects
 * (duotone, artistic filters, alpha primitives) are out of scope for the
 * inspector's "highest-traffic" surface; see `image-effects.ts` for the full
 * read-side effect model.
 */

import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

// -- Brightness / contrast / saturation ---------------------------------------

/** The editable brightness/contrast/saturation state (each -100..100, 0 = neutral). */
export interface ImageAdjustmentsState {
	brightness: number;
	contrast: number;
	saturation: number;
}

/** Changes to apply to `imageEffects`, limited to the adjustment sliders. */
export type ImageAdjustmentsChanges = Partial<
	Pick<PptxImageEffects, 'brightness' | 'contrast' | 'saturation'>
>;

/** Read the current brightness/contrast/saturation off an element (0 when unset). */
export function imageAdjustmentsStateOf(el: PptxElement): ImageAdjustmentsState {
	const fx = isImageLikeElement(el) ? el.imageEffects : undefined;
	return {
		brightness: fx?.brightness ?? 0,
		contrast: fx?.contrast ?? 0,
		saturation: fx?.saturation ?? 0,
	};
}

/**
 * Build a Partial<PptxElement> that merges the given adjustment changes into
 * the element's existing `imageEffects` without dropping other effect fields.
 * No-op (returns `{}`) for non-image elements.
 */
export function imageAdjustmentsPatch(
	el: PptxElement,
	changes: ImageAdjustmentsChanges,
): Partial<PptxElement> {
	if (!isImageLikeElement(el)) {
		return {};
	}
	return {
		imageEffects: {
			...el.imageEffects,
			...changes,
		},
	} as Partial<PptxElement>;
}

// -- Crop insets ---------------------------------------------------------------

/** The four crop insets as 0..1 fractions (0 = uncropped on that edge). */
export interface ImageCropState {
	cropLeft: number;
	cropTop: number;
	cropRight: number;
	cropBottom: number;
}

/** Changes to apply to the element's crop insets. */
export type ImageCropChanges = Partial<ImageCropState>;

/** Read the current crop insets off an element (0 on every edge when unset). */
export function imageCropStateOf(el: PptxElement): ImageCropState {
	if (!isImageLikeElement(el)) {
		return { cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 };
	}
	return {
		cropLeft: el.cropLeft ?? 0,
		cropTop: el.cropTop ?? 0,
		cropRight: el.cropRight ?? 0,
		cropBottom: el.cropBottom ?? 0,
	};
}

/** Clamp a crop fraction to the sane `[0, 0.9]` range (never crop past 90% of an edge). */
function clampCropFraction(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(0.9, Math.max(0, value));
}

/**
 * Build a Partial<PptxElement> that merges the given crop-inset changes onto
 * the element. No-op (returns `{}`) for non-image elements.
 */
export function imageCropPatch(el: PptxElement, changes: ImageCropChanges): Partial<PptxElement> {
	if (!isImageLikeElement(el)) {
		return {};
	}
	const patch: ImageCropChanges = {};
	for (const [key, value] of Object.entries(changes) as Array<[keyof ImageCropState, number]>) {
		if (value !== undefined) {
			patch[key] = clampCropFraction(value);
		}
	}
	return patch as Partial<PptxElement>;
}
