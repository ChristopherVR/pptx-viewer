/**
 * Element CSS-style builders shared by the React, Vue, and Angular bindings.
 *
 * Holds the framework-agnostic, binding-identical portions of each binding's
 * element-style layer: the absolute container style (position / size / flip +
 * rotation transform / opacity / z-index / hidden) and the displayable
 * image-source resolution. Returns a neutral CSS map keyed in camelCase (both
 * Vue `CSSProperties` and Angular `[ngStyle]` accept camelCase keys), which
 * each binding casts to its framework's style type.
 *
 * The fill/stroke/geometry and text-block builders are intentionally NOT shared
 * here: the Vue and Angular implementations diverge (Vue resolves fills via the
 * shared structured fill/effect/3D builders and applies body insets; Angular
 * uses inline gradient/pattern/duotone builders and a different geometry
 * cascade), so each binding keeps its own to avoid changing render output.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE, hasShapeProperties, isImageLikeElement } from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';
import { clampCropValue } from './fill-style';

/** Map a number to a CSS pixel string. */
export function px(n: number): string {
	return `${n}px`;
}

/**
 * The box an element is PAINTED in: its authored extent, padded out to
 * {@link MIN_ELEMENT_SIZE} in either axis.
 *
 * PowerPoint decks contain degenerate shapes - a horizontal rule authored as
 * `<a:prstGeom prst="line"/>` with `cy="1"` EMU is the canonical one - whose box
 * rounds to zero pixels. A zero-sized box cannot be hovered, clicked or dragged,
 * so every binding pads it; React has always done so (`getContainerStyle`, and
 * again in its connector renderer), and the other four did not, which is one
 * half of why the same slide measured a different height in each.
 *
 * The padding never moves the paint: the shape's geometry is still resolved at
 * the authored extent and the extra pixels hang off the right/bottom, which is
 * why the stroke overlay takes its viewBox from this box
 * ({@link strokeOutlineViewBox}) rather than from the authored size.
 */
export function paintedElementSize(el: PptxElement): { width: number; height: number } {
	return {
		width: Math.max(el.width, MIN_ELEMENT_SIZE),
		height: Math.max(el.height, MIN_ELEMENT_SIZE),
	};
}

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): CssStyleMap {
	const transforms: string[] = [];
	if (el.rotation) {
		transforms.push(`rotate(${el.rotation}deg)`);
	}
	if (el.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (el.flipVertical) {
		transforms.push('scaleY(-1)');
	}

	const painted = paintedElementSize(el);
	const style: CssStyleMap = {
		position: 'absolute',
		left: px(el.x),
		top: px(el.y),
		width: px(painted.width),
		height: px(painted.height),
		zIndex,
		boxSizing: 'border-box',
	};
	if (transforms.length > 0) {
		style['transform'] = transforms.join(' ');
	}
	if (typeof el.opacity === 'number') {
		style['opacity'] = el.opacity;
	}
	if (el.hidden) {
		style['display'] = 'none';
	}
	return style;
}

/**
 * Resolve a displayable image source for picture/image/media poster frames.
 *
 * The SVG variant is preferred over the raster one, which is not merely a
 * quality choice: `<a:blip>` can carry an `asvg:svgBlip` extension whose
 * `r:embed` is the ONLY relationship on the blip, so there is no raster
 * fallback at all. A resolver that looks solely at `imageData` renders those
 * pictures as an empty box, and real decks use exactly that shape for icon
 * artwork. PowerPoint paints the SVG when both are present, so preferring it
 * is also the higher-fidelity answer when a raster fallback does exist.
 */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	if (el.type === 'picture' || el.type === 'image') {
		return (
			el.svgData ??
			(el.svgPath ? mediaDataUrls.get(el.svgPath) : undefined) ??
			el.imageData ??
			(el.imagePath ? mediaDataUrls.get(el.imagePath) : undefined)
		);
	}
	if (el.type === 'media') {
		return (
			el.posterFrameData ?? (el.posterFramePath ? mediaDataUrls.get(el.posterFramePath) : undefined)
		);
	}
	return undefined;
}

