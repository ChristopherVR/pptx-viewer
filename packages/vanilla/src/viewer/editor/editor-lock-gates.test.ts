/**
 * `a:spLocks` enforcement on the canvas. The locks are authored per shape in a
 * real deck ("the reader may not drag this masthead"), and every verdict comes
 * from shared's `element-locks`; these tests drive the REAL stage interactions
 * and the REAL overlay so a lock that is only respected in theory fails here.
 */
import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { selectionInteractivity } from './editor-lock-gates';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { canInlineEditElement } from './inline-text-editor';
import { createSelectionOverlay } from './selection-overlay';

function shape(id: string, locks?: PptxShapeLocks): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 10,
		width: 100,
		height: 80,
		shapeType: 'rect',
		text: 'HELLO',
		textSegments: [{ text: 'HELLO' }],
		...(locks ? { locks } : {}),
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

function setup(elements: PptxElement[]) {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		snapToShape: false,
		slides: [{ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements }],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });

	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const nodes: Record<string, HTMLElement> = {};
	for (const element of elements) {
		const node = document.createElement('div');
		node.dataset.elementId = element.id;
		nodes[element.id] = node;
		stage.appendChild(node);
	}
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

	const drag = (id: string, dx: number, dy: number): void => {
		interactions.onStagePointerDown(pointerDown(nodes[id]));
		dispatchWindowPointer('pointermove', dx, dy);
		dispatchWindowPointer('pointerup', dx, dy);
	};

	const dragHandle = (kind: 'resize' | 'rotate', dx: number, dy: number): void => {
		interactions.beginHandleGesture(kind, pointerDown(stage), kind === 'resize' ? 'se' : undefined);
		dispatchWindowPointer('pointermove', dx, dy);
		dispatchWindowPointer('pointerup', dx, dy);
	};

	const elementById = (id: string): PptxElement | undefined =>
		store.get().slides[0].elements.find((element) => element.id === id);

	const cleanup = (): void => {
		interactions.dispose();
		wrap.remove();
	};

	return { store, interactions, overlay, drag, dragHandle, elementById, cleanup };
}

describe('canvas lock enforcement', () => {
	it('drags an unlocked shape (control)', () => {
		const { drag, elementById, cleanup } = setup([shape('free')]);
		drag('free', 40, 30);
		expect(elementById('free')).toMatchObject({ x: 50, y: 40 });
		cleanup();
	});

	it('does not arm a drag on a noMove shape, but still selects it', () => {
		const { store, drag, elementById, cleanup } = setup([shape('pinned', { noMove: true })]);
		drag('pinned', 40, 30);
		expect(elementById('pinned')).toMatchObject({ x: 10, y: 10 });
		// Still selectable, so the user can unlock it from the inspector.
		expect(store.get().selectedElementId).toBe('pinned');
		cleanup();
	});

	it('does not select a noSelect shape (the press starts a marquee instead)', () => {
		const { store, drag, elementById, cleanup } = setup([shape('sealed', { noSelect: true })]);
		drag('sealed', 40, 30);
		expect(store.get().selectedElementId).toBeNull();
		expect(elementById('sealed')).toMatchObject({ x: 10, y: 10 });
		cleanup();
	});

	it('refuses the resize gesture on a noResize shape but allows rotation', () => {
		const { store, dragHandle, elementById, cleanup } = setup([shape('fixed', { noResize: true })]);
		store.set({ selectedElementId: 'fixed', selectedElementIds: ['fixed'] });

		dragHandle('resize', 40, 30);
		expect(elementById('fixed')).toMatchObject({ width: 100, height: 80 });

		dragHandle('rotate', 40, 30);
		expect(elementById('fixed')?.rotation ?? 0).not.toBe(0);
		cleanup();
	});

	it('refuses the rotate gesture on a noRotation shape', () => {
		const { store, dragHandle, elementById, cleanup } = setup([
			shape('upright', { noRotation: true }),
		]);
		store.set({ selectedElementId: 'upright', selectedElementIds: ['upright'] });
		dragHandle('rotate', 40, 30);
		expect(elementById('upright')?.rotation ?? 0).toBe(0);
		cleanup();
	});

	it('moves only the movable members of a multi-selection', () => {
		const { store, drag, elementById, cleanup } = setup([
			shape('free'),
			shape('pinned', { noMove: true }),
		]);
		store.set({ selectedElementId: 'free', selectedElementIds: ['free', 'pinned'] });
		drag('free', 40, 30);
		expect(elementById('free')).toMatchObject({ x: 50, y: 40 });
		expect(elementById('pinned')).toMatchObject({ x: 10, y: 10 });
		cleanup();
	});

	it('hides the resize handles and the rotate knob the selection cannot use', () => {
		const { store, overlay, cleanup } = setup([shape('fixed', { noResize: true })]);
		store.set({ selectedElementId: 'fixed', selectedElementIds: ['fixed'] });
		const verdict = selectionInteractivity(store.get());
		expect(verdict).toMatchObject({ resizable: false, rotatable: true, selectable: true });

		overlay.setHandleVisibility(verdict);
		const handles = overlay.root.querySelectorAll<HTMLElement>('.pptxv-sel-handle');
		expect(handles).toHaveLength(8);
		expect([...handles].every((handle) => handle.hidden)).toBeTruthy();
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-rotate-knob')?.hidden).toBeFalsy();

		overlay.setHandleVisibility({ resizable: true, rotatable: false });
		expect([...handles].some((handle) => handle.hidden)).toBeFalsy();
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-rotate-knob')?.hidden).toBeTruthy();
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-rotate-stem')?.hidden).toBeTruthy();
		cleanup();
	});

	it('ands the verdict across a multi-selection', () => {
		const { store, cleanup } = setup([shape('free'), shape('fixed', { noResize: true })]);
		store.set({ selectedElementId: 'free', selectedElementIds: ['free', 'fixed'] });
		expect(selectionInteractivity(store.get())).toMatchObject({
			resizable: false,
			movable: true,
		});
		cleanup();
	});

	it('routes the inline-editor gate through the shared lock composition', () => {
		expect(canInlineEditElement(shape('a'))).toBeTruthy();
		expect(canInlineEditElement(shape('b', { noTextEdit: true }))).toBeFalsy();
		// `noSelect` subsumes every other gesture, text editing included.
		expect(canInlineEditElement(shape('c', { noSelect: true }))).toBeFalsy();
	});
});
