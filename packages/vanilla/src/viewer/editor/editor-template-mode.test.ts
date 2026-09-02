import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { createEditActions } from './editor-edit-ops';
import { createEditorOps } from './editor-operations';

const shape = (id: string, x: number): PptxElement =>
	({ id, type: 'shape', shapeType: 'rect', x, y: 0, width: 10, height: 10 }) as PptxElement;
const slide = (): PptxSlide =>
	({ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [shape('shape-1', 5)] }) as PptxSlide;

describe('vanilla template editing', () => {
	it('edits inherited geometry, restores it through history, and merges it for save', async () => {
		const save = vi.fn(async (_slides: PptxSlide[]) => new Uint8Array([1]));
		const store = createStore({
			...createInitialViewerState(),
			slides: [slide()],
			templateElementsBySlideId: { 'slide-1': [shape('layout-title', 10)] },
			editable: true,
			editTemplateMode: true,
			selectedElementId: 'layout-title',
			selectedElementIds: ['layout-title'],
		});
		const ops = createEditorOps({
			store,
			getHandler: () => ({ save }) as unknown as PptxHandler,
			onHistoryChange: vi.fn(),
		});

		ops.pushHistory();
		ops.patchGeometry('layout-title', {
			x: 42,
			y: 1,
			width: 10,
			height: 10,
			rotation: 0,
		});
		ops.commitChange();
		expect(store.get().templateElementsBySlideId['slide-1'][0].x).toBe(42);
		expect(store.get().slides[0].elements[0].x).toBe(5);

		await ops.save();
		const savedSlides = save.mock.calls[0][0] as PptxSlide[];
		expect(savedSlides[0].elements.map(({ id }) => id)).toStrictEqual(['layout-title', 'shape-1']);
		expect(savedSlides[0].elements[0].x).toBe(42);

		ops.undo();
		expect(store.get().templateElementsBySlideId['slide-1'][0].x).toBe(10);
	});

	it('groups a shift-style multi-selection in the active layer', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [{ ...slide(), elements: [shape('shape-1', 0), shape('shape-2', 20)] }],
			editable: true,
			selectedElementId: 'shape-2',
			selectedElementIds: ['shape-1', 'shape-2'],
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

		actions.groupSelected();

		expect(store.get().slides[0].elements).toHaveLength(1);
		expect(store.get().slides[0].elements[0].type).toBe('group');
		expect(store.get().selectedElementIds).toStrictEqual([store.get().selectedElementId]);
	});

	it('edits a dedicated master canvas and saves master data', async () => {
		const save = vi.fn(async (_slides: PptxSlide[], _options?: unknown) => new Uint8Array([1]));
		const store = createStore({
			...createInitialViewerState(),
			slides: [slide()],
			slideMasters: [
				{
					path: 'ppt/slideMasters/slideMaster1.xml',
					elements: [shape('master-title', 4)],
					layouts: [
						{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [shape('layout-body', 8)] },
					],
				},
			],
			masterViewTarget: { masterIndex: 0, layoutIndex: 0 },
			editable: true,
			editTemplateMode: true,
			selectedElementId: 'layout-body',
			selectedElementIds: ['layout-body'],
		});
		const ops = createEditorOps({
			store,
			getHandler: () => ({ save }) as unknown as PptxHandler,
			onHistoryChange: vi.fn(),
		});

		ops.pushHistory();
		ops.patchGeometry('layout-body', { x: 88, y: 0, width: 10, height: 10, rotation: 0 });
		ops.commitChange();
		expect(store.get().slideMasters[0].layouts?.[0].elements?.[0].x).toBe(88);

		await ops.save();
		expect(save.mock.calls[0][1]).toMatchObject({ slideMasters: store.get().slideMasters });
		ops.undo();
		expect(store.get().slideMasters[0].layouts?.[0].elements?.[0].x).toBe(8);
	});
});
