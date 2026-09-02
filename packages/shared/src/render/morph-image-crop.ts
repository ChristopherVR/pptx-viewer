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
 * When the FRAME changes as well as the crop, two linear interpolations do not
 * compose to PowerPoint's reveal: the crop track there steps through the pair's
 * inset fractions (see `sampleImageCropMorphSteps`).
 *
 * @module render/morph-image-crop
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { buildImageFitTransform, fitTransformsFromInsets } from './element-style';
import type { ImageFitInsets } from './element-style';
import type { MorphAnimationStyle, MorphPair } from './morph-types';
import { MORPH_EASING, MORPH_EASING_POINTS } from './morph-types';

/** Crop/placement insets are fractions of the source; 0.0001 is ~0.01%. */
const CROP_EPSILON = 0.0001;

/** Frame sizes within this relative difference count as unchanged. */
const FRAME_EPSILON = 0.002;

/** The eight inset fractions that together decide what a picture paints. */
function cropInsets(element: PptxElement): ImageFitInsets {
	if (!isImageLikeElement(element)) {
		return {
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
			fillRectLeft: 0,
			fillRectTop: 0,
			fillRectRight: 0,
			fillRectBottom: 0,
		};
	}
	return {
		cropLeft: element.cropLeft ?? 0,
		cropTop: element.cropTop ?? 0,
		cropRight: element.cropRight ?? 0,
		cropBottom: element.cropBottom ?? 0,
		fillRectLeft: element.fillRectLeft ?? 0,
		fillRectTop: element.fillRectTop ?? 0,
		fillRectRight: element.fillRectRight ?? 0,
		fillRectBottom: element.fillRectBottom ?? 0,
	};
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
	const keys = Object.keys(from) as (keyof ImageFitInsets)[];
	return keys.some((key) => Math.abs(from[key] - to[key]) > CROP_EPSILON);
}

/**
 * Whether the pair's FRAMES differ as well as the crops.
 *
 * When only the crop changes, the frame is a fixed window and animating the
 * img transform alone is exact. When the frame also grows or shrinks, the
 * element journey scales that window at the same time and the two tracks
 * compose multiplicatively - and two linear interpolations do NOT cancel: the
 * image visibly zooms through the flight. PowerPoint interpolates the crop
 * FRACTION linearly instead, which against the linear frame scale keeps the
 * picture's pixel scale constant: a reveal, not a zoom.
 */
function frameChanged(fromElement: PptxElement, toElement: PptxElement): boolean {
	return (
		Math.abs(fromElement.width / Math.max(toElement.width, 1) - 1) > FRAME_EPSILON ||
		Math.abs(fromElement.height / Math.max(toElement.height, 1) - 1) > FRAME_EPSILON
	);
}

/**
 * Progress along a CSS cubic-bezier easing at normalized time `t` (0..1).
 *
 * Standard solver: Newton where the x-curve's derivative is usable, bisection
 * where it is not (the x curve is monotone for valid CSS control points). The
 * stepped crop track samples this so its baked keyframe percentages advance
 * exactly like the element journey's eased progress.
 */
function easedProgress(t: number, x1: number, y1: number, x2: number, y2: number): number {
	// B(u) = 3a·u(1-u)² + 3b·u²(1-u) + u³ for the axis whose control points
	// are 0, a, b, 1.
	const axisAt = (a: number, b: number, u: number): number =>
		3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
	const axisDerivative = (a: number, b: number, u: number): number =>
		3 * (1 - u) * (1 - u) * a + 6 * (1 - u) * u * (b - a) + 3 * u * u * (1 - b);
	const xAt = (u: number): number => axisAt(x1, x2, u);
	const yAt = (u: number): number => axisAt(y1, y2, u);

	let u = t;
	for (let i = 0; i < 8; i++) {
		const err = xAt(u) - t;
		if (Math.abs(err) < 1e-6) {
			return yAt(u);
		}
		const slope = axisDerivative(x1, x2, u);
		if (Math.abs(slope) < 1e-6) {
			break;
		}
		u -= err / slope;
		if (u <= 0 || u >= 1) {
			break;
		}
	}
	let lo = 0;
	let hi = 1;
	u = t;
	for (let i = 0; i < 24; i++) {
		if (xAt(u) < t) {
			lo = u;
		} else {
			hi = u;
		}
		u = (lo + hi) / 2;
	}
	return yAt(u);
}