/**
 * `overflow` for a picture's container box.
 *
 * Pictures clip, because {@link getImageFitStyle} renders a crop by
 * deliberately painting the cropped-away part outside the frame. The one
 * exception is a blur with `@grow`, whose halo is MEANT to bleed past the
 * element box (see `getComputedEffectStyle().overflowVisible`); clipping there
 * would trade one visible defect for another. Mirrors React's container rule.
 */
export function getImageOverflow(el: PptxElement): 'hidden' | 'visible' {
	const shapeStyle = hasShapeProperties(el) ? el.shapeStyle : undefined;
	const blurHaloBleeds =
		Boolean(shapeStyle?.blurGrow) &&
		typeof shapeStyle?.blurRadius === 'number' &&
		shapeStyle.blurRadius > 0;
	return blurHaloBleeds ? 'visible' : 'hidden';
}

/**
 * How a picture's `<img>` should fill its frame, including the `<a:srcRect>`
 * source crop.
 *
 * CSS `object-fit` cannot express an OOXML source crop: `contain` and `cover`
 * pick a region of the FRAME, whereas `srcRect` picks a region of the SOURCE
 * bitmap which PowerPoint then stretches to fill the frame. The crop is
 * therefore rendered by scaling the image by the reciprocal of the surviving
 * region and translating the cropped-away part out of the (overflow-hidden)
 * frame. Skipping it does not merely mis-scale the picture, it shows the wrong
 * part of it: a deck that crops one wide composite image into several different
 * insets otherwise renders the same photo in every one of them.
 *
 * Callers must give the containing element `overflow: hidden`, since the
 * cropped branch deliberately paints outside the frame.
 *
 * @returns A neutral CSS map to spread onto the `<img>`; never `undefined`, so
 *          the uncropped case still pins the shared `cover` fit that every
 *          binding must agree on.
 */
export function getImageFitStyle(el: PptxElement): CssStyleMap {
	const uncropped: CssStyleMap = {
		width: '100%',
		height: '100%',
		objectFit: 'cover',
	};
	if (!isImageLikeElement(el)) {
		return uncropped;
	}

	const { placement, crop } = imageFitTransformParts(el);
	if (!placement && !crop) {
		return uncropped;
	}

	// Placement first, crop second: transforms compose right-to-left, so the
	// crop magnifies within the box the placement has already mapped onto the
	// fill-rect region (translate percentages resolve against the img border
	// box and are scaled by the preceding placement scale, which is exactly
	// "percent of the placed width").
	const transform = [placement, crop].filter(Boolean).join(' ');

	return {
		position: 'absolute',
		width: '100%',
		height: '100%',
		maxWidth: 'none',
		maxHeight: 'none',
		objectFit: 'fill',
		transformOrigin: 'top left',
		transform,
	};
}

/** A `translate`/`scale` pair that changes nothing, used to pad a transform. */
const IDENTITY_TRANSFORM_PAIR = 'translate(0%, 0%) scale(1, 1)';

/**
 * The two halves of a picture's fit transform: the `a:stretch/a:fillRect`
 * PLACEMENT and the `a:srcRect` source CROP. Either is `''` when absent.
 */
