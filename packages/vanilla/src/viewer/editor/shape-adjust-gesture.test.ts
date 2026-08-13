/**
 * The shape-adjustment (amber diamond) handle: PowerPoint's `a:avLst` affordance
 * that reshapes a preset instead of resizing its box. Vanilla shipped with no
 * adjust handle at all, so these cover both the overlay chrome and the drag.
 */
import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { createSelectionOverlay } from './selection-overlay';
import { createShapeAdjustGesture, selectedAdjustmentDescriptor } from './shape-adjust-gesture';

function shape(id: string, shapeType: string, locks?: PptxShapeLocks): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		shapeType,
		...(locks ? { locks } : {}),
	} as PptxElement;
}

function pointerEvent(clientX: number): PointerEvent {
	return {
		button: 0,
		pointerId: 1,
		pointerType: 'mouse',
		clientX,
		clientY: 0,
		shiftKey: false,
		target: null,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as PointerEvent;
}

function dispatchWindowPointer(type: string, clientX: number): void {
	const event = new Event(type);
	Object.defineProperties(event, {
		pointerId: { value: 1 },
		clientX: { value: clientX },
		clientY: { value: 0 },
	});
	window.dispatchEvent(event);
}

function setup(elements: PptxElement[], selectedId = elements[0]?.id) {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		slides: [{ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements }],
		selectedElementId: selectedId ?? null,
		selectedElementIds: selectedId ? [selectedId] : [],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });
	const elementById = (id: string): PptxElement | undefined =>
		store.get().slides[0].elements.find((element) => element.id === id);
	return { store, ops, elementById };
}

describe('shape adjustment descriptor', () => {
	it('is null for a plain rect and non-null for a roundRect', () => {
		const rect = setup([shape('r', 'rect')]);
		expect(selectedAdjustmentDescriptor(rect.store.get())).toBeNull();

		const round = setup([shape('r', 'roundRect')]);
		const descriptor = selectedAdjustmentDescriptor(round.store.get());
		expect(descriptor).not.toBeNull();
		expect(descriptor).toMatchObject({ key: 'adj', cursor: 'ew-resize' });
		// Element-LOCAL px offsets from the element's top-left, not slide coords.
		expect(descriptor!.left).toBeGreaterThan(0);
		expect(descriptor!.left).toBeLessThan(200);
	});

	it('is null when a:spLocks forbids the adjust handle', () => {
		const locked = setup([shape('r', 'roundRect', { noAdjustHandles: true })]);
		expect(selectedAdjustmentDescriptor(locked.store.get())).toBeNull();
	});

	it('is null for a multi-selection and while presenting', () => {
		const multi = setup([shape('a', 'roundRect'), shape('b', 'roundRect')]);
		multi.store.set({ selectedElementIds: ['a', 'b'] });
		expect(selectedAdjustmentDescriptor(multi.store.get())).toBeNull();

		const presenting = setup([shape('a', 'roundRect')]);
		presenting.store.set({ presenting: true });
		expect(selectedAdjustmentDescriptor(presenting.store.get())).toBeNull();
	});
});

describe('shape adjustment drag', () => {
	it('writes shapeAdjustments.adj and commits one undoable step', () => {
		const { store, ops, elementById } = setup([shape('r', 'roundRect')]);
		const gesture = createShapeAdjustGesture({ store, ops, getScale: () => 1 });
		const before = selectedAdjustmentDescriptor(store.get())!.value;

		gesture.begin(pointerEvent(100));
		dispatchWindowPointer('pointermove', 160);
		dispatchWindowPointer('pointerup', 160);

		const element = elementById('r');
		const adjustments =
			element && 'shapeAdjustments' in element ? element.shapeAdjustments : undefined;
		expect(adjustments?.adj).toBeTypeOf('number');
		expect(adjustments?.adj).toBeGreaterThan(before);
		expect(adjustments?.adj).toBeLessThanOrEqual(50000);

		ops.undo();
		const undone = elementById('r');
		expect(
			undone && 'shapeAdjustments' in undone ? undone.shapeAdjustments?.adj : undefined,
		).toBeUndefined();
		gesture.dispose();
	});

	it('ignores a press inside the dead zone (a click, not a drag)', () => {
		const { store, ops, elementById } = setup([shape('r', 'roundRect')]);
		const gesture = createShapeAdjustGesture({ store, ops, getScale: () => 1 });
		gesture.begin(pointerEvent(100));
		dispatchWindowPointer('pointermove', 101);
		dispatchWindowPointer('pointerup', 101);
		const element = elementById('r');
		expect(
			element && 'shapeAdjustments' in element ? element.shapeAdjustments : undefined,
		).toBeUndefined();
		gesture.dispose();
	});

	it('never starts on a shape with no adjustable parameter', () => {
		const { store, ops, elementById } = setup([shape('r', 'rect')]);
		const gesture = createShapeAdjustGesture({ store, ops, getScale: () => 1 });
		gesture.begin(pointerEvent(100));
		expect(gesture.isActive()).toBeFalsy();
		dispatchWindowPointer('pointermove', 160);
		dispatchWindowPointer('pointerup', 160);
		const element = elementById('r');
		expect(
			element && 'shapeAdjustments' in element ? element.shapeAdjustments : undefined,
		).toBeUndefined();
		gesture.dispose();
	});
});

