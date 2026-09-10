import type { PptxSlide } from 'pptx-viewer-core';
import {
	rasterizeElement,
	rasterizeElementTiledToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createElementRendererRegistry } from '../render';
import { createDefaultRegistry } from '../render/elements';
import { createInitialViewerState, createStore } from '../state';
import { createRasterizeSlide } from './rasterize-slide';

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));

// `rasterizeSlide`/`rasterizeSlideToRaster`/`rasterizeSlideToTiles` now
// delegate to the shared `rasterizeElement`/`rasterizeElementTiledToCanvas`/
// `rasterizeElementTiles`, whose real `foreignObject` strategy loads an
// `Image` from a `blob:` URL - unimplemented in jsdom, so `img.onload`/
// `onerror` never fire and the real functions hang forever in this
// environment. These tests are about the off-screen stage mount/wait logic,
// not raster-strategy selection (that is covered by the `*.test.ts` files
// next to each function in `pptx-viewer-shared`), so all three short-circuit
// straight to the same `html2canvasFallback` callback `rasterize-slide.ts`
// passes in, exercising the exact same `renderToCanvas` call the pre-existing
// assertions check.
interface FakeHtml2CanvasFallbackOptions {
	scale?: number;
	html2canvasFallback: (
		sourceRect: { x: number; y: number; width: number; height: number },
		outputSize: { width: number; height: number },
	) => Promise<HTMLCanvasElement>;
}

async function viaHtml2CanvasFallback(
	naturalWidth: number,
	naturalHeight: number,
	options: FakeHtml2CanvasFallbackOptions,
): Promise<HTMLCanvasElement> {
	const scale = options.scale ?? 1;
	return options.html2canvasFallback(
		{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
		{ width: naturalWidth * scale, height: naturalHeight * scale },
	);
}

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		rasterizeElement: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FakeHtml2CanvasFallbackOptions,
			) => {
				const canvas = await viaHtml2CanvasFallback(naturalWidth, naturalHeight, options);
				return {
					kind: 'canvas' as const,
					canvas,
					strategy: 'html2canvas' as const,
					width: canvas.width,
					height: canvas.height,
				};
			},
		),
		rasterizeElementTiledToCanvas: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FakeHtml2CanvasFallbackOptions,
			) => {
				const canvas = await viaHtml2CanvasFallback(naturalWidth, naturalHeight, options);
				return {
					kind: 'canvas' as const,
					canvas,
					strategy: 'html2canvas' as const,
					width: canvas.width,
					height: canvas.height,
					tiled: false,
				};
			},
		),
		rasterizeElementTiles: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FakeHtml2CanvasFallbackOptions,
			) => {
				const canvas = await viaHtml2CanvasFallback(naturalWidth, naturalHeight, options);
				return {
					fullWidth: canvas.width,
					fullHeight: canvas.height,
					tiled: false,
					tiles: [
						{
							col: 0,
							row: 0,
							x: 0,
							y: 0,
							width: canvas.width,
							height: canvas.height,
							canvas,
							strategy: 'html2canvas' as const,
						},
					],
				};
			},
		),
	};
});

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

function slide(): PptxSlide {
	return { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] };
}

function makeContainer(): HTMLElement {
	const container = document.createElement('div');
	document.body.appendChild(container);
	return container;
}

