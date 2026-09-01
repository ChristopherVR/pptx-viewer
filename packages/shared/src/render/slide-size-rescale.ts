/**
 * slide-size-rescale.ts: what happens to a deck's content when Design > Slide
 * Size changes the canvas dimensions.
 *
 * PowerPoint offers two responses when a slide-size change no longer matches
 * the existing content's aspect ratio:
 * - "Maximize": scale content up to fill the new size (by the LARGER of the
 *   two axis ratios), which can push content outside the new slide bounds.
 * - "Ensure Fit": scale content down to fit inside the new size (by the
 *   SMALLER of the two axis ratios), which can leave margins.
 *
 * Both scale uniformly (one factor, not independent X/Y stretch) and both
 * centre the scaled content in the new canvas, which is why every element's
 * position is re-derived from the same `(scale, offsetX, offsetY)` triple
 * rather than each axis being handled independently.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

export type SlideSizeRescaleMode = 'maximize' | 'ensureFit';

export interface RescaleSlideSize {
	readonly widthEmu: number;
	readonly heightEmu: number;
}

/**
 * The uniform scale factor and centring offsets a slide-size change applies.
 *
 * Exposed separately from {@link scaleSlidesForSizeChange} so a caller that
 * only needs to reposition non-slide state (e.g. saved camera/zoom presets)
 * can reuse the exact same numbers the element rescale used.
 */
export interface SlideSizeRescaleTransform {
	readonly scale: number;
	readonly offsetX: number;
	readonly offsetY: number;
}

/**
 * The `(scale, offsetX, offsetY)` a slide-size change applies, per PowerPoint's
 * Maximize/Ensure Fit semantics.
 */
export function resolveSlideSizeRescaleTransform(
	oldSize: RescaleSlideSize,
	newSize: RescaleSlideSize,
	mode: SlideSizeRescaleMode,
): SlideSizeRescaleTransform {
	if (oldSize.widthEmu <= 0 || oldSize.heightEmu <= 0) {
		return { scale: 1, offsetX: 0, offsetY: 0 };
	}
	const ratioX = newSize.widthEmu / oldSize.widthEmu;
	const ratioY = newSize.heightEmu / oldSize.heightEmu;
	const scale = mode === 'maximize' ? Math.max(ratioX, ratioY) : Math.min(ratioX, ratioY);
	const scaledWidth = oldSize.widthEmu * scale;
	const scaledHeight = oldSize.heightEmu * scale;
	return {
		scale,
		offsetX: (newSize.widthEmu - scaledWidth) / 2,
		offsetY: (newSize.heightEmu - scaledHeight) / 2,
	};
}

/** Scale every font size an element's own text style carries, in place on a shallow copy. */
function scaleTextSegment(segment: TextSegment, scale: number): TextSegment {
	if (typeof segment.style.fontSize !== 'number') {
		return segment;
	}
	return { ...segment, style: { ...segment.style, fontSize: segment.style.fontSize * scale } };
}

/**
 * Scale an element's font sizes (its own `textStyle.fontSize` and every
 * `textSegments[].style.fontSize` override), and recurse into a group's
 * children so nested text scales too. Does NOT touch x/y/width/height: those
 * are handled separately, and a group's children keep their frame untouched
 * because they are positioned relative to the group's own transform, which is
 * what {@link scaleElementFrame} rescales.
 */
function scaleFontSizesDeep(element: PptxElement, scale: number): PptxElement {
	let next: PptxElement = element;
	if (hasTextProperties(next)) {
		if (typeof next.textStyle?.fontSize === 'number') {
			next = {
				...next,
				textStyle: { ...next.textStyle, fontSize: next.textStyle.fontSize * scale },
			};
		}
		if (next.textSegments && next.textSegments.length > 0) {
			next = {
				...next,
				textSegments: next.textSegments.map((segment) => scaleTextSegment(segment, scale)),
			};
		}
	}
	if (next.type === 'group') {
		next = { ...next, children: next.children.map((child) => scaleFontSizesDeep(child, scale)) };
	}
	return next;
}

/**
 * Scale one top-level slide element's frame (x/y/width/height) and, for a
 * group, its own frame only: children are left exactly where they are within
 * the group's local space, because they are relative to it. Font sizes are
 * scaled throughout, including inside group children, since PowerPoint scales
 * every run's size by the same factor regardless of nesting.
 */
function scaleElementFrame(
	element: PptxElement,
	transform: SlideSizeRescaleTransform,
): PptxElement {
	const { scale, offsetX, offsetY } = transform;
	const framed: PptxElement = {
		...element,
		x: element.x * scale + offsetX,
		y: element.y * scale + offsetY,
		width: element.width * scale,
		height: element.height * scale,
	};
	return scaleFontSizesDeep(framed, scale);
}

/**
 * Rescale every slide's top-level elements for a slide-size change, per
 * PowerPoint's Maximize/Ensure Fit semantics. Pure and immutable: returns new
 * slide/element objects, the inputs are never mutated.
 */
export function scaleSlidesForSizeChange(
	slides: readonly PptxSlide[],
	oldSize: RescaleSlideSize,
	newSize: RescaleSlideSize,
	mode: SlideSizeRescaleMode,
): PptxSlide[] {
	const transform = resolveSlideSizeRescaleTransform(oldSize, newSize, mode);
	if (transform.scale === 1 && transform.offsetX === 0 && transform.offsetY === 0) {
		return slides.map((slide) => slide);
	}
	return slides.map((slide) => ({
		...slide,
		elements: slide.elements.map((element) => scaleElementFrame(element, transform)),
	}));
}