/** Time samples the stepped track takes across the flight. */
const CROP_TRACK_STEPS = 48;

export interface ImageCropMorphSample {
	/** Keyframe selector, in percent of the duration (0-100). */
	readonly percent: string;
	/** Eased progress this sample's insets were computed at (0-1). */
	readonly progress: number;
	/** The `<img>` transform at this sample. */
	readonly transform: string;
}

/**
 * The stepped crop track for a pair whose frame changes alongside its crop.
 *
 * Samples the pair's inset fractions at eased-time points and maps each through
 * the same inset maths the static renderer uses, so the crop fraction travels
 * linearly (as PowerPoint's does) while the keyframe PERCENTAGES carry
 * {@link MORPH_EASING}'s shape. Rendered with `linear` timing, because the
 * easing already lives in the percentages.
 */
export function sampleImageCropMorphSteps(
	fromElement: PptxElement,
	toElement: PptxElement,
): ImageCropMorphSample[] {
	const from = cropInsets(fromElement);
	const to = cropInsets(toElement);
	const keys = Object.keys(from) as (keyof ImageFitInsets)[];
	const samples: ImageCropMorphSample[] = [];
	for (let step = 0; step <= CROP_TRACK_STEPS; step++) {
		const time = step / CROP_TRACK_STEPS;
		const progress =
			step === 0 ? 0 : step === CROP_TRACK_STEPS ? 1 : easedProgress(time, ...MORPH_EASING_POINTS);
		const insets = {} as ImageFitInsets;
		for (const key of keys) {
			insets[key] = from[key] + (to[key] - from[key]) * progress;
		}
		const percent = Math.round(time * 100 * 10000) / 10000;
		// Pad exactly like `buildImageFitTransform(, true)` so the first and
		// last samples are byte-identical to the two elements' static tracks -
		// and the final sample to the incoming style the plan hands back to.
		const { placement, crop } = fitTransformsFromInsets(insets);
		const identity = 'translate(0%, 0%) scale(1, 1)';
		const transform =
			step === CROP_TRACK_STEPS
				? buildImageFitTransform(toElement, true)
				: `${placement || identity} ${crop || identity}`;
		samples.push({ percent: `${percent}%`, progress, transform });
	}
	return samples;
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

/** Stepped variant of {@link cropKeyframes} (easing baked into percentages). */
function steppedCropKeyframes(name: string, samples: ImageCropMorphSample[]): string {
	const stops = samples
		.map(
			(sample) =>
				`\t${sample.percent} {\n\t\ttransform-origin: top left;\n\t\ttransform: ${sample.transform};\n\t}`,
		)
		.join('\n');
	return `\n@keyframes ${name} {\n${stops}\n}`;
}

/** Shared per-pair track construction for the incoming and ghost halves. */
function cropTrack(
	index: number,
	suffix: string,
	elementId: string,
	fromElement: PptxElement,
	toElement: PptxElement,
	durationMs: number,
): MorphAnimationStyle {
	const safeName = `pptx-morph-crop-${suffix}-${index}-${elementId.replace(/[^a-zA-Z0-9]/gu, '')}`;
	const stepped = frameChanged(fromElement, toElement);
	return {
		elementId,
		target: 'image',
		// Stepped frames carry the easing in their percentages, so the track
		// itself must advance linearly to stay in sync with the element journey.
		animation: stepped
			? `${safeName} ${durationMs}ms linear forwards`
			: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
		keyframes: stepped
			? steppedCropKeyframes(safeName, sampleImageCropMorphSteps(fromElement, toElement))
			: cropKeyframes(
					safeName,
					buildImageFitTransform(fromElement, true),
					buildImageFitTransform(toElement, true),
				),
	};
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
		animations.push(cropTrack(index, '', toElement.id, fromElement, toElement, durationMs));
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
		animations.push(cropTrack(index, 'ghost-', fromElement.id, fromElement, toElement, durationMs));
	}
	return animations;
}
