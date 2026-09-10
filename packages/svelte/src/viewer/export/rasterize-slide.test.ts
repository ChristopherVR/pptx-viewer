import type { PptxSlide } from 'pptx-viewer-core';
import { rasterizeElementTiledToCanvas, rasterizeElementTiles } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n/translator';
import { createRasterizeSlide } from './rasterize-slide';

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));

// `rasterizeSlide`/`rasterizeSlideToRaster`/`rasterizeSlideToTiles` now
// delegate to the shared `rasterizeElement`/`rasterizeElementTiledToCanvas`/
// `rasterizeElementTiles`, whose real `foreignObject` strategy loads an
// `Image` from a `blob:` URL - unimplemented in jsdom, so `img.onload`/
// `onerror` never fire and the real functions hang forever in this
// environment. `rasterizeElementTiledToCanvas`/`rasterizeElementTiles`
// call `rasterizeElement` internally *within the already-built shared
// package*, invisible to mocking only `rasterizeElement` at this module
// boundary, so all three are mocked directly here. These tests are about the
// off-screen stage mount/wait logic, not raster-strategy selection (that is
// covered by `rasterize-element.test.ts` in `pptx-viewer-shared`), so each
// short-circuits straight to the same `html2canvasFallback` callback
// `rasterize-slide.ts` passes in, exercising the exact same `renderToCanvas`
// call the pre-existing assertions check.
type FallbackSourceRect = { x: number; y: number; width: number; height: number };
type FallbackOutputSize = { width: number; height: number };
type Html2CanvasFallback = (
	sourceRect: FallbackSourceRect,
	outputSize: FallbackOutputSize,
) => Promise<HTMLCanvasElement>;

async function callFallback(
	naturalWidth: number,
	naturalHeight: number,
	scale: number | undefined,
	html2canvasFallback: Html2CanvasFallback,
): Promise<HTMLCanvasElement> {
	const s = scale ?? 1;
	return html2canvasFallback(
		{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
		{ width: naturalWidth * s, height: naturalHeight * s },
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
				options: { scale?: number; html2canvasFallback: Html2CanvasFallback },
			) => {
				const canvas = await callFallback(
					naturalWidth,
					naturalHeight,
					options.scale,
					options.html2canvasFallback,
				);
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
				options: { scale?: number; html2canvasFallback: Html2CanvasFallback },
			) => {
				const canvas = await callFallback(
					naturalWidth,
					naturalHeight,
					options.scale,
					options.html2canvasFallback,
				);
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
				options: { scale?: number; html2canvasFallback: Html2CanvasFallback },
			) => {
				const canvas = await callFallback(
					naturalWidth,
					naturalHeight,
					options.scale,
					options.html2canvasFallback,
				);
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

function slide(id: string, slideNumber = 1): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber, elements: [] };
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
			getSlides: () => [],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const host = container.querySelector<HTMLElement>('.pptx-svelte-export-stage');
		expect(host).toBeTruthy();
		expect(host?.getAttribute('aria-hidden')).toBe('true');
		expect(host?.style.left).toBe('-99999px');

		ctl.destroy();
		expect(container.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});

	it('renders the requested slide into the stage and rasterises it', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const canvas = await ctl.rasterizeSlide(0);
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(renderToCanvas).toHaveBeenCalledOnce();
		// `rasterizeSlide` (used by GIF/video/notes-PDF/print) must always go
		// through the tiled/stitched shared `foreignObject` pipeline - never
		// fall back to a raw `renderToCanvas` capture directly.
		expect(rasterizeElementTiledToCanvas).toHaveBeenCalledOnce();
		expect(rasterizeElementTiles).not.toHaveBeenCalled();

		const [stageEl, options] = renderToCanvas.mock.calls[0] as [
			HTMLElement,
			Record<string, unknown>,
		];
		expect(stageEl.classList.contains('pptx-svelte-stage')).toBeTruthy();
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
			getSlides: () => [],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await expect(ctl.rasterizeSlide(0)).rejects.toThrow(/no slide at index 0/);
		expect(renderToCanvas).not.toHaveBeenCalled();
		ctl.destroy();
	});

	it('replaces the stage contents on each call (only the latest slide is mounted)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const slides = [slide('s1', 1), slide('s2', 2)];

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => slides,
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		await ctl.rasterizeSlide(1);

		const host = container.querySelector('.pptx-svelte-export-stage');
		expect(host?.children).toHaveLength(1);
		ctl.destroy();
	});

	it('rasterizeSlideToTiles returns the tile-shaped result (single tile for a normal-size slide)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const result = await ctl.rasterizeSlideToTiles(0);
		expect(result.tiled).toBeFalsy();
		expect(result.tiles).toHaveLength(1);
		expect(result.tiles[0].canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(rasterizeElementTiles).toHaveBeenCalledOnce();
		expect(rasterizeElementTiledToCanvas).not.toHaveBeenCalled();

		ctl.destroy();
	});

	it('destroy() unmounts the last-rendered stage and removes the host', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		expect(container.querySelector('.pptx-svelte-export-stage')?.children).toHaveLength(1);

		ctl.destroy();
		expect(container.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});
});
