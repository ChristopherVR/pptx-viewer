import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorControllerDeps } from './editor-controller-deps';
import { createTransformGestures, rerouteConnectorsAfterGesture } from './editor-controller-wiring';
import type { EditorControllerHost } from './editor-controller-wiring';
import { EditorState } from './editor-state.svelte';

/**
 * Regression suite for "a connector does not follow the shape it is attached
 * to". Svelte's gesture-end handlers patched the dragged element's geometry
 * and stopped, so a glued connector stayed where it was; React had been calling
 * the shared `connector-reroute` model at the same point since it shipped.
 *
 * Named `.svelte.test.ts` because it drives the runes-backed `EditorState`.
 */

function shape(id: string, x: number, y: number): PptxElement {
	return {
		type: 'shape',
		id,
		x,
		y,
		width: 100,
		height: 60,
		rotation: 0,
		shapeType: 'rect',
	} as PptxElement;
}

/** A connector glued to `from` -> `to` via the parsed connection refs. */
function connector(id: string, from: string, to: string): PptxElement {
	return {
		type: 'connector',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rotation: 0,
		shapeStyle: {
			connectorStartConnection: { shapeId: from, connectionSiteIndex: 3 },
			connectorEndConnection: { shapeId: to, connectionSiteIndex: 1 },
		},
	} as PptxElement;
}

function makeHost(elements: PptxElement[]): { host: EditorControllerHost; editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements, notes: '' }]);
	const host: EditorControllerHost = {
		editor,
		deps: {
			getScale: () => 1,
			getHolderEl: () => null,
			getStageRoot: () => null,
			getPresenting: () => false,
		} as unknown as EditorControllerDeps,
		currentElements: () => editor.activeElements,
		setSnapLines: () => {},
		setMarquee: () => {},
		getEditingId: () => null,
	};
	return { host, editor };
}

/** A pointer event happy-dom is happy to dispatch on `window`. */
function pointer(type: string, clientX: number, clientY: number): PointerEvent {
	return new PointerEvent(type, { clientX, clientY, pointerId: 1, bubbles: true });
}

function connectorOf(editor: EditorState, id: string): PptxElement {
	const found = editor.activeElements.find((element) => element.id === id);
	expect(found).toBeDefined();
	return found as PptxElement;
}

