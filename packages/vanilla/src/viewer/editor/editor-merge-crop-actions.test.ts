import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { readCropInsets as insets } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createCropActions } from './editor-crop-actions';
import { createMergeActions } from './editor-merge-actions';
import { createEditorOps } from './editor-operations';

const rect = (id: string, x: number, fill: string): PptxElement =>
	({
		type: 'shape',
		id,
		x,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'rect',
		shapeStyle: { fillColor: fill },
	}) as PptxElement;

const picture = (): PptxElement =>
	({
		type: 'picture',
		id: 'pic',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		imageData: 'data:image/png;base64,AAAA',
	}) as PptxElement;

function setup(elements: PptxElement[], state: Partial<ViewerState> = {}) {
	const slide: PptxSlide = { id: 's1', rId: 'rId1', slideNumber: 1, elements };
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: [slide],
		editable: true,
		...state,
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	return {
		store,
		ops,
		merge: createMergeActions({ store, ops }),
		crop: createCropActions({ doc: document, store, ops }),
		elements: () => store.get().slides[0].elements,
		pic: () => store.get().slides[0].elements.find((el) => el.id === 'pic')!,
	};
}

describe('createMergeActions', () => {
	it('replaces two overlapping shapes with one custom shape as one undo step', () => {
		const ctx = setup([rect('b', 50, '#0000ff'), rect('a', 0, '#ff0000')], {
			selectedElementId: 'b',
			selectedElementIds: ['a', 'b'],
		});
		ctx.merge.mergeShapes('union');
		const after = ctx.elements();
		expect(after).toHaveLength(1);
		expect(after[0].type).toBe('shape');
		expect((after[0] as { customGeometryPaths?: unknown[] }).customGeometryPaths?.length).toBe(1);
		// The FIRST-selected shape's formatting survives, not the first painted.
		expect((after[0] as { shapeStyle?: { fillColor?: string } }).shapeStyle?.fillColor).toBe(
			'#ff0000',
		);
		expect(ctx.store.get().selectedElementIds).toStrictEqual([after[0].id]);
		expect(ctx.ops.canUndo()).toBeTruthy();
		ctx.ops.undo();
		expect(ctx.elements().map((el) => el.id)).toStrictEqual(['b', 'a']);
		expect(ctx.ops.canUndo()).toBeFalsy();
	});

	it('does nothing for a single shape', () => {
		const ctx = setup([rect('a', 0, '#ff0000')], {
			selectedElementId: 'a',
			selectedElementIds: ['a'],
		});
		ctx.merge.mergeShapes('union');
		expect(ctx.elements().map((el) => el.id)).toStrictEqual(['a']);
		expect(ctx.ops.canUndo()).toBeFalsy();
	});
});

describe('createCropActions', () => {
	const selectPic = { selectedElementId: 'pic', selectedElementIds: ['pic'] };

	it('enters crop mode only for a single selected picture', () => {
		const ctx = setup([picture(), rect('a', 0, '#f00')], {
			selectedElementId: 'a',
			selectedElementIds: ['a'],
		});
		ctx.crop.enterCropMode();
		expect(ctx.store.get().cropSession).toBeNull();
		ctx.store.set(selectPic);
		ctx.crop.toggleCropMode();
		expect(ctx.store.get().cropSession?.elementId).toBe('pic');
	});

	it('cancel restores the picture and leaves no undo step', () => {
		const ctx = setup([picture()], selectPic);
		ctx.crop.enterCropMode();
		ctx.crop.previewCrop({
			x: 120,
			y: 100,
			width: 180,
			height: 100,
			cropLeft: 0.1,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		expect(insets(ctx.pic()).cropLeft).toBeCloseTo(0.1);
		ctx.crop.cancelCropMode();
		expect(ctx.pic().x).toBe(100);
		expect(insets(ctx.pic()).cropLeft).toBe(0);
		expect(ctx.store.get().cropSession).toBeNull();
		expect(ctx.ops.canUndo()).toBeFalsy();
	});

	it('commit leaves exactly one undo step that restores the pre-crop picture', () => {
		const ctx = setup([picture()], selectPic);
		ctx.crop.enterCropMode();
		for (const left of [0.05, 0.1, 0.2]) {
			ctx.crop.previewCrop({
				x: 100 + 200 * left,
				y: 100,
				width: 200 * (1 - left),
				height: 100,
				cropLeft: left,
				cropTop: 0,
				cropRight: 0,
				cropBottom: 0,
			});
		}
		ctx.crop.toggleCropMode();
		expect(ctx.store.get().cropSession).toBeNull();
		expect(insets(ctx.pic()).cropLeft).toBeCloseTo(0.2);
		ctx.ops.undo();
		expect(insets(ctx.pic()).cropLeft).toBe(0);
		expect(ctx.pic().x).toBe(100);
		expect(ctx.ops.canUndo()).toBeFalsy();
		ctx.ops.redo();
		expect(insets(ctx.pic()).cropLeft).toBeCloseTo(0.2);
	});

	it('an unchanged commit records nothing', () => {
		const ctx = setup([picture()], selectPic);
		ctx.crop.enterCropMode();
		ctx.crop.commitCropMode();
		expect(ctx.ops.canUndo()).toBeFalsy();
	});

	it('aspect / Fill / Fit outside crop mode are one undoable update each', () => {
		const ctx = setup([picture()], selectPic);
		ctx.crop.cropToAspect(1, 1);
		expect(ctx.pic().width).toBeCloseTo(ctx.pic().height);
		ctx.ops.undo();
		expect(ctx.pic().width).toBe(200);
		expect(ctx.ops.canUndo()).toBeFalsy();
		ctx.crop.cropFit();
		expect(ctx.ops.canUndo()).toBeTruthy();
	});
});
