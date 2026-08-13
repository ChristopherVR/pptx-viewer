/**
 * A connector attached to a shape must follow that shape when it is dragged.
 * The reroute is driven from the gesture-END handler in
 * `editor-stage-interactions`, so the test drives a real drag through the real
 * stage interactions rather than calling the shared helper directly.
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

/** A connector wired right-of-A to left-of-B (connection sites 1 and 3). */
function connector(): PptxElement {
	return {
		type: 'connector',
		id: 'conn',
		x: 100,
		y: 50,
		width: 200,
		height: 1,
		shapeStyle: {
			connectorStartConnection: { shapeId: 'box-a', connectionSiteIndex: 1 },
			connectorEndConnection: { shapeId: 'box-b', connectionSiteIndex: 3 },
		},
	} as PptxElement;
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

/** Dispatch a window-level pointer event the gesture controller listens for. */
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

function setup() {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		snapToShape: false,
		slides: [
			{
				id: 'slide-1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [shape('box-a', 0, 0), shape('box-b', 300, 0), connector()],
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

	return { store, ops, interactions, dragBoxA, elementById, cleanup };
}

describe('connectors follow the shape they are attached to', () => {
	it('reroutes a bound connector when its shape is dragged', () => {
		const { dragBoxA, elementById, cleanup } = setup();

		// Right-centre of box-a is (100, 50); left-centre of box-b is (300, 50).
		expect(elementById('conn')).toMatchObject({ x: 100, y: 50, width: 200 });

		dragBoxA(50, 40);

		// box-a now sits at (50, 40), so its right-centre is (150, 90) and the
		// connector must span from there to (300, 50).
		expect(elementById('box-a')).toMatchObject({ x: 50, y: 40 });
		expect(elementById('conn')).toMatchObject({ x: 150, y: 50, width: 150, height: 40 });
		cleanup();
	});

	it('does not add a second undo entry for the reroute', () => {
		const { ops, dragBoxA, elementById, cleanup } = setup();
		dragBoxA(50, 40);
		expect(elementById('conn')).toMatchObject({ x: 150 });

		// One undo puts BOTH the shape and its connector back: the reroute rides
		// in the gesture's own history entry.
		ops.undo();
		expect(elementById('box-a')).toMatchObject({ x: 0, y: 0 });
		expect(elementById('conn')).toMatchObject({ x: 100, y: 50, width: 200 });
		cleanup();
	});

	it('leaves connectors alone when nothing they reference moved', () => {
		const { store, dragBoxA, elementById, cleanup } = setup();
		store.set({
			slides: [
				{
					...store.get().slides[0],
					elements: [
						shape('box-a', 0, 0),
						shape('box-b', 300, 0),
						{ ...connector(), shapeStyle: {} } as PptxElement,
					],
				},
			],
		});
		dragBoxA(50, 40);
		expect(elementById('conn')).toMatchObject({ x: 100, y: 50, width: 200 });
		cleanup();
	});
});
