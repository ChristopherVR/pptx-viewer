/**
 * image-crop-save.ts - pure helpers for writing `a:blipFill/a:srcRect` on
 * save.
 *
 * Extracted from {@link PptxHandlerRuntimeSaveImageEffects} so that module
 * (already near the file-size budget) does not grow further, and so the
 * signed-crop maths (issue G2) is directly unit-testable without a class.
 */
import type { XmlObject } from '../../types';

/**
 * Bound a source-crop fraction to a safe magnitude while preserving sign.
 * A negative value is a legitimate outward crop (PowerPoint pads the image
 * inside its frame instead of cropping it, e.g. a photo smaller than its
 * placeholder), so it must survive save the same way `a:fillRect`'s signed
 * insets already do (issue #132); only the magnitude is capped.
 */
export function clampCropForSave(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	const magnitude = Math.min(0.95, Math.abs(value));
	return value < 0 ? -magnitude : magnitude;
}

/** The four `a:srcRect` inset fractions a picture element carries. */
export interface CropInsets {
	cropLeft?: number;
	cropTop?: number;
	cropRight?: number;
	cropBottom?: number;
}

/**
 * Build the `a:srcRect` XML node for a picture's crop insets, or `undefined`
 * when there is no crop to write (the caller should delete any existing
 * `a:srcRect` in that case).
 */
export function buildSrcRectXml(insets: CropInsets): XmlObject | undefined {
	const cropLeft = clampCropForSave(insets.cropLeft);
	const cropTop = clampCropForSave(insets.cropTop);
	const cropRight = clampCropForSave(insets.cropRight);
	const cropBottom = clampCropForSave(insets.cropBottom);

	// Individual magnitudes, not the signed sum: a negative left inset paired
	// with a zero/positive right inset can sum near zero yet still be an
	// authored outward crop that must be written.
	const hasCrop =
		Math.abs(cropLeft) > 0.0001 ||
		Math.abs(cropTop) > 0.0001 ||
		Math.abs(cropRight) > 0.0001 ||
		Math.abs(cropBottom) > 0.0001;
	if (!hasCrop) {
		return undefined;
	}

	const horizontalCrop = cropLeft + cropRight;
	const verticalCrop = cropTop + cropBottom;
	// A crop that swallows (almost) the whole source would divide by ~0
	// below, so the pair is rescaled to leave a 1% sliver rather than
	// producing Infinity. Only triggers for large POSITIVE sums approaching
	// the frame's full width/height; a negative (outward) sum never does.
	const safeHorizontalScale = horizontalCrop >= 0.99 ? 0.99 / horizontalCrop : 1;
	const safeVerticalScale = verticalCrop >= 0.99 ? 0.99 / verticalCrop : 1;
	const normalizedLeft = clampCropForSave(cropLeft * safeHorizontalScale);
	const normalizedRight = clampCropForSave(cropRight * safeHorizontalScale);
	const normalizedTop = clampCropForSave(cropTop * safeVerticalScale);
	const normalizedBottom = clampCropForSave(cropBottom * safeVerticalScale);

	return {
		'@_l': String(Math.round(normalizedLeft * 100000)),
		'@_t': String(Math.round(normalizedTop * 100000)),
		'@_r': String(Math.round(normalizedRight * 100000)),
		'@_b': String(Math.round(normalizedBottom * 100000)),
	};
}
