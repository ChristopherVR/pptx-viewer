import type { PptxSlide } from 'pptx-viewer-core';
import {
	rasterizeElement,
	rasterizeElementClampedToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n/translator';
import { createExportWiring } from './export-wiring.svelte';
import { createExportingApi } from './exporting-api';

/**
 * `.svelte.test.ts` because `createExportWiring` returns an `ExportController`
 * (`.svelte.ts`, `$state`-backed). Covers the lazy off-screen stage creation
 * (falls back to `document.body` before the viewer root mounts), that
 * `createExportingApi` binds through to the live controller, and that the
 * wiring forwards all three capture variants of `rasterize-slide.ts` into the
 * controller (PNG -> full raster, PDF -> tiles, never the clamped fallback).
 */

const { renderToCanvas, addImage, addPage, save } = vi.hoisted(() => ({
	renderToCanvas: vi.fn(),
	addImage: vi.fn(),
	addPage: vi.fn(),
	save: vi.fn(),
}));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));
vi.mock(import('jspdf'), () => {
	class MockJsPDF {
		addImage = addImage;
		addPage = addPage;
		save = save;
	}
	// The real `jsPDF` class carries static `API`/`version` members the mock
	// doesn't need; cast past `Partial<typeof import('jspdf')>` instead.
	return { jsPDF: MockJsPDF } as unknown as typeof import('jspdf');
});

type Html2CanvasFallback = (
	sourceRect: { x: number; y: number; width: number; height: number },
	outputSize: { width: number; height: number },
) => Promise<HTMLCanvasElement>;

interface FallbackOptions {
	scale?: number;
	html2canvasFallback: Html2CanvasFallback;
}

// See `rasterize-slide.test.ts` for why: the real `rasterizeElement*` entry
// points' `foreignObject` strategy hangs forever in jsdom (no `Image`
// decode), so all three are short-circuited straight to the injected
// `html2canvasFallback` here too. Each stub is a `vi.fn` so a test can
// assert WHICH variant a given export path reached.
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	async function viaFallback(
		naturalWidth: number,
		naturalHeight: number,
		options: FallbackOptions,
	): Promise<HTMLCanvasElement> {
		const scale = options.scale ?? 1;
		return options.html2canvasFallback(
			{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
			{ width: naturalWidth * scale, height: naturalHeight * scale },
		);
	}
	return {
		...actual,
		rasterizeElement: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FallbackOptions,
			) => {
				const canvas = await viaFallback(naturalWidth, naturalHeight, options);
				return {
					kind: 'canvas' as const,
					canvas,
					strategy: 'html2canvas' as const,
					width: canvas.width,
					height: canvas.height,
				};
			},
		),
		rasterizeElementClampedToCanvas: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FallbackOptions,
			) => {
				const canvas = await viaFallback(naturalWidth, naturalHeight, options);
				return {
					kind: 'canvas' as const,
					canvas,
					strategy: 'html2canvas' as const,
					width: canvas.width,
					height: canvas.height,
					clamped: false,
					effectiveScale: options.scale ?? 1,
				};
			},
		),
		rasterizeElementTiles: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FallbackOptions,
			) => {
				const canvas = await viaFallback(naturalWidth, naturalHeight, options);
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

function slide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

describe('createExportWiring', () => {
	afterEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it('falls back to document.body when the container getter returns undefined', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const wiring = createExportWiring({
			getContainer: () => undefined,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getCurrent: () => 0,
			getTranslator: () => createTranslator(() => 'en'),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
		});

		await wiring.controller.exportSlidePng(0);
		expect(document.body.querySelector('.pptx-svelte-export-stage')).toBeTruthy();

		wiring.destroy();
		expect(document.body.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});

	it('exposes exportSlidePng/exportPdf via createExportingApi bound to the live controller', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const wiring = createExportWiring({
			getContainer: () => undefined,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getCurrent: () => 0,
			getTranslator: () => createTranslator(() => 'en'),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
		});
		const api = createExportingApi(wiring.controller);

		const spy = vi.spyOn(wiring.controller, 'exportSlidePng');
		await api.exportSlidePng(0);
		expect(spy).toHaveBeenCalledWith(0);

		wiring.destroy();
	});

	it('forwards the full-raster and tiled capture variants into the controller', async () => {
		// Regression guard for the two forwarding lines in `createExportWiring`:
		// without `rasterizeSlideToRaster`/`rasterizeSlideToTiles` the controller
		// silently falls back to wrapping the clamped single-canvas capture, so
		// PNG export could no longer tile beyond the canvas cap and PDF export
		// would embed one downscaled image per page. Assert the shared entry
		// point each path reaches, not just that something was rasterised.
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const wiring = createExportWiring({
			getContainer: () => undefined,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getCurrent: () => 0,
			getTranslator: () => createTranslator(() => 'en'),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
		});

		await wiring.controller.exportSlidePng(0);
		expect(rasterizeElement).toHaveBeenCalledOnce();
		expect(rasterizeElementTiles).not.toHaveBeenCalled();
		expect(rasterizeElementClampedToCanvas).not.toHaveBeenCalled();

		vi.clearAllMocks();
		renderToCanvas.mockResolvedValue(fakeCanvas());

		await wiring.controller.exportPdf();
		expect(rasterizeElementTiles).toHaveBeenCalledOnce();
		expect(rasterizeElement).not.toHaveBeenCalled();
		expect(rasterizeElementClampedToCanvas).not.toHaveBeenCalled();
		expect(addImage).toHaveBeenCalledOnce();
		expect(save).toHaveBeenCalledOnce();

		wiring.destroy();
	});
});
