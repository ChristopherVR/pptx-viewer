import type { PptxSlide } from 'pptx-viewer-core';
import { cloneSlide } from 'pptx-viewer-core';
import { createBlankSlide, makeSlideId } from 'pptx-viewer-shared';

/**
 * Pure slide-array mutations for the Home tab's Slides group (New slide /
 * Duplicate slide / Delete slide). The blank-slide factory and id generator
 * are the shared, framework-agnostic helpers from `pptx-viewer-shared`
 * (`render/slide-operations`); this module only adds the insert/duplicate/
 * delete array splicing and the `slideNumber` renumbering every binding needs.
 */

function renumbered(slides: readonly PptxSlide[]): PptxSlide[] {
	return slides.map((slide, i) =>
		slide.slideNumber === i + 1 ? slide : { ...slide, slideNumber: i + 1 },
	);
}

/** Insert a new blank slide immediately after `afterIndex`. Returns its index. */
export function insertBlankSlideAfter(
	slides: readonly PptxSlide[],
	afterIndex: number,
): { slides: PptxSlide[]; newIndex: number } {
	const insertAt = Math.min(Math.max(afterIndex + 1, 0), slides.length);
	const next = [...slides];
	next.splice(insertAt, 0, createBlankSlide(insertAt + 1, makeSlideId));
	return { slides: renumbered(next), newIndex: insertAt };
}

/** Duplicate the slide at `index` (fresh slide + element ids). Returns the new index. */
export function duplicateSlideAt(
	slides: readonly PptxSlide[],
	index: number,
): { slides: PptxSlide[]; newIndex: number } | null {
	const source = slides[index];
	if (!source) {
		return null;
	}
	const clone = cloneSlide(source);
	clone.id = makeSlideId();
	const next = [...slides];
	next.splice(index + 1, 0, clone);
	return { slides: renumbered(next), newIndex: index + 1 };
}

/** Delete the slide at `index`. Returns the new active index, or `null` when it was the only slide. */
export function deleteSlideAt(
	slides: readonly PptxSlide[],
	index: number,
): { slides: PptxSlide[]; newIndex: number } | null {
	if (slides.length <= 1 || !slides[index]) {
		return null;
	}
	const next = slides.filter((_, i) => i !== index);
	return { slides: renumbered(next), newIndex: Math.min(index, next.length - 1) };
}
