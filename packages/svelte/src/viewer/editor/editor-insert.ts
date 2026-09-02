import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, ShapePresetType } from 'pptx-viewer-shared';
import { mapSlideElements } from 'pptx-viewer-shared';

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

/**
 * Build a `shape` element for any preset in the shared shape catalogue
 * (`SHAPE_PRESET_DEFS`, 30 presets). The shared `newShapeElement` factory
 * only covers `'rect' | 'ellipse' | 'line'`; core's `shapeType` field is a
 * plain string with no such restriction, so this widens it for the Insert
 * tab's shape gallery without touching the shared factory's narrow contract.
 */
export function newPresetShapeElement(
	shapeType: ShapePresetType,
	x: number = 100,
	y: number = 100,
): PptxElement {
	return {
		type: 'shape',
		id: '',
		name: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
		x,
		y,
		width: 200,
		height: 120,
		shapeType,
		shapeStyle: {
			fillColor: '#4f86ff',
			strokeColor: '#1e3a8a',
			strokeWidth: 1,
		},
	} as PptxElement;
}

/**
 * Centre an element's box on the slide canvas (top-left clamped to >= 0).
 * Used by the "structured" Insert actions (chart / equation / SmartArt /
 * media / action button / field) so a freshly-inserted diagram or media
 * clip lands in the middle of the slide rather than stacking at a fixed
 * corner offset.
 */
export function centerOnCanvas(el: PptxElement, canvasSize: CanvasSize): void {
	el.x = Math.max(0, Math.round((canvasSize.width - el.width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.height - el.height) / 2));
}

/** Append `element` to the given slide's element list (immutable). */
export function appendElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	element: PptxElement,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) => [...elements, element]);
}
