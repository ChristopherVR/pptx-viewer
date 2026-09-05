import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createSvelteAiBridge } from './ai-bridge';
import type { SvelteAiBridgeDeps } from './ai-bridge';

function textSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{
				id: 'e1',
				type: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				text: 'Old',
				textSegments: [{ text: 'Old', style: {} }],
			},
		],
	} as unknown as PptxSlide;
}

function makeDeps(overrides: Partial<SvelteAiBridgeDeps> = {}): SvelteAiBridgeDeps & {
	commitSlides: ReturnType<typeof vi.fn>;
} {
	const slides = [textSlide()];
	const commitSlides = vi.fn();
	return {
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getCanvasSize: () => ({ width: 960, height: 540 }),
		getTheme: () => undefined as PptxTheme | undefined,
		getHandler: () => null as PptxHandler | null,
		getFileName: () => undefined,
		goToSlide: vi.fn(),
		selectElements: vi.fn(),
		commitSlides,
		applyTheme: vi.fn(),
		getSections: () => [],
		getPresentationProperties: () => ({}),
		getCoreProperties: () => undefined,
		getAppProperties: () => undefined,
		getCustomProperties: () => [],
		getViewProperties: () => undefined,
		getTableStyleMap: () => undefined,
		getTableStylesDefaultId: () => undefined,
		getTagCollections: () => [],
		setCanvasSize: vi.fn(),
		setSections: vi.fn(),
		setPresentationProperties: vi.fn(),
		setDocumentProperties: vi.fn(),
		setViewProperties: vi.fn(),
		setTableStyleMap: vi.fn(),
		setTableStylesDefaultId: vi.fn(),
		setTagCollections: vi.fn(),
		...overrides,
	};
}

describe('createSvelteAiBridge', () => {
	it('routes a slides update through commitSlides as a single entry', () => {
		const deps = makeDeps();
		const bridge = createSvelteAiBridge(deps);

		bridge.applySlidesUpdate((slides) => {
			slides[0].slideNumber = 9;
			return slides;
		}, 'Renumber');

		expect(deps.commitSlides).toHaveBeenCalledOnce();
		const [next, label] = deps.commitSlides.mock.calls[0];
		expect(label).toBe('Renumber');
		expect((next as PptxSlide[])[0].slideNumber).toBe(9);
		// The original array is not mutated (the updater runs on a clone).
		expect(deps.getSlides()[0].slideNumber).toBe(1);
	});

	it('applies element field updates via the shared helper as one commit', () => {
		const deps = makeDeps();
		const bridge = createSvelteAiBridge(deps);

		bridge.updateElement(0, 'e1', { text: 'New', bold: true });

		expect(deps.commitSlides).toHaveBeenCalledOnce();
		const [next] = deps.commitSlides.mock.calls[0];
		const el = (next as PptxSlide[])[0].elements[0] as unknown as {
			text: string;
			textStyle?: { bold?: boolean };
		};
		expect(el.text).toBe('New');
		expect(el.textStyle?.bold).toBeTruthy();
	});

	it('exposes deck metadata and passes the handler through', () => {
		const handler = { id: 'h' } as unknown as PptxHandler;
		const deps = makeDeps({ getHandler: () => handler, getFileName: () => 'Deck.pptx' });
		const bridge = createSvelteAiBridge(deps);

		const meta = bridge.getDeckMeta();
		expect(meta.slideCount).toBe(1);
		expect(meta.title).toBe('Deck.pptx');
		expect(meta.width).toBe(960);
		expect(bridge.getHandler()).toBe(handler);
	});

	it('navigates before selecting elements on another slide', () => {
		const goToSlide = vi.fn();
		const selectElements = vi.fn();
		const bridge = createSvelteAiBridge(makeDeps({ goToSlide, selectElements }));

		bridge.selectElements(2, ['e1']);
		expect(selectElements).toHaveBeenCalledWith(2, ['e1']);
	});

	it('reconstructs the deck PptxData from live editor + loader state', () => {
		const deps = makeDeps({
			getCanvasSize: () => ({ width: 1280, height: 720 }),
			getSections: () => [{ id: 'sec1', name: 'Intro', slideIds: ['s1'] }],
			getPresentationProperties: () => ({ showWithAnimation: true }),
			getCoreProperties: () => ({ title: 'My Deck' }),
		});
		const bridge = createSvelteAiBridge(deps);

		const data = bridge.getDeckData?.();
		expect(data?.width).toBe(1280);
		expect(data?.height).toBe(720);
		expect(data?.sections?.[0]?.name).toBe('Intro');
		expect(data?.presentationProperties?.showWithAnimation).toBeTruthy();
		expect(data?.coreProperties?.title).toBe('My Deck');
	});

	it('fans changed deck fields through their editor setters, skipping unchanged', () => {
		const setCanvasSize = vi.fn();
		const setSections = vi.fn();
		const setPresentationProperties = vi.fn();
		const setDocumentProperties = vi.fn();
		const deps = makeDeps({
			setCanvasSize,
			setSections,
			setPresentationProperties,
			setDocumentProperties,
		});
		const bridge = createSvelteAiBridge(deps);

		bridge.applyDeckData?.((data) => {
			data.width = 1024;
			data.height = 768;
			data.coreProperties = { title: 'Renamed' };
			return data;
		}, 'Resize + retitle');

		expect(setCanvasSize).toHaveBeenCalledWith({ width: 1024, height: 768 });
		expect(setDocumentProperties).toHaveBeenCalledOnce();
		const [core] = setDocumentProperties.mock.calls[0];
		expect((core as { title?: string }).title).toBe('Renamed');
		// Sections and presentation properties were untouched, so their setters idle.
		expect(setSections).not.toHaveBeenCalled();
		expect(setPresentationProperties).not.toHaveBeenCalled();
		// Slides did not change either, so no history commit.
		expect(deps.commitSlides).not.toHaveBeenCalled();
	});

	// viewProperties/tableStyleMap/tableStylesDefaultId/tags were missing from
	// this seam entirely: the main Save/Export path (`saveEditorDocument`)
	// persists them, but an MCP deck tool operating on
	// `getDeckData()`/`applyDeckData()` could not see or commit them.
	it('getDeckData exposes viewProperties/tableStyleMap/tableStylesDefaultId/tags', () => {
		const deps = makeDeps({
			getViewProperties: () => ({ showComments: true }),
			getTableStyleMap: () => ({ '{guid}': { styleId: '{guid}', styleName: 'Style' } }),
			getTableStylesDefaultId: () => '{guid}',
			getTagCollections: () => [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] }],
		});
		const bridge = createSvelteAiBridge(deps);

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

	it('applyDeckData commits a changed viewProperties/tableStyleMap/tags to their setters', () => {
		const setViewProperties = vi.fn();
		const setTableStyleMap = vi.fn();
		const setTagCollections = vi.fn();
		const deps = makeDeps({ setViewProperties, setTableStyleMap, setTagCollections });
		const bridge = createSvelteAiBridge(deps);

		bridge.applyDeckData?.((data) => {
			data.viewProperties = { showComments: false };
			data.tableStyleMap = { '{new}': { styleId: '{new}', styleName: 'New' } };
			data.tags = [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] }];
			return data;
		}, 'metadata');

		expect(setViewProperties).toHaveBeenCalledWith({ showComments: false });
		expect(setTableStyleMap).toHaveBeenCalledWith({
			'{new}': { styleId: '{new}', styleName: 'New' },
		});
		expect(setTagCollections).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] },
		]);
	});
});