describe('rerouteConnectorsAfterGesture', () => {
	it('re-lays a connector whose bound shape moved', () => {
		const { host, editor } = makeHost([
			shape('box-a', 0, 0),
			shape('box-b', 400, 300),
			connector('conn', 'box-a', 'box-b'),
		]);
		const before = connectorOf(editor, 'conn');

		// The gesture has already written the new geometry; the reroute runs at
		// gesture end over the ids it moved.
		editor.patchGeometry('box-a', { x: 150, y: 90, width: 100, height: 60, rotation: 0 });
		rerouteConnectorsAfterGesture(host, new Set(['box-a']));

		const after = connectorOf(editor, 'conn');
		expect({ x: after.x, y: after.y, width: after.width, height: after.height }).not.toStrictEqual({
			x: before.x,
			y: before.y,
			width: before.width,
			height: before.height,
		});
		// It really tracks the shape: the connector now starts on box-a's box.
		expect(after.x).toBeGreaterThanOrEqual(150);
	});

	it('reroutes every connector bound to a multi-selection drag', () => {
		const { host, editor } = makeHost([
			shape('box-a', 0, 0),
			shape('box-b', 400, 300),
			shape('box-c', 800, 0),
			connector('conn-ab', 'box-a', 'box-b'),
			connector('conn-bc', 'box-b', 'box-c'),
		]);
		const beforeAb = connectorOf(editor, 'conn-ab');
		const beforeBc = connectorOf(editor, 'conn-bc');

		editor.patchGeometry('box-a', { x: 40, y: 40, width: 100, height: 60, rotation: 0 });
		editor.patchGeometry('box-c', { x: 900, y: 120, width: 100, height: 60, rotation: 0 });
		rerouteConnectorsAfterGesture(host, new Set(['box-a', 'box-c']));

		expect(connectorOf(editor, 'conn-ab').x).not.toBe(beforeAb.x);
		expect(connectorOf(editor, 'conn-bc').y).not.toBe(beforeBc.y);
	});

	it('does not touch the elements when nothing is connected (same array reference)', () => {
		const { host, editor } = makeHost([shape('box-a', 0, 0), shape('box-b', 400, 300)]);
		const replace = vi.spyOn(editor, 'replaceActiveElements');
		rerouteConnectorsAfterGesture(host, new Set(['box-a']));
		expect(replace).not.toHaveBeenCalled();
	});

	// The one that fails against the pre-fix wiring: it drives the REAL move
	// gesture end-to-end (pointerdown -> window pointermove -> pointerup) rather
	// than calling the reroute helper directly, so it proves the hook exists at
	// the gesture-end callback and not merely that the helper works.
	it('a real move gesture drags the glued connector with the shape', () => {
		const { host, editor } = makeHost([
			shape('box-a', 0, 0),
			shape('box-b', 400, 300),
			connector('conn', 'box-a', 'box-b'),
		]);
		const before = connectorOf(editor, 'conn');
		const gestures = createTransformGestures(host);

		gestures.begin('move', 'box-a', pointer('pointerdown', 10, 10));
		window.dispatchEvent(pointer('pointermove', 210, 160));
		window.dispatchEvent(pointer('pointerup', 210, 160));

		const movedShape = connectorOf(editor, 'box-a');
		expect(movedShape.x).toBe(200);
		const after = connectorOf(editor, 'conn');
		expect([after.x, after.y]).not.toStrictEqual([before.x, before.y]);
		gestures.dispose();
	});

	it('records no history of its own (the gesture already pushed one)', () => {
		const { host, editor } = makeHost([
			shape('box-a', 0, 0),
			shape('box-b', 400, 300),
			connector('conn', 'box-a', 'box-b'),
		]);
		const push = vi.spyOn(editor, 'pushHistory');
		editor.patchGeometry('box-a', { x: 150, y: 90, width: 100, height: 60, rotation: 0 });
		rerouteConnectorsAfterGesture(host, new Set(['box-a']));
		expect(push).not.toHaveBeenCalled();
	});
});

describe('createTransformGestures: grid spacing wiring', () => {
	// Regression: `EditorControllerDeps.getGridSize` used to be declared on
	// `GestureDeps` but never actually supplied by `createTransformGestures`,
	// so `deps.getGridSize?.() ?? 12` always fell through to the hardcoded
	// default -- the deck's authored `viewProperties.gridSpacing` had no path
	// into the snap step at all.
	function hostWithGrid(gridSize: number): { host: EditorControllerHost; editor: EditorState } {
		const { host, editor } = makeHost([shape('box-a', 0, 0), shape('box-b', 400, 300)]);
		(host.deps as unknown as { getSnapToGrid: () => boolean }).getSnapToGrid = () => true;
		(host.deps as unknown as { getGridSize: () => number }).getGridSize = () => gridSize;
		return { host, editor };
	}

	it('snaps a move to a non-default grid size supplied via getGridSize', () => {
		const { host, editor } = hostWithGrid(40);
		const gestures = createTransformGestures(host);

		gestures.begin('move', 'box-a', pointer('pointerdown', 0, 0));
		// A move of (55, 55) rounds to the nearest 40px multiple (40).
		window.dispatchEvent(pointer('pointermove', 55, 55));
		window.dispatchEvent(pointer('pointerup', 55, 55));

		const moved = connectorOf(editor, 'box-a');
		expect(moved.x).toBe(40);
		expect(moved.y).toBe(40);
		gestures.dispose();
	});

	it('falls back to the 12px default when getGridSize is not supplied', () => {
		const { host, editor } = makeHost([shape('box-a', 0, 0), shape('box-b', 400, 300)]);
		(host.deps as unknown as { getSnapToGrid: () => boolean }).getSnapToGrid = () => true;
		const gestures = createTransformGestures(host);

		gestures.begin('move', 'box-a', pointer('pointerdown', 0, 0));
		// A move of (55, 55) rounds to the nearest 12px multiple (60).
		window.dispatchEvent(pointer('pointermove', 55, 55));
		window.dispatchEvent(pointer('pointerup', 55, 55));

		const moved = connectorOf(editor, 'box-a');
		expect(moved.x).toBe(60);
		expect(moved.y).toBe(60);
		gestures.dispose();
	});
});
