import type { PptxElement, PptxSection, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorController } from '../editor';
import type { EditActions } from '../editor/editor-edit-ops';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createVanillaAiBridge } from './ai-bridge';

function makeSlide(id: string): PptxSlide {
	return { id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

/**
 * A fake {@link EditorController} that applies the deck writes the bridge uses
 * straight onto a real store (mirroring the live editor semantics) and records
 * which write choke points fired, so the change-detecting fan-out is testable
 * without standing up the full DOM editor.
 */
function fakeEditor(store: Store<ViewerState>) {
	const calls = {
		commitSlides: vi.fn((slides: PptxSlide[]) => store.set({ slides })),
		updateCanvasSize: vi.fn((size: { width: number; height: number }) =>
			store.set({ canvasSize: size }),
		),
		updateSections: vi.fn((sections: PptxSection[]) => store.set({ sections })),
		updatePresentationProperties: vi.fn((value) => store.set({ presentationProperties: value })),
		updateDocumentProperties: vi.fn((core, app, custom) =>
			store.set({ coreProperties: core, appProperties: app, customProperties: custom }),
		),
		updateTableStyleMap: vi.fn((map) => store.set({ tableStyleMap: map })),
		updateTagCollections: vi.fn((tags) => store.set({ tagCollections: tags })),
	};
	const editor = {
		commitSlides: calls.commitSlides,
		selectElements: vi.fn(),
		getEditActions: () =>
			({
				updateCanvasSize: calls.updateCanvasSize,
				updateTableStyleMap: calls.updateTableStyleMap,
				updateTagCollections: calls.updateTagCollections,
			}) as unknown as EditActions,
		updateSections: calls.updateSections,
		updatePresentationProperties: calls.updatePresentationProperties,
		updateDocumentProperties: calls.updateDocumentProperties,
	} as unknown as EditorController;
	return { editor, calls };
}

function setup() {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		slides: [makeSlide('s1'), makeSlide('s2')],
		sections: [{ id: 'sec1', name: 'Intro', slideIds: ['s1'] }] as PptxSection[],
	});
	const { editor, calls } = fakeEditor(store);
	const bridge = createVanillaAiBridge({
		store,
		editor,
		goToSlide: vi.fn(),
		ensureEditable: vi.fn(),
		getHandler: () => null,
		applyThemeUpdates: vi.fn(),
	});
	return { store, bridge, calls };
}

