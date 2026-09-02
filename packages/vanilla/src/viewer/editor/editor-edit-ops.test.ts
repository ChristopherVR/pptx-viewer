/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createEditActions } from './editor-edit-ops';
import { createEditorOps } from './editor-operations';

function shape(id: string, x = 0): PptxElement {
	return {
		type: 'shape',
		id,
		x,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#ffffff', strokeColor: '#000000', strokeWidth: 1 },
		text: 'hi',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'hi', style: { fontSize: 18 } }],
	} as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId1', slideNumber: 1, elements, notes: '' };
}

function setup(overrides: Partial<ViewerState> = {}) {
	const store = createStore({
		...createInitialViewerState(),
		slides: [slide([shape('a'), shape('b', 200)])],
		currentSlide: 0,
		editable: true,
		selectedElementId: 'a',
		...overrides,
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	const actions = createEditActions({
		doc: document,
		getTranslator: () => createTranslator(),
		store,
		ops,
		getHandler: () => null,
		setHandler: () => {},
	});
	return { store, ops, actions };
}

function elementById(
	store: ReturnType<typeof setup>['store'],
	id: string,
): PptxElement | undefined {
	return store.get().slides[0].elements.find((e) => e.id === id);
}

describe('createEditActions formatting', () => {
	it('toggles bold with history, and undo reverts it', () => {
		const { store, ops, actions } = setup();
		actions.toggleBold();
		const el = elementById(store, 'a') as PptxElement & { textStyle: { bold?: boolean } };
		expect(el.textStyle.bold).toBeTruthy();
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();
		ops.undo();
		const reverted = elementById(store, 'a') as PptxElement & { textStyle: { bold?: boolean } };
		expect(reverted.textStyle.bold).toBeFalsy();
	});

	it('sets the shape fill colour and forces solid fill mode (shared shapeFillChange)', () => {
		const { store, actions } = setup();
		actions.setShapeFill('#abcdef');
		const el = elementById(store, 'a') as PptxElement & {
			shapeStyle: { fillColor?: string; fillMode?: string };
		};
		expect(el.shapeStyle.fillColor).toBe('#abcdef');
		expect(el.shapeStyle.fillMode).toBe('solid');
	});

	it('sets the shape outline (stroke) colour without disturbing the fill', () => {
		const { store, actions } = setup();
		actions.setShapeStroke('#123456');
		const el = elementById(store, 'a') as PptxElement & {
			shapeStyle: { fillColor?: string; strokeColor?: string };
		};
		expect(el.shapeStyle.strokeColor).toBe('#123456');
		expect(el.shapeStyle.fillColor).toBe('#ffffff');
	});

	it('does nothing when the viewer is not editable', () => {
		const { store, ops, actions } = setup({ editable: false });
		actions.toggleBold();
		expect(ops.canUndo()).toBeFalsy();
		expect(store.get().dirty).toBeFalsy();
	});

	it('does nothing when there is no selection', () => {
		const { ops, actions } = setup({ selectedElementId: null });
		actions.toggleBold();
		expect(ops.canUndo()).toBeFalsy();
	});
});

describe('createEditActions geometry', () => {
	it('commits an X/Y/size patch through history', () => {
		const { store, ops, actions } = setup();
		actions.setGeometry({ x: 250, width: 42 });
		const el = elementById(store, 'a');
		expect(el?.x).toBe(250);
		expect(el?.width).toBe(42);
		expect(ops.canUndo()).toBeTruthy();
	});

	it('clamps width/height to at least the minimum size', () => {
		const { store, actions } = setup();
		actions.setGeometry({ width: -5, height: 0 });
		const el = elementById(store, 'a');
		expect(el?.width).toBeGreaterThanOrEqual(1);
		expect(el?.height).toBeGreaterThanOrEqual(1);
	});
});

describe('createEditActions insert', () => {
	it('appends a new rectangle, selects it, and records history', () => {
		const { store, ops, actions } = setup();
		const before = store.get().slides[0].elements.length;
		actions.insert('shape', 'rect');
		const elements = store.get().slides[0].elements;
		expect(elements).toHaveLength(before + 1);
		const inserted = elements[elements.length - 1];
		expect(inserted.type).toBe('shape');
		expect(store.get().selectedElementId).toBe(inserted.id);
		expect(ops.canUndo()).toBeTruthy();
	});

	it('inserts a table via the shared factory', () => {
		const { store, actions } = setup();
		actions.insert('table');
		const elements = store.get().slides[0].elements;
		expect(elements[elements.length - 1].type).toBe('table');
	});
});

describe('createEditActions z-order', () => {
	it('brings the selected element to the front (end of the array)', () => {
		const { store, ops, actions } = setup();
		actions.bringToFront();
		expect(store.get().slides[0].elements.map((e) => e.id)).toStrictEqual(['b', 'a']);
		expect(ops.canUndo()).toBeTruthy();
	});

	it('sends the selected element to the back (index 0)', () => {
		const { store, actions } = setup({ selectedElementId: 'b' });
		actions.sendToBack();
		expect(store.get().slides[0].elements.map((e) => e.id)).toStrictEqual(['b', 'a']);
	});

	it('is a no-op (no history) when already at the front', () => {
		const { ops, actions } = setup({ selectedElementId: 'b' });
		actions.bringToFront();
		expect(ops.canUndo()).toBeFalsy();
	});
});

describe('createEditActions toggleViewOption', () => {
	it('flips a plain view toggle with no p:viewPr equivalent, outside history', () => {
		const { store, ops, actions } = setup({ showGrid: false });
		actions.toggleViewOption('showGrid');
		expect(store.get().showGrid).toBeTruthy();
		expect(ops.canUndo()).toBeFalsy();
	});

	it('flips snapToGrid AND writes it back into viewProperties.slideViewPr', () => {
		const { store, actions } = setup({
			snapToGrid: false,
			viewProperties: { slideViewPr: { snapToObjects: true, showGuides: true } },
		});
		actions.toggleViewOption('snapToGrid');
		expect(store.get().snapToGrid).toBeTruthy();
		expect(store.get().viewProperties?.slideViewPr).toStrictEqual({
			snapToGrid: true,
			snapToObjects: true,
			showGuides: true,
		});
	});

	it('flips snapToShape (== OOXML snapToObjects) and writes it back too', () => {
		const { store, actions } = setup({ snapToShape: true });
		actions.toggleViewOption('snapToShape');
		expect(store.get().snapToShape).toBeFalsy();
		expect(store.get().viewProperties?.slideViewPr?.snapToObjects).toBeFalsy();
	});

	it('toggles the `.pptxv-<option>` class on every mounted root', () => {
		const { actions } = setup({ showGuides: true });
		const root = document.createElement('div');
		root.className = 'pptxv pptxv-showGuides';
		document.body.appendChild(root);

		actions.toggleViewOption('showGuides');

		expect(root.classList.contains('pptxv-showGuides')).toBeFalsy();
		root.remove();
	});
});
