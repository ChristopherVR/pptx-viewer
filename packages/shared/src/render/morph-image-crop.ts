/**
 * Morphing a picture's SOURCE CROP (`a:srcRect`) and fill-rect placement.
 *
 * PowerPoint's Format Picture > Size panel exposes "Scale Height" and "Scale
 * Width", but there is no scale attribute in OOXML: a picture scaled to 113%
 * is a picture whose frame is unchanged and whose `a:srcRect` crops ~11.5% of
 * the source away, so the surviving region is magnified into the same box. Two
 * slides that differ only in that scale therefore have byte-identical
 * `a:off`/`a:ext`, the same blip, and the same everything else the morph engine
 * compares - so the pair looked INERT, no animation was emitted for either
 * half, and the picture cut from one crop to the other in a single frame
 * instead of zooming (issue #148).
 *
 * The crop is rendered as a `transform` on the `<img>` inside the element's
 * frame (see `buildImageFitTransform`), so morphing it is a matter of animating
 * that node from the outgoing picture's transform to the incoming one's. Both
 * ends are padded to the same transform function list, so CSS interpolates them
 * function-by-function and the final frame is exactly the incoming element's
 * static style - nothing snaps when the plan is torn down.
 *
 * @module render/morph-image-crop
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { buildImageFitTransform } from './element-style';
import type { MorphAnimationStyle, MorphPair } from './morph-types';
import { MORPH_EASING } from './morph-types';

/** Crop/placement insets are fractions of the source; 0.0001 is ~0.01%. */
const CROP_EPSILON = 0.0001;

/** The eight inset fractions that together decide what a picture paints. */
function cropInsets(element: PptxElement): number[] {
	if (!isImageLikeElement(element)) {
		return [0, 0, 0, 0, 0, 0, 0, 0];
	}
	return [
		element.cropLeft ?? 0,
		element.cropTop ?? 0,
		element.cropRight ?? 0,
		element.cropBottom ?? 0,
		element.fillRectLeft ?? 0,
		element.fillRectTop ?? 0,
		element.fillRectRight ?? 0,
		element.fillRectBottom ?? 0,
	];
}

/**
 * Whether a matched pair's pictures show a DIFFERENT region of their source.
 *
 * This is a geometry change, not an appearance change: PowerPoint zooms
 * smoothly between the two crops rather than dissolving one into the other, so
 * callers must not route it through the crossfade path.
 */
export function morphImageCropChanged(fromElement: PptxElement, toElement: PptxElement): boolean {
	if (!isImageLikeElement(fromElement) || !isImageLikeElement(toElement)) {
		return false;
	}
	const from = cropInsets(fromElement);
	const to = cropInsets(toElement);
	return from.some((value, index) => Math.abs(value - to[index]) > CROP_EPSILON);
}

/**
 * Keyframes that carry a picture's `<img>` from one crop to another.
 *
 * `transform-origin` is restated because the uncropped end of a pair has no
 * static transform at all (and therefore the CSS default origin); pinning both
 * frames to `top left` is what makes the two transforms describe the same
 * mapping. It is harmless on the final frame, where an uncropped incoming
 * picture sits at a pure identity transform.
 */
function cropKeyframes(name: string, fromTransform: string, toTransform: string): string {
	return `
@keyframes ${name} {
\tfrom {
\t\ttransform-origin: top left;
\t\ttransform: ${fromTransform};
\t}
\tto {
\t\ttransform-origin: top left;
\t\ttransform: ${toTransform};
\t}
}`;
}

/**
 * The INCOMING half of every pair whose picture crop changed.
 *
 * Keyed by the incoming element id and targeted at its `<img>`, matching the
 * FLIP model the rest of the engine uses: the incoming picture is rendered at
 * its final crop and started at the outgoing one's.
 *
 * @param pairs - Matched pairs.
 * @param durationMs - Animation duration in milliseconds.
 * @returns One descriptor per pair whose crop actually changed.
 */
export function generateImageCropMorphAnimations(
	pairs: MorphPair[],
	durationMs: number,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];
	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
		if (!morphImageCropChanged(fromElement, toElement)) {
			continue;
		}
		const safeName = `pptx-morph-crop-${index}-${toElement.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
		animations.push({
			elementId: toElement.id,
			target: 'image',
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
			keyframes: cropKeyframes(
				safeName,
				buildImageFitTransform(fromElement, true),
				buildImageFitTransform(toElement, true),
			),
		});
	}
	return animations;
}

/**
 * The OUTGOING half: the same zoom on a ghost the overlay is painting.
 *
 * Restricted to the ghost set for the same reason the element-level ghosts are:
 * an outgoing shape the overlay does not paint has no node to animate, and
 * `buildMorphTransitionPlan` derives the overlay's element list from the
 * outgoing animations.
 *
 * @param pairs - Matched pairs.
 * @param durationMs - Animation duration in milliseconds.
 * @param ghostIds - Outgoing ids the overlay will paint; defaults to "all".
 * @returns One descriptor per painted ghost whose crop changed.
 */
export function generateImageCropGhostAnimations(
	pairs: MorphPair[],
	durationMs: number,
	ghostIds?: ReadonlySet<string>,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];
	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
		if (ghostIds && !ghostIds.has(fromElement.id)) {
			continue;
		}
		if (!morphImageCropChanged(fromElement, toElement)) {
			continue;
		}
		const safeName = `pptx-morph-crop-ghost-${index}-${fromElement.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
		animations.push({
			elementId: fromElement.id,
			target: 'image',
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
			keyframes: cropKeyframes(
				safeName,
				buildImageFitTransform(fromElement, true),
				buildImageFitTransform(toElement, true),
			),
		});
	}
	return animations;
}
