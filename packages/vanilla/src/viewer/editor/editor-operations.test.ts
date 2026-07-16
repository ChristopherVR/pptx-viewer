import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';

function buildSlide(id: string, notes = ''): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], notes };
}

describe('createEditorOps commitNotes', () => {
	it('writes the plain-text notes onto the current slide and records history when editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'old notes')],
			currentSlide: 0,
			editable: true,
		});
		const onHistoryChange = vi.fn();
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange });

		ops.commitNotes('new notes');

		expect(store.get().slides[0].notes).toBe('new notes');
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();

		ops.undo();
		expect(store.get().slides[0].notes).toBe('old notes');
	});

	it('is a no-op when the viewer is not editable (view-only mode)', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'old notes')],
			currentSlide: 0,
			editable: false,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('attempted edit');

		expect(store.get().slides[0].notes).toBe('old notes');
		expect(store.get().dirty).toBeFalsy();
		expect(ops.canUndo()).toBeFalsy();
	});

	it('is a no-op when the text is unchanged (no spurious history entry)', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'same notes')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('same notes');

		expect(ops.canUndo()).toBeFalsy();
	});

	it('commits onto the active slide only, leaving the other slides untouched', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'notes a'), buildSlide('b', 'notes b')],
			currentSlide: 1,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('updated b');

		expect(store.get().slides[0].notes).toBe('notes a');
		expect(store.get().slides[1].notes).toBe('updated b');
	});
});

describe('createEditorOps Format Painter', () => {
	it('copies source formatting to the target as one undoable change', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [
				{
					...buildSlide('a'),
					elements: [
						{
							id: 'source',
							type: 'shape',
							shapeType: 'rect',
							x: 0,
							y: 0,
							width: 10,
							height: 10,
							shapeStyle: { fillColor: '#ff0000' },
						},
						{
							id: 'target',
							type: 'shape',
							shapeType: 'rect',
							x: 20,
							y: 0,
							width: 10,
							height: 10,
							shapeStyle: { fillColor: '#0000ff' },
						},
					],
				} as PptxSlide,
			],
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		expect(ops.applyFormatPainter('source', 'target')).toBeTruthy();
		expect(store.get().slides[0].elements[1]).toMatchObject({
			shapeStyle: { fillColor: '#ff0000' },
		});
		ops.undo();
		expect(store.get().slides[0].elements[1]).toMatchObject({
			shapeStyle: { fillColor: '#0000ff' },
		});
	});
});

describe('createEditorOps structured content', () => {
	it('updates table cells and equations with undo support', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [
				{
					...buildSlide('a'),
					elements: [
						{
							id: 'table',
							type: 'table',
							x: 0,
							y: 0,
							width: 100,
							height: 50,
							tableData: { rows: [{ cells: [{ text: 'old' }] }], columnWidths: [1] },
						},
						{
							id: 'eq',
							type: 'text',
							x: 0,
							y: 60,
							width: 100,
							height: 30,
							textSegments: [{ text: '', equationXml: { 'm:oMath': { 'm:r': { 'm:t': 'x' } } } }],
						},
					],
				} as PptxSlide,
			],
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		ops.commitTableCell('table', 0, 0, 'new');
		expect(store.get().slides[0].elements[0]).toMatchObject({
			tableData: { rows: [{ cells: [{ text: 'new' }] }] },
		});
		ops.updateEquation('eq', { 'm:oMath': { 'm:r': { 'm:t': '42' } } });
		expect(JSON.stringify(store.get().slides[0].elements[1])).toContain('42');
		ops.undo();
		expect(JSON.stringify(store.get().slides[0].elements[1])).toContain('x');
	});
});

describe('createEditorOps handout master', () => {
	it('commits slides-per-page as one undoable master mutation', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			handoutMaster: { path: 'ppt/handoutMasters/handoutMaster1.xml', slidesPerPage: 4 },
			handoutSlidesPerPage: 4,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.setHandoutSlidesPerPage(6);

		expect(store.get().handoutSlidesPerPage).toBe(6);
		expect(store.get().handoutMaster?.slidesPerPage).toBe(6);
		expect(store.get().dirty).toBeTruthy();
		ops.undo();
		expect(store.get().handoutSlidesPerPage).toBe(4);
		expect(store.get().handoutMaster?.slidesPerPage).toBe(4);
	});
});

describe('createEditorOps save formats', () => {
	it('passes the requested OpenXML output format to core', async () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			dirty: true,
		});
		const save = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		const handler = { save } as unknown as PptxHandler;
		const ops = createEditorOps({
			store,
			getHandler: () => handler,
			onHistoryChange: vi.fn(),
		});

		await ops.save('ppsx');

		expect(save).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ outputFormat: 'ppsx' }),
		);
		expect(store.get().dirty).toBeFalsy();
	});
});