describe('vanilla AI bridge deck seam', () => {
	it('getDeckData reflects the live deck state', () => {
		const { store, bridge } = setup();
		const data = bridge.getDeckData?.();
		expect(data?.slides).toHaveLength(2);
		expect(data?.width).toBe(store.get().canvasSize.width);
		expect(data?.sections).toHaveLength(1);
	});

	it('applyDeckData only fans out the fields that changed', () => {
		const { bridge, calls } = setup();
		bridge.applyDeckData?.((data) => ({ ...data, width: 1600, height: 900 }), 'Resize');
		expect(calls.updateCanvasSize).toHaveBeenCalledWith({ width: 1600, height: 900 });
		expect(calls.commitSlides).not.toHaveBeenCalled();
		expect(calls.updateSections).not.toHaveBeenCalled();
		expect(calls.updatePresentationProperties).not.toHaveBeenCalled();
		expect(calls.updateDocumentProperties).not.toHaveBeenCalled();
	});

	it('applyDeckData routes section edits through the sections op', () => {
		const { store, bridge, calls } = setup();
		bridge.applyDeckData?.(
			(data) => ({
				...data,
				sections: [...(data.sections ?? []), { id: 'sec2', name: 'Body', slideIds: ['s2'] }],
			}),
			'Add section',
		);
		expect(calls.updateSections).toHaveBeenCalledOnce();
		expect(store.get().sections).toHaveLength(2);
		expect(calls.updateCanvasSize).not.toHaveBeenCalled();
	});

	it('applyDeckData commits metadata through the document-properties op', () => {
		const { store, bridge, calls } = setup();
		bridge.applyDeckData?.((data) => ({ ...data, coreProperties: { title: 'Deck' } }), 'Set title');
		expect(calls.updateDocumentProperties).toHaveBeenCalledOnce();
		expect(store.get().coreProperties?.title).toBe('Deck');
	});

	it('updateElement routes through the shared applyElementUpdate: text restyles every run', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [
				{
					id: 's1',
					slideNumber: 1,
					elements: [
						{
							id: 'el-1',
							type: 'text',
							x: 0,
							y: 0,
							width: 100,
							height: 50,
							text: 'Hello world',
							textSegments: [
								{ text: 'Hello ', style: { bold: true } },
								{ text: 'world', style: {} },
							],
						} as unknown as PptxElement,
					],
				} as unknown as PptxSlide,
			],
		});
		const { editor, calls } = fakeEditor(store);
		const bridge = createVanillaAiBridge({
			store,
			editor,
			goToSlide: vi.fn(),
			ensureEditable: vi.fn(),
			getHandler: () => null,
			applyThemeUpdates: vi.fn(),
		});

		bridge.updateElement(0, 'el-1', { fontColor: '#ff0000' });

		expect(calls.commitSlides).toHaveBeenCalledOnce();
		const el = store.get().slides[0]?.elements[0] as unknown as {
			textSegments: { text: string; style: { color?: string; bold?: boolean } }[];
		};
		// Every run gets the new colour (the shared reconcile fix), not just run 0.
		expect(el.textSegments[0]?.style.color).toBe('#ff0000');
		expect(el.textSegments[1]?.style.color).toBe('#ff0000');
		// The pre-existing per-run bold flag survives the merge.
		expect(el.textSegments[0]?.style.bold).toBeTruthy();
	});

	it('updateElement applies a shape-style update via hasShapeProperties, not a raw key check', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [
				{
					id: 's1',
					slideNumber: 1,
					elements: [
						{
							id: 'el-2',
							type: 'shape',
							shapeType: 'rect',
							x: 0,
							y: 0,
							width: 100,
							height: 50,
						} as unknown as PptxElement,
					],
				} as unknown as PptxSlide,
			],
		});
		const { editor, calls } = fakeEditor(store);
		const bridge = createVanillaAiBridge({
			store,
			editor,
			goToSlide: vi.fn(),
			ensureEditable: vi.fn(),
			getHandler: () => null,
			applyThemeUpdates: vi.fn(),
		});

		bridge.updateElement(0, 'el-2', { fillColor: '#00ff00' });

		expect(calls.commitSlides).toHaveBeenCalledOnce();
		const el = store.get().slides[0]?.elements[0] as unknown as {
			shapeStyle?: { fillColor?: string };
		};
		expect(el.shapeStyle?.fillColor).toBe('#00ff00');
	});

	// viewProperties/tableStyleMap/tableStylesDefaultId/tags were missing from
	// this seam entirely: the main Save/Export path (`editor.save`) persists
	// them, but an MCP deck tool operating on `getDeckData()`/`applyDeckData()`
	// could not see or commit them.
	it('getDeckData exposes viewProperties/tableStyleMap/tableStylesDefaultId/tags', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			viewProperties: { showComments: true },
			tableStyleMap: { '{guid}': { styleId: '{guid}', styleName: 'Style' } },
			tableStylesDefaultId: '{guid}',
			tagCollections: [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] }],
		});
		const { editor } = fakeEditor(store);
		const bridge = createVanillaAiBridge({
			store,
			editor,
			goToSlide: vi.fn(),
			ensureEditable: vi.fn(),
			getHandler: () => null,
			applyThemeUpdates: vi.fn(),
		});

		const data = bridge.getDeckData?.();
		expect(data?.viewProperties).toStrictEqual({ showComments: true });
		expect(data?.tableStyleMap).toStrictEqual({
			'{guid}': { styleId: '{guid}', styleName: 'Style' },
		});
		expect(data?.tableStylesDefaultId).toBe('{guid}');
		expect(data?.tags).toStrictEqual([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] },
		]);
	});

	it('applyDeckData commits a changed viewProperties/tableStyleMap/tags', () => {
		const { store, bridge, calls } = setup();

		bridge.applyDeckData?.((data) => {
			data.viewProperties = { showComments: false };
			data.tableStyleMap = { '{new}': { styleId: '{new}', styleName: 'New' } };
			data.tags = [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] }];
			return data;
		}, 'metadata');

		expect(store.get().viewProperties).toStrictEqual({ showComments: false });
		expect(calls.updateTableStyleMap).toHaveBeenCalledWith({
			'{new}': { styleId: '{new}', styleName: 'New' },
		});
		expect(calls.updateTagCollections).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] },
		]);
	});
});
