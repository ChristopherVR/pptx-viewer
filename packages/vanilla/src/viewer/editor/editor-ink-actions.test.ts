import type { InkPptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createInkActions } from './editor-ink-actions';
import { createEditorOps } from './editor-operations';

function buildSlide(id: string, elements: PptxSlide['elements'] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

function buildInk(id: string, overrides: Partial<InkPptxElement> = {}): InkPptxElement {
	return {
		id,
		type: 'ink',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		inkPaths: ['M0 0 L10 10'],
		inkColors: ['#000000'],
		inkWidths: [3],
		inkOpacities: [1],
		inkTool: 'pen',
		...overrides,
	};
}

describe('createInkActions', () => {
	describe('commitStroke', () => {
		it('appends a new ink element built from the stroke points, selects it, and records history', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a')],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			actions.commitStroke({
				points: [
					{ x: 10, y: 10 },
					{ x: 20, y: 30 },
					{ x: 40, y: 20 },
				],
				color: '#ff0000',
				width: 4,
				tool: 'pen',
			});

			const elements = store.get().slides[0].elements;
			expect(elements).toHaveLength(1);
			const ink = elements[0] as InkPptxElement;
			expect(ink.type).toBe('ink');
			expect(ink.inkColors).toStrictEqual(['#ff0000']);
			expect(ink.inkWidths).toStrictEqual([4]);
			expect(ink.inkTool).toBe('pen');
			expect(store.get().selectedElementId).toBe(ink.id);
			expect(store.get().dirty).toBeTruthy();
			expect(ops.canUndo()).toBeTruthy();

			ops.undo();
			expect(store.get().slides[0].elements).toHaveLength(0);
		});

		it('marks a highlighter stroke with the highlighter tool and reduced opacity', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a')],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			actions.commitStroke({
				points: [
					{ x: 0, y: 0 },
					{ x: 5, y: 5 },
				],
				color: '#ffff00',
				width: 12,
				tool: 'highlighter',
			});

			const ink = store.get().slides[0].elements[0] as InkPptxElement;
			expect(ink.inkTool).toBe('highlighter');
			expect(ink.inkOpacities).toStrictEqual([0.4]);
		});

		it('is a no-op for a single-point stroke (a plain tap)', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a')],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			actions.commitStroke({ points: [{ x: 1, y: 1 }], color: '#000000', width: 3, tool: 'pen' });

			expect(store.get().slides[0].elements).toHaveLength(0);
			expect(ops.canUndo()).toBeFalsy();
		});

		it('is a no-op when the viewer is not editable', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a')],
				currentSlide: 0,
				editable: false,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			actions.commitStroke({
				points: [
					{ x: 0, y: 0 },
					{ x: 5, y: 5 },
				],
				color: '#000000',
				width: 3,
				tool: 'pen',
			});

			expect(store.get().slides[0].elements).toHaveLength(0);
		});
	});

	describe('eraseInkElement', () => {
		it('removes the ink element with the given id and records history', () => {
			const ink = buildInk('ink-1');
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a', [ink])],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			const erased = actions.eraseInkElement('ink-1');

			expect(erased).toBeTruthy();
			expect(store.get().slides[0].elements).toHaveLength(0);
			expect(ops.canUndo()).toBeTruthy();

			ops.undo();
			expect(store.get().slides[0].elements).toHaveLength(1);
		});

		it('clears the selection when the erased element was selected', () => {
			const ink = buildInk('ink-1');
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a', [ink])],
				currentSlide: 0,
				editable: true,
				selectedElementId: 'ink-1',
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			actions.eraseInkElement('ink-1');

			expect(store.get().selectedElementId).toBeNull();
		});

		it('returns false and does nothing for a non-ink element', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [
					buildSlide('a', [
						{
							id: 'shape-1',
							type: 'shape',
							x: 0,
							y: 0,
							width: 10,
							height: 10,
							shapeType: 'rect',
						} as PptxSlide['elements'][number],
					]),
				],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			const erased = actions.eraseInkElement('shape-1');

			expect(erased).toBeFalsy();
			expect(store.get().slides[0].elements).toHaveLength(1);
			expect(ops.canUndo()).toBeFalsy();
		});

		it('returns false for an unknown id', () => {
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a')],
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			expect(actions.eraseInkElement('missing')).toBeFalsy();
		});

		it('returns false when the viewer is not editable', () => {
			const ink = buildInk('ink-1');
			const store = createStore({
				...createInitialViewerState(),
				slides: [buildSlide('a', [ink])],
				currentSlide: 0,
				editable: false,
			});
			const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
			const actions = createInkActions({ store, ops });

			expect(actions.eraseInkElement('ink-1')).toBeFalsy();
			expect(store.get().slides[0].elements).toHaveLength(1);
		});
	});
});