function imageFitTransformParts(el: PptxElement): { placement: string; crop: string } {
	if (!isImageLikeElement(el)) {
		return { placement: '', crop: '' };
	}

	// `a:stretch/a:fillRect` stretches the (cropped) image into a sub-rect of
	// the FRAME; negative offsets legitimately push it past the frame edges,
	// and the overflow-hidden frame clips the spill (issue #132 deck, phone
	// photo). Expressed as a transform, NOT as left/width placement: bindings
	// stamp a pixel-sized shape clip-path on the img itself, and a transform
	// moves the already-clipped result while a geometry change would move the
	// img out of its own clip and blank it.
	const frLeft = el.fillRectLeft ?? 0;
	const frTop = el.fillRectTop ?? 0;
	const frRight = el.fillRectRight ?? 0;
	const frBottom = el.fillRectBottom ?? 0;
	const hasFillRect =
		Math.abs(frLeft) + Math.abs(frTop) + Math.abs(frRight) + Math.abs(frBottom) > 0.0001;
	const placement = hasFillRect
		? `translate(${round2(frLeft * 100)}%, ${round2(frTop * 100)}%) scale(${round6(
				Math.max(0.01, 1 - frLeft - frRight),
			)}, ${round6(Math.max(0.01, 1 - frTop - frBottom))})`
		: '';

	const cropLeft = clampCropValue(el.cropLeft);
	const cropTop = clampCropValue(el.cropTop);
	const cropRight = clampCropValue(el.cropRight);
	const cropBottom = clampCropValue(el.cropBottom);
	if (cropLeft + cropRight <= 0.0001 && cropTop + cropBottom <= 0.0001) {
		return { placement, crop: '' };
	}

	// A crop that swallows (almost) the whole source would divide by ~0
	// below, so the pair is rescaled to leave a 1% sliver rather than
	// producing Infinity.
	const horizontalScale = cropLeft + cropRight >= 0.99 ? 0.99 / (cropLeft + cropRight) : 1;
	const verticalScale = cropTop + cropBottom >= 0.99 ? 0.99 / (cropTop + cropBottom) : 1;
	const left = clampCropValue(cropLeft * horizontalScale);
	const right = clampCropValue(cropRight * horizontalScale);
	const top = clampCropValue(cropTop * verticalScale);
	const bottom = clampCropValue(cropBottom * verticalScale);
	const remainingWidth = Math.max(0.01, 1 - left - right);
	const remainingHeight = Math.max(0.01, 1 - top - bottom);

	const tx = Math.round((-left / remainingWidth) * 10000) / 100;
	const ty = Math.round((-top / remainingHeight) * 10000) / 100;
	const sx = Math.round((1 / remainingWidth) * 1e6) / 1e6;
	const sy = Math.round((1 / remainingHeight) * 1e6) / 1e6;
	return { placement, crop: `translate(${tx}%, ${ty}%) scale(${sx}, ${sy})` };
}

/**
 * The `<img>` `transform` that renders a picture's fill-rect placement and
 * source crop, as one string.
 *
 * This is the value {@link getImageFitStyle} puts on the element; it is exposed
 * separately so the Morph engine can animate BETWEEN two pictures' crops
 * without re-deriving the maths (issue #148: PowerPoint's "Scale Height" /
 * "Scale Width" is an `a:srcRect` crop, so a slide pair that differs only in
 * scale has identical frames and morphed as a hard cut).
 *
 * @param el - The picture element.
 * @param padToIdentity - When true, ALWAYS emits both the placement and the
 *   crop `translate`/`scale` pair, substituting an identity pair where the
 *   element has none. Two pictures then produce the same transform function
 *   list, which is what lets CSS interpolate them function-by-function instead
 *   of decomposing to a matrix (and lets an uncropped end of a pair sit at a
 *   true identity, so the element lands exactly on its static style).
 * @returns The transform value; `''` only when there is nothing to apply and
 *   `padToIdentity` is false.
 */
export function buildImageFitTransform(el: PptxElement, padToIdentity = false): string {
	const { placement, crop } = imageFitTransformParts(el);
	if (!padToIdentity) {
		return [placement, crop].filter(Boolean).join(' ');
	}
	return `${placement || IDENTITY_TRANSFORM_PAIR} ${crop || IDENTITY_TRANSFORM_PAIR}`;
}

/** Round to two decimals for stable CSS percentage output. */
function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

/** Round to six decimals for stable CSS scale output. */
function round6(value: number): number {
	return Math.round(value * 1e6) / 1e6;
}
