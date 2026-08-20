import type { PptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveContextMenuElementId } from '../internal/shared-src/render/context-menu-target';
import { resolveInteractiveElementId } from './selection-geometry';

/**
 * Regression cover for SlideCanvasComponent#onContextMenu.
 *
 * The inline text editor renders as a `[data-inline-editor]` overlay that
 * sits as a SIBLING of the `[data-element-id]` elements, not as a child of
 * the one it edits (see `slide-canvas.component.html`), because the editor
 * has to paint above the selection chrome and escape the element's own
 * clipping. `resolveInteractiveElementId` (a `closest('[data-element-id]')`
 * walk) therefore finds nothing for a right-click inside that overlay, and
 * without the `resolveContextMenuElementId` fallback the context menu never
 * opened for exactly the element the user had just clicked into. This
 * mirrors Vue's `useContextMenu#onCanvasContextMenu` and Svelte's
 * `onStageContextMenu`, which already fall back the same way.
 */
const box = { x: 0, y: 0, width: 100, height: 50 },
	elements = [{ ...box, id: 'shape-1', type: 'shape' }] as unknown as PptxElement[];

let shape: HTMLElement, editorOverlay: HTMLElement, editorCaret: HTMLElement, outside: HTMLElement;

beforeEach(() => {
	document.body.innerHTML = '';
	shape = document.createElement('div');
	shape.dataset['elementId'] = 'shape-1';

	editorOverlay = document.createElement('textarea');
	editorOverlay.dataset['inlineEditor'] = '';
	editorCaret = document.createElement('span');
	editorOverlay.appendChild(editorCaret);

	outside = document.createElement('div');

	// Rendered as siblings under the stage, matching the real markup: the
	// editor overlay is NOT nested inside the shape it edits.
	document.body.append(shape, editorOverlay, outside);
});

/** The exact composition `onContextMenu` performs. */
function resolveOnContextMenu(target: EventTarget | null, editingId: string | null): string | null {
	const hitId = resolveInteractiveElementId(target, elements, false);
	return resolveContextMenuElementId(hitId, target, editingId);
}

describe('onContextMenu inline-editor fallback resolution', () => {
	it('resolves the direct hit when the click lands on the element itself', () => {
		expect(resolveOnContextMenu(shape, null)).toBe('shape-1');
	});

	it('falls back to the element under inline edit when the click lands inside its editor overlay', () => {
		expect(resolveOnContextMenu(editorOverlay, 'shape-1')).toBe('shape-1');
	});

	it('falls back for a hit nested inside the editor overlay too', () => {
		expect(resolveOnContextMenu(editorCaret, 'shape-1')).toBe('shape-1');
	});

	it('does not fall back when no element is under inline edit', () => {
		expect(resolveOnContextMenu(editorOverlay, null)).toBeNull();
	});

	it('does not fall back for a right-click outside the editor overlay', () => {
		expect(resolveOnContextMenu(outside, 'shape-1')).toBeNull();
	});
});
