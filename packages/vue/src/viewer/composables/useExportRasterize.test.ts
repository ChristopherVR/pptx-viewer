// oxlint-disable react-hooks/rules-of-hooks
/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { CanvasSize } from '../types';
import { useExportRasterize } from './useExportRasterize';

interface FakeCallOptions {
	scale?: number;
	html2canvasFallback: (
		sourceRect: { x: number; y: number; width: number; height: number },
		outputSize: { width: number; height: number },
	) => Promise<HTMLCanvasElement>;
}

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

// `rasterizeSlide`/`rasterizeSlideToRaster`/`rasterizeSlideToTiles` delegate to
// the shared `rasterizeElement`/`rasterizeElementClampedToCanvas`/
// `rasterizeElementTiles`, whose real `foreignObject` strategy loads an
// `Image` from a `blob:` URL, unimplemented in happy-dom. These tests assert
// which shared function each `rasterizeSlide*` entry point calls (the whole
// point of this composable), not the raster strategy itself (covered next to
// each function in `pptx-viewer-shared`), so every mock short-circuits
// straight to the injected `html2canvasFallback`.
const { rasterizeElement, rasterizeElementClampedToCanvas, rasterizeElementTiles } = vi.hoisted(
	() => ({
		rasterizeElement: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FakeCallOptions,
			) => {
				const canvas = await options.html2canvasFallback(
					{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
					{
						width: naturalWidth * (options.scale ?? 1),
						height: naturalHeight * (options.scale ?? 1),
					},
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
		rasterizeElementClampedToCanvas: vi.fn(
			async (
				_element: HTMLElement,
				naturalWidth: number,
				naturalHeight: number,
				_doc: Document,
				options: FakeCallOptions,
			) => {
				const canvas = await options.html2canvasFallback(
					{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
					{
						width: naturalWidth * (options.scale ?? 1),
						height: naturalHeight * (options.scale ?? 1),
					},
				);
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
				options: FakeCallOptions,
			) => {
				const canvas = await options.html2canvasFallback(
					{ x: 0, y: 0, width: naturalWidth, height: naturalHeight },
					{
						width: naturalWidth * (options.scale ?? 1),
						height: naturalHeight * (options.scale ?? 1),
					},
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
	}),
);

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, rasterizeElement, rasterizeElementClampedToCanvas, rasterizeElementTiles };
});

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('../../lib/canvas-export'), () => ({ renderToCanvas }));

function makeStage(): HTMLElement {
	const host = document.createElement('div'),
		stage = document.createElement('div');
	stage.className = 'pptx-vue-stage';
	host.appendChild(stage);
	return host;
}

function setup() {
	const exportStageRef = ref<HTMLElement | null>(makeStage()),
		exportIndex = ref(0),
		canvasSize = ref<CanvasSize>({ width: 960, height: 540 });
	return {
		exportStageRef,
		exportIndex,
		canvasSize,
		...useExportRasterize({ exportStageRef, exportIndex, canvasSize }),
	};
}

describe('useExportRasterize', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('rasterizeSlide (used by GIF/video/notes-PDF/print) calls the shared clamped single-canvas fidelity path, not the tiled or stitched paths', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const { rasterizeSlide } = setup(),
			canvas = await rasterizeSlide(0);

		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(rasterizeElementClampedToCanvas).toHaveBeenCalledOnce();
		expect(rasterizeElement).not.toHaveBeenCalled();
		expect(rasterizeElementTiles).not.toHaveBeenCalled();

		const [, naturalWidth, naturalHeight, , options] = rasterizeElementClampedToCanvas.mock
			.calls[0] as [HTMLElement, number, number, Document, { scale?: number }];
		expect(naturalWidth).toBe(960);
		expect(naturalHeight).toBe(540);
		expect(options.scale).toBe(2); // baseline 2x, no Options scale / multiplier configured
	});

	it('rasterizeSlideToRaster (PNG export) calls the tiled-and-stitched rasterizeElement path', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const { rasterizeSlideToRaster } = setup();
		await rasterizeSlideToRaster(0);

		expect(rasterizeElement).toHaveBeenCalledOnce();
		expect(rasterizeElementClampedToCanvas).not.toHaveBeenCalled();
		expect(rasterizeElementTiles).not.toHaveBeenCalled();
	});

	it('rasterizeSlideToTiles (PDF export) calls the never-stitched per-tile path', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const { rasterizeSlideToTiles } = setup();
		await rasterizeSlideToTiles(0);

		expect(rasterizeElementTiles).toHaveBeenCalledOnce();
		expect(rasterizeElement).not.toHaveBeenCalled();
		expect(rasterizeElementClampedToCanvas).not.toHaveBeenCalled();
	});

	it('applies imageExportScale and an explicit scaleMultiplier on top of the 2x baseline', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const exportStageRef = ref<HTMLElement | null>(makeStage()),
			exportIndex = ref(0),
			canvasSize = ref<CanvasSize>({ width: 960, height: 540 }),
			{ rasterizeSlide } = useExportRasterize({
				exportStageRef,
				exportIndex,
				canvasSize,
				imageExportScale: () => 1.5,
			});

		await rasterizeSlide(0, 2);

		const [, , , , options] = rasterizeElementClampedToCanvas.mock.calls.at(-1) as [
			HTMLElement,
			number,
			number,
			Document,
			{ scale?: number },
		];
		expect(options.scale).toBeCloseTo(2 * 1.5 * 2);
	});

	it('maps the shared driver sourceRect/outputSize onto the html2canvas-pro fallback window (x/y/width/height + derived scale)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const { rasterizeSlide, exportStageRef } = setup();
		await rasterizeSlide(0);

		const stageEl = exportStageRef.value?.querySelector('.pptx-vue-stage');
		expect(renderToCanvas).toHaveBeenCalledExactlyOnceWith(
			stageEl,
			expect.objectContaining({
				backgroundColor: '#ffffff',
				x: 0,
				y: 0,
				width: 960,
				height: 540,
				// outputSize.width (960 * 2) / sourceRect.width (960)
				scale: 2,
				logging: false,
			}),
		);
	});

	it('throws when the off-screen stage element is not present', async () => {
		const exportStageRef = ref<HTMLElement | null>(document.createElement('div')),
			exportIndex = ref(0),
			canvasSize = ref<CanvasSize>({ width: 960, height: 540 }),
			{ rasterizeSlide } = useExportRasterize({ exportStageRef, exportIndex, canvasSize });

		await expect(rasterizeSlide(0)).rejects.toThrow(/export stage not ready/i);
	});
});
