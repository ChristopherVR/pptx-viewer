import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { mapSlideElements } from './editor-mutations';

/**
 * Element insertion for the Svelte editor.
 *
 * The element *factories* (`newTextElement`, `newShapeElement`,
 * `newTableElement`) are the shared, framework-agnostic builders from
 * `pptx-viewer-shared` (`render/editor-insert`); every binding uses the same
 * ones so a "Text box" or "Rectangle" is identical across React/Vue/Angular/
 * Svelte. This module adds only the two thin, binding-local pieces the shared
 * factories deliberately leave out: id generation (the factories return
 * `id: ''`) and the pure "append to the current slide" mutation.
 */

// Re-export the shared factories so the insert UI imports everything from one
// place (and the shared origin stays obvious).
export { newShapeElement, newTableElement, newTextElement } from 'pptx-viewer-shared';

/** Generate a fresh, collision-resistant element id (prefixed for clarity). */
export function newElementId(): string {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === 'function') {
		return `el-${c.randomUUID()}`;
	}
	// Fallback for environments without crypto.randomUUID (older test runners).
	return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build an `image` element from a data URL (the file picker reads a chosen
 * file as a `data:` URI, which the renderer consumes directly via `imageData`).
 */
export function newImageElement(
	imageData: string,
	x: number,
	y: number,
	width: number,
	height: number,
): PptxElement {
	return {
		type: 'image',
		id: '',
		name: 'Image',
		x,
		y,
		width,
		height,
		imageData,
	} as PptxElement;
}

/** Append `element` to the given slide's element list (immutable). */
export function appendElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	element: PptxElement,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) => [...elements, element]);
}
