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
import { createShapeAdjustGesture, selectedAdjustmentDescriptors } from './shape-adjust-gesture';

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

describe('shape adjustment descriptors', () => {
	it('is empty for a plain rect and non-empty for a roundRect', () => {
		const rect = setup([shape('r', 'rect')]);
		expect(selectedAdjustmentDescriptors(rect.store.get())).toStrictEqual([]);

		const round = setup([shape('r', 'roundRect')]);
		const [descriptor, ...rest] = selectedAdjustmentDescriptors(round.store.get());
		expect(rest).toHaveLength(0);
		expect(descriptor).toMatchObject({ key: 'adj', cursor: 'ew-resize' });
		// Element-LOCAL px offsets from the element's top-left, not slide coords.
		expect(descriptor.left).toBeGreaterThan(0);
		expect(descriptor.left).toBeLessThan(200);
		// Guide space, not a 0-1 fraction: a 200x100 roundRect at the default
		// 16667 puts the handle ss * 16667 / 100000 = 16.667 px along the top.
		expect(descriptor.value).toBe(16667);
		expect(descriptor.left).toBeCloseTo(16.667, 3);
	});

	it('offers one descriptor per adjustable parameter', () => {
		const arrow = setup([shape('a', 'rightArrow')]);
		expect(selectedAdjustmentDescriptors(arrow.store.get()).map((d) => d.key)).toStrictEqual([
			'adj1',
			'adj2',
		]);
	});

	it('is empty when a:spLocks forbids the adjust handle', () => {
		const locked = setup([shape('r', 'roundRect', { noAdjustHandles: true })]);
		expect(selectedAdjustmentDescriptors(locked.store.get())).toStrictEqual([]);
	});

	it('is empty for a multi-selection and while presenting', () => {
		const multi = setup([shape('a', 'roundRect'), shape('b', 'roundRect')]);
		multi.store.set({ selectedElementIds: ['a', 'b'] });
		expect(selectedAdjustmentDescriptors(multi.store.get())).toStrictEqual([]);

		const presenting = setup([shape('a', 'roundRect')]);
		presenting.store.set({ presenting: true });
		expect(selectedAdjustmentDescriptors(presenting.store.get())).toStrictEqual([]);
	});
});

describe('shape adjustment drag', () => {
	it('writes shapeAdjustments.adj and commits one undoable step', () => {
		const { store, ops, elementById } = setup([shape('r', 'roundRect')]);
		const gesture = createShapeAdjustGesture({ store, ops, getScale: () => 1 });
		const [descriptor] = selectedAdjustmentDescriptors(store.get());
		const before = descriptor.value;

		gesture.begin(pointerEvent(100), descriptor);
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
		gesture.begin(pointerEvent(100), selectedAdjustmentDescriptors(store.get())[0]);
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
		// A plain rect offers no descriptor at all, so there is nothing to grab.
		expect(selectedAdjustmentDescriptors(store.get())).toStrictEqual([]);
		gesture.begin(pointerEvent(100), selectedAdjustmentDescriptors(store.get())[0]);
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
		const { store } = setup([shape('r', 'roundRect')]);
		// Nothing is drawn until a shape with an adjustable preset is selected.
		expect(overlay.root.querySelector('[aria-label="Adjust shape"]')).toBeNull();

		overlay.setAdjustHandles(selectedAdjustmentDescriptors(store.get()), 1);
		const handle = overlay.root.querySelector<HTMLElement>('[aria-label="Adjust shape"]');
		expect(handle).not.toBeNull();
		expect(handle?.classList.contains('pptxv-adjust-handle')).toBeTruthy();
		expect(handle?.tagName).toBe('BUTTON');
		expect(handle?.hidden).toBeFalsy();
	});

	it('places the diamond at the descriptor offset scaled to the stage', () => {
		const { overlay } = buildOverlay();
		const { store } = setup([shape('r', 'roundRect')]);
		const [descriptor] = selectedAdjustmentDescriptors(store.get());

		overlay.setAdjustHandles([descriptor], 2);
		const handle = overlay.root.querySelector<HTMLElement>('.pptxv-adjust-handle');
		expect(handle?.hidden).toBeFalsy();
		expect(handle?.style.left).toBe(`${descriptor.left * 2}px`);
		expect(handle?.style.top).toBe(`${descriptor.top * 2}px`);

		overlay.setAdjustHandles([], 2);
		expect(handle?.hidden).toBeTruthy();
	});

	// PowerPoint offers one diamond per `a:avLst` guide; the overlay used to own
	// exactly one button, so every guide after the first was unreachable.
	it('draws one diamond per adjustable parameter', () => {
		const { overlay } = buildOverlay();
		const { store } = setup([shape('a', 'rightArrow')]);
		overlay.setAdjustHandles(selectedAdjustmentDescriptors(store.get()), 1);
		const keys = [...overlay.root.querySelectorAll<HTMLElement>('.pptxv-adjust-handle')]
			.filter((el) => !el.hidden)
			.map((el) => el.dataset.pptxAdjustKey);
		expect(keys).toStrictEqual(['adj1', 'adj2']);
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
			onAdjustPointerDown: (event, descriptor) =>
				interactions.beginAdjustGesture(event, descriptor),
		});
		overlayRef.mount(wrap);
		overlayRef.setAdjustHandles(selectedAdjustmentDescriptors(store.get()), 1);

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
