import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { cloneElement, cloneSlide, duplicateElement } from 'pptx-viewer-core';

/**
 * Pure, immutable slide-array mutations for the editor.
 *
 * Extracted from the Vanilla binding's `editor/editor-mutations` (the superset
 * of the byte-for-byte-equivalent Svelte copy; Vue's `useEditorOperations`
 * commit helpers do the same array math inline, reactivity mixed in). Every
 * function takes the current `PptxSlide[]` and returns a brand-new array
 * (untouched slides are reused by reference so the render layer can cheaply
 * detect changes). All cloning defers to the core helpers (`cloneSlide`,
 * `cloneElement`, `duplicateElement`); nothing is mutated in place.
 */

/** Geometry patch applied by drag / resize / rotate / nudge. */
export interface ElementBoxPatch {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

/** Pixel offset applied to a duplicated element so the copy is visible. */
const DUPLICATE_OFFSET_PX = 20;

/** Find a top-level element by id on the given slide (or `undefined`). */
export function findSlideElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
): PptxElement | undefined {
	return slides[slideIndex]?.elements.find((el) => el.id === elementId);
}

/** Rebuild one slide's `elements` via `mapElements`; other slides are reused. */
export function mapSlideElements(
	slides: readonly PptxSlide[],
	slideIndex: number,
	mapElements: (elements: PptxElement[]) => PptxElement[],
): PptxSlide[] {
	return slides.map((slide, i) =>
		i === slideIndex ? { ...cloneSlide(slide), elements: mapElements(slide.elements) } : slide,
	);
}

/** Shallow-merge `updates` into the element with `elementId` (cloned first). */
export function updateElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
	updates: Partial<PptxElement>,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) =>
		elements.map((el) =>
			el.id === elementId ? ({ ...cloneElement(el), ...updates } as PptxElement) : el,
		),
	);
}

/** Patch an element's geometry (x/y/width/height/rotation). */
export function patchElementGeometry(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
	box: ElementBoxPatch,
): PptxSlide[] {
	return updateElement(slides, slideIndex, elementId, {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation,
	});
}

/** Remove the element with `elementId` from the slide. */
export function removeElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) =>
		elements.filter((el) => el.id !== elementId),
	);
}

/**
 * Deep-clone an element (fresh ids via core `duplicateElement`, group children
 * included), offset it slightly, and append it to the slide. Returns the new
 * slide array plus the copy's id, or `null` when the source is missing.
 */
export function duplicateElementOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
): { slides: PptxSlide[]; newId: string } | null {
	const source = findSlideElement(slides, slideIndex, elementId);
	if (!source) {
		return null;
	}
	const copy = duplicateElement(source);
	copy.x += DUPLICATE_OFFSET_PX;
	copy.y += DUPLICATE_OFFSET_PX;
	return {
		slides: mapSlideElements(slides, slideIndex, (elements) => [...elements, copy]),
		newId: copy.id,
	};
}

/** Deep-clone the whole slide array (history snapshots). */
export function cloneSlides(slides: readonly PptxSlide[]): PptxSlide[] {
	return slides.map(cloneSlide);
}

/**
 * Reorder one slide's elements via a pure z-order transform (the shared
 * `bringToFront` / `sendToBack` / `bringForward` / `sendBackward` family, whose
 * signature is `(elements, id) => PptxElement[]`). The slide is cloned; other
 * slides are reused by reference.
 */
export function reorderElementOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	transform: (elements: readonly PptxElement[]) => PptxElement[],
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) => transform(elements));
}

/** Append a freshly-built element to the end (top of paint order) of a slide. */
export function appendElementOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	element: PptxElement,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) => [...elements, element]);
}

/**
 * Replace the plain-text speaker notes on one slide. Both the
 * backwards-compatible plain string and optional rich segment model are
 * persisted. Supplying no segments clears stale formatting after a plain edit.
 */
export function updateSlideNotes(
	slides: readonly PptxSlide[],
	slideIndex: number,
	notes: string,
	notesSegments?: TextSegment[],
): PptxSlide[] {
	return slides.map((slide, i) =>
		i === slideIndex
			? {
					...cloneSlide(slide),
					notes,
					notesSegments: notesSegments?.map((segment) => ({
						...segment,
						style: { ...segment.style },
					})),
				}
			: slide,
	);
}

/**
 * Shallow-merge `patch` into the slide at `slideIndex` (cloned first). Other
 * slides are reused by reference. Backs the Design tab's Format Background
 * panel and the Transitions tab's single-slide apply.
 */
export function updateSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	patch: Partial<PptxSlide>,
): PptxSlide[] {
	return slides.map((slide, i) => (i === slideIndex ? { ...cloneSlide(slide), ...patch } : slide));
}

/**
 * Shallow-merge `patch` into every slide. Backs the Transitions tab's
 * "Apply to All Slides" option.
 */
export function updateAllSlides(
	slides: readonly PptxSlide[],
	patch: Partial<PptxSlide>,
): PptxSlide[] {
	return slides.map((slide) => ({ ...cloneSlide(slide), ...patch }));
}
