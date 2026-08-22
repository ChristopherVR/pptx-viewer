/**
 * Regression coverage for "the deck's authored grid spacing never reached
 * snap-to-grid": `createTransformGestures`'s `onPreview` used to call
 * `snapToGrid(transform, state.snapToGrid)`, which always used the hardcoded
 * 10px step because `snapToGrid` had no way to accept a different one. It now
 * derives the step from `state.viewProperties.gridSpacing` (via the shared
 * `computeGridSpacingPx`), never from `presentationProperties` -- a real
 * PowerPoint file never populates `p:gridSpacing` under `p:presentationPr`.
 *
 * Drives a real move gesture end-to-end (pointerdown -> window pointermove ->
 * pointerup) through `createStageInteractions`, matching the pattern in
 * `editor-connector-sync.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { createSelectionOverlay } from './selection-overlay';

function shape(id: string, x: number, y: number): PptxElement {
	return { type: 'shape', id, x, y, width: 100, height: 100, shapeType: 'rect' } as PptxElement;
}

function pointerDown(target: EventTarget): PointerEvent {
	return {
		button: 0,
		pointerId: 1,
		pointerType: 'mouse',
		timeStamp: 0,
		clientX: 0,
		clientY: 0,
		shiftKey: false,
		target,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as PointerEvent;
}

function dispatchWindowPointer(type: string, clientX: number, clientY: number): void {
	const event = new Event(type);
	Object.defineProperties(event, {
		pointerId: { value: 1 },
		clientX: { value: clientX },
		clientY: { value: clientY },
		shiftKey: { value: false },
	});
	window.dispatchEvent(event);
}

function setup(gridSpacingCx: number | undefined) {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		snapToShape: false,
		snapToGrid: true,
		viewProperties:
			gridSpacingCx === undefined
				? undefined
				: { gridSpacing: { cx: gridSpacingCx, cy: gridSpacingCx } },
		slides: [
			{
				id: 'slide-1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [shape('box-a', 0, 0), shape('box-b', 300, 0)],
			},
		],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });

	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const boxA = document.createElement('div');
	boxA.dataset.elementId = 'box-a';
	stage.appendChild(boxA);
	const wrap = document.createElement('div');
	wrap.appendChild(stage);
	document.body.appendChild(wrap);

	const overlay = createSelectionOverlay(document, createTranslator(), {
		onHandlePointerDown: vi.fn(),
		onRotatePointerDown: vi.fn(),
		onAdjustPointerDown: vi.fn(),
	});
	overlay.mount(wrap);

	const interactions = createStageInteractions({
		doc: document,
		store,
		ops,
		getScale: () => 1,
		getOverlay: () => overlay,
		getStageRoot: () => stage,
	});

	const dragBoxA = (dx: number, dy: number): void => {
		interactions.onStagePointerDown(pointerDown(boxA));
		dispatchWindowPointer('pointermove', dx, dy);
		dispatchWindowPointer('pointerup', dx, dy);
	};

	const elementById = (id: string): PptxElement | undefined =>
		store.get().slides[0].elements.find((element) => element.id === id);

	const cleanup = (): void => {
		interactions.dispose();
		wrap.remove();
	};

	return { dragBoxA, elementById, cleanup };
}

describe('snap-to-grid uses the deck-authored grid spacing', () => {
	it('snaps a move to a non-default grid size from viewProperties.gridSpacing', () => {
		// 9525 EMU/px * 40 = 381000 EMU => 40px, not the 10px default.
		const { dragBoxA, elementById, cleanup } = setup(381000);

		dragBoxA(55, 55);

		// A move of (55, 55) rounds to the nearest 40px multiple (40).
		expect(elementById('box-a')).toMatchObject({ x: 40, y: 40 });
		cleanup();
	});

	it('falls back to the 10px default when the deck has no gridSpacing', () => {
		const { dragBoxA, elementById, cleanup } = setup(undefined);

		dragBoxA(55, 55);

		// A move of (55, 55) rounds to the nearest 10px multiple (60).
		expect(elementById('box-a')).toMatchObject({ x: 60, y: 60 });
		cleanup();
	});
});