describe('createRasterizeSlide', () => {
	afterEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it('mounts a hidden off-screen stage host into the container', () => {
		const container = makeContainer();
		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store: createStore(createInitialViewerState()),
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const host = container.querySelector<HTMLElement>('.pptxv-export-stage');
		expect(host).toBeTruthy();
		expect(host?.getAttribute('aria-hidden')).toBe('true');
		expect(host?.style.left).toBe('-99999px');

		ctl.destroy();
		expect(container.querySelector('.pptxv-export-stage')).toBeNull();
	});

	it('renders the requested slide into the stage and rasterises it', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const canvas = await ctl.rasterizeSlide(0);
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(renderToCanvas).toHaveBeenCalledOnce();

		const [stageEl, options] = renderToCanvas.mock.calls[0] as [
			HTMLElement,
			Record<string, unknown>,
		];
		expect(stageEl.classList.contains('pptxv-stage')).toBeTruthy();
		expect(options).toMatchObject({
			backgroundColor: '#ffffff',
			scale: 2,
			width: 960,
			height: 540,
		});

		ctl.destroy();
	});

	it('rejects for an out-of-range slide index without capturing anything', async () => {
		const container = makeContainer();
		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store: createStore(createInitialViewerState()),
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await expect(ctl.rasterizeSlide(0)).rejects.toThrow(/no slide at index 0/);
		expect(renderToCanvas).not.toHaveBeenCalled();
		ctl.destroy();
	});

	// The capture stage renders outside the live render controller, so it has to
	// build its own field context; without it an exported PNG/PDF printed the
	// authored "Slide #" placeholder while the screen showed "Slide 1".
	it('substitutes field runs on the capture stage from the store state', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({
			slides: [
				{
					...slide(),
					slideNumber: 2,
					elements: [
						{
							id: 'f1',
							type: 'text',
							x: 0,
							y: 0,
							width: 200,
							height: 40,
							textSegments: [{ text: 'Slide #', style: {}, fieldType: 'slidenum' }],
						},
						{
							id: 'f2',
							type: 'text',
							x: 0,
							y: 60,
							width: 200,
							height: 40,
							textSegments: [{ text: '<title>', style: {}, fieldType: 'slidetitle' }],
						},
						{
							id: 't1',
							type: 'text',
							x: 0,
							y: 120,
							width: 200,
							height: 40,
							text: 'Results',
							placeholderType: 'title',
						},
					],
				} as unknown as PptxSlide,
			],
			canvasSize: { width: 960, height: 540 },
			headerFooter: { footerText: 'Confidential' },
		});

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			// The real renderers (not the bare registry the other cases use): this
			// case asserts on rendered text, so the text renderer must be present.
			registry: createDefaultRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		const [stageEl] = renderToCanvas.mock.calls[0] as [HTMLElement];
		expect(stageEl.textContent).toContain('2');
		expect(stageEl.textContent).not.toContain('Slide #');
		expect(stageEl.textContent).toContain('Results');
		expect(stageEl.textContent).not.toContain('<title>');

		ctl.destroy();
	});

	it('replaces the stage contents on each call (only the latest slide is mounted)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({
			slides: [slide(), { ...slide(), id: 's2', slideNumber: 2 }],
			canvasSize: { width: 960, height: 540 },
		});

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		await ctl.rasterizeSlide(1);

		const host = container.querySelector('.pptxv-export-stage');
		expect(host?.children).toHaveLength(1);
		ctl.destroy();
	});

	it('rasterizeSlideToRaster delegates to the shared rasterizeElement', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const result = await ctl.rasterizeSlideToRaster(0);
		expect(result.kind).toBe('canvas');
		expect(vi.mocked(rasterizeElement)).toHaveBeenCalledOnce();
		expect(vi.mocked(rasterizeElementTiledToCanvas)).not.toHaveBeenCalled();
		expect(vi.mocked(rasterizeElementTiles)).not.toHaveBeenCalled();
		const [, naturalWidth, naturalHeight, , options] = vi.mocked(rasterizeElement).mock.calls[0];
		expect(naturalWidth).toBe(960);
		expect(naturalHeight).toBe(540);
		expect(options).toMatchObject({ scale: 2, backgroundColor: '#ffffff' });

		ctl.destroy();
	});

	it('rasterizeSlideToTiles delegates to the shared rasterizeElementTiles', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const result = await ctl.rasterizeSlideToTiles(0);
		expect(result.tiles).toHaveLength(1);
		expect(vi.mocked(rasterizeElementTiles)).toHaveBeenCalledOnce();
		expect(vi.mocked(rasterizeElement)).not.toHaveBeenCalled();
		expect(vi.mocked(rasterizeElementTiledToCanvas)).not.toHaveBeenCalled();

		ctl.destroy();
	});

	it('rasterizeSlide (single-canvas) delegates to the shared rasterizeElementTiledToCanvas', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		expect(vi.mocked(rasterizeElementTiledToCanvas)).toHaveBeenCalledOnce();
		expect(vi.mocked(rasterizeElement)).not.toHaveBeenCalled();
		expect(vi.mocked(rasterizeElementTiles)).not.toHaveBeenCalled();

		ctl.destroy();
	});

	it('applies scaleMultiplier on top of the baseline 2x * image-resolution-scale for every capture variant', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1.5,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0, 2);
		const [, , , , tiledOptions] = vi.mocked(rasterizeElementTiledToCanvas).mock.calls[0];
		// 2 (baseline) * 1.5 (image-resolution-scale) * 2 (scaleMultiplier) = 6
		expect(tiledOptions).toMatchObject({ scale: 6 });

		ctl.destroy();
	});
});