describe('selection overlay adjust handle', () => {
	function buildOverlay() {
		const onAdjustPointerDown = vi.fn();
		const overlay = createSelectionOverlay(document, createTranslator(), {
			onHandlePointerDown: vi.fn(),
			onRotatePointerDown: vi.fn(),
			onAdjustPointerDown,
		});
		return { overlay, onAdjustPointerDown };
	}

	it('exposes the "Adjust shape" control the parity contract expects', () => {
		const { overlay } = buildOverlay();
		const handle = overlay.root.querySelector<HTMLElement>('[aria-label="Adjust shape"]');
		expect(handle).not.toBeNull();
		expect(handle?.classList.contains('pptxv-adjust-handle')).toBeTruthy();
		expect(handle?.tagName).toBe('BUTTON');
		// Hidden until a shape with an adjustable preset is the sole selection.
		expect(handle?.hidden).toBeTruthy();
	});

	it('places the diamond at the descriptor offset scaled to the stage', () => {
		const { overlay } = buildOverlay();
		const { store } = setup([shape('r', 'roundRect')]);
		const descriptor = selectedAdjustmentDescriptor(store.get())!;

		overlay.setAdjustHandle(descriptor, 2);
		const handle = overlay.root.querySelector<HTMLElement>('.pptxv-adjust-handle');
		expect(handle?.hidden).toBeFalsy();
		expect(handle?.style.left).toBe(`${descriptor.left * 2}px`);
		expect(handle?.style.top).toBe(`${descriptor.top * 2}px`);

		overlay.setAdjustHandle(null, 2);
		expect(handle?.hidden).toBeTruthy();
	});

	it('routes a pointerdown on the diamond into the stage adjust gesture', () => {
		const { store, ops } = setup([shape('r', 'roundRect')]);
		const stage = document.createElement('div');
		stage.className = 'pptxv-stage';
		const wrap = document.createElement('div');
		wrap.appendChild(stage);
		document.body.appendChild(wrap);

		let overlayRef: ReturnType<typeof createSelectionOverlay> | null = null;
		const interactions = createStageInteractions({
			doc: document,
			store,
			ops,
			getScale: () => 1,
			getOverlay: () => overlayRef,
			getStageRoot: () => stage,
		});
		overlayRef = createSelectionOverlay(document, createTranslator(), {
			onHandlePointerDown: vi.fn(),
			onRotatePointerDown: vi.fn(),
			onAdjustPointerDown: (event) => interactions.beginAdjustGesture(event),
		});
		overlayRef.mount(wrap);
		overlayRef.setAdjustHandle(selectedAdjustmentDescriptor(store.get()), 1);

		const handle = overlayRef.root.querySelector<HTMLElement>('.pptxv-adjust-handle');
		handle?.dispatchEvent(
			Object.defineProperties(new Event('pointerdown', { bubbles: false }), {
				pointerId: { value: 1 },
				clientX: { value: 100 },
				clientY: { value: 0 },
			}),
		);
		dispatchWindowPointer('pointermove', 160);
		dispatchWindowPointer('pointerup', 160);

		const element = store.get().slides[0].elements[0];
		expect('shapeAdjustments' in element ? element.shapeAdjustments?.adj : undefined).toBeTypeOf(
			'number',
		);
		interactions.dispose();
		wrap.remove();
	});
});
