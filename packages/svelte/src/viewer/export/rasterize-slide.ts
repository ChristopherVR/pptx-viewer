import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CanvasSize,
	RasterizeElementResult,
	RasterizeElementTilesResult,
} from 'pptx-viewer-shared';
import {
	rasterizeElement,
	rasterizeElementTiledToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';
import { mount, unmount } from 'svelte';

import { I18N_CONTEXT_KEY } from '../../i18n/context';
import SlideStage from '../components/SlideStage.svelte';
import { AreaChart3DContextKey } from '../state/area-chart-3d-context';
import { BarChart3DContextKey } from '../state/bar-chart-3d-context';
import { FieldContextKey } from '../state/field-context';
import { LineChart3DContextKey } from '../state/line-chart-3d-context';
import { PieChart3DContextKey } from '../state/pie-chart-3d-context';
import { SmartArt3DContextKey } from '../state/smart-art-3d-context';
import { SurfaceChart3DContextKey } from '../state/surface-chart-3d-context';
import type { RasterizeSlideController, RasterizeSlideDeps } from './rasterize-slide-types';
import { renderToCanvas } from './render-to-canvas';

export type { RasterizeSlideController, RasterizeSlideDeps } from './rasterize-slide-types';

/**
 * Two animation frames: lets the browser lay out and paint the freshly
 * mounted stage (images, fonts, backgrounds) before html2canvas-pro captures
 * it, matching Vue's `nextTick()` + `requestAnimationFrame` in
 * `useExportWiring.rasterizeSlide`.
 *
 * Raced against a timeout because browsers pause `requestAnimationFrame` in
 * hidden/occluded tabs: without the fallback, switching tabs mid-export (very
 * likely during a long GIF/video run) would stall the capture loop forever.
 * html2canvas reads the laid-out DOM directly, so capturing without a fresh
 * paint is safe.
 */
function nextFrame(): Promise<void> {
	const fallback = new Promise<void>((resolve) => {
		setTimeout(resolve, 250);
	});
	const painted = new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
	return Promise.race([fallback, painted]);
}

/**
 * Build the off-screen capture stage used by PNG/PDF export: a hidden host
 * (fixed off-canvas, `aria-hidden`) that mounts one slide at a time via
 * Svelte 5's imperative `mount()` API (the same `mount`/`unmount` pair the
 * component tests use to render outside the normal component tree), then
 * rasterises it with `renderToCanvas`. The mounted `SlideStage` instance is
 * torn down with `unmount()` and replaced on every call, and again in
 * `destroy()`.
 *
 * Svelte port of the vanilla binding's `createRasterizeSlide`
 * (`packages/vanilla/src/viewer/export/rasterize-slide.ts`): vanilla builds
 * the stage DOM directly via the shared `renderSlideStage`; this binding
 * instead mounts the real `SlideStage.svelte` component, seeding the i18n and
 * SmartArt-3D context it reads deep in the element tree (those contexts are
 * otherwise only provided by the live `PowerPointViewer` root).
 */
export function createRasterizeSlide(deps: RasterizeSlideDeps): RasterizeSlideController {
	const host = deps.doc.createElement('div');
	host.className = 'pptx-svelte-export-stage';
	Object.assign(host.style, {
		position: 'fixed',
		left: '-99999px',
		top: '0',
		pointerEvents: 'none',
		opacity: '0',
	});
	host.setAttribute('aria-hidden', 'true');
	deps.container.appendChild(host);
	const waitForFrame = deps.waitForFrame ?? nextFrame;

	let instance: ReturnType<typeof mount> | null = null;

	function unmountCurrent(): void {
		if (instance) {
			unmount(instance);
			instance = null;
		}
		host.replaceChildren();
	}

	/**
	 * Mount slide `index` on the off-screen stage, ready for one of the three
	 * `rasterizeElement*` entry points below. Shared so the stage-mount
	 * mechanics (Svelte's imperative `mount()`, seeding i18n/SmartArt-3D
	 * context) live once.
	 */
	async function mountStage(
		index: number,
	): Promise<{ stageEl: HTMLElement; canvasSize: CanvasSize }> {
		const slide: PptxSlide | undefined = deps.getSlides()[index];
		if (!slide) {
			throw new Error(`Export failed: no slide at index ${index}`);
		}
		unmountCurrent();
		const canvasSize = deps.getCanvasSize();
		instance = mount(SlideStage, {
			target: host,
			props: {
				slide,
				canvasSize,
				mediaDataUrls: deps.getMediaDataUrls(),
				scale: 1,
				presenting: false,
			},
			context: new Map<unknown, unknown>([
				[I18N_CONTEXT_KEY, deps.getTranslator()],
				[SmartArt3DContextKey, () => deps.smartArt3D],
				[SurfaceChart3DContextKey, () => deps.surfaceChart3D],
				[BarChart3DContextKey, () => deps.barChart3D],
				[LineChart3DContextKey, () => deps.lineChart3D],
				[AreaChart3DContextKey, () => deps.areaChart3D],
				[PieChart3DContextKey, () => deps.pieChart3D],
				[FieldContextKey, () => deps.getFieldContext?.()],
			]),
		});
		await waitForFrame();
		const stageEl = host.querySelector<HTMLElement>('.pptx-svelte-stage');
		if (!stageEl) {
			throw new Error('Export failed: stage did not render');
		}
		return { stageEl, canvasSize };
	}

	/** The `html2canvasFallback` every `rasterizeElement*` call below needs. */
	function html2canvasFallback(
		stageEl: HTMLElement,
		sourceRect: { x: number; y: number; width: number; height: number },
		outputSize: { width: number; height: number },
	): Promise<HTMLCanvasElement> {
		return renderToCanvas(stageEl, {
			backgroundColor: '#ffffff',
			scale: outputSize.width / (sourceRect.width || 1),
			x: sourceRect.x,
			y: sourceRect.y,
			width: sourceRect.width,
			height: sourceRect.height,
			logging: false,
		});
	}

	/**
	 * Mount slide `index` and rasterise it via the shared `foreignObject` ->
	 * vector-SVG -> html2canvas fallback chain, always returning the full
	 * `RasterizeElementResult` (tiled `png-bytes` included). Used by the
	 * PNG-export and "copy slide as image" paths so a request whose full
	 * resolution exceeds the browser's canvas cap is tiled and stitched
	 * rather than clamped.
	 */
	async function rasterizeSlideToRaster(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementResult> {
		const { stageEl, canvasSize } = await mountStage(index);
		const scale = 2 * deps.getImageResolutionScale() * scaleMultiplier;

		return rasterizeElement(stageEl, canvasSize.width, canvasSize.height, deps.doc, {
			scale,
			backgroundColor: '#ffffff',
			html2canvasFallback: (sourceRect, outputSize) =>
				html2canvasFallback(stageEl, sourceRect, outputSize),
		});
	}

	/**
	 * Mount slide `index` and rasterise it into its raw per-tile canvases (no
	 * PNG stitching). Used by PDF export, which places each tile itself
	 * (`placeTileOnPage` in `pptx-viewer-shared`) - a PDF page has no
	 * canvas-size limit of its own to escape, so tiles never need stitching.
	 */
	async function rasterizeSlideToTiles(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementTilesResult> {
		const { stageEl, canvasSize } = await mountStage(index);
		const scale = 2 * deps.getImageResolutionScale() * scaleMultiplier;

		return rasterizeElementTiles(stageEl, canvasSize.width, canvasSize.height, deps.doc, {
			scale,
			backgroundColor: '#ffffff',
			html2canvasFallback: (sourceRect, outputSize) =>
				html2canvasFallback(stageEl, sourceRect, outputSize),
		});
	}

	/**
	 * Mount slide `index` and rasterise it to a single full-resolution canvas,
	 * tiling and stitching transparently (never reducing scale) if the
	 * requested resolution would exceed the browser's canvas cap. For every
	 * caller that can only consume one image (notes-PDF/GIF/video/print, all
	 * of which composite or re-encode a canvas per frame): fidelity and
	 * resolution are both preserved via the same `foreignObject` pipeline that
	 * PNG/PDF export use.
	 */
	async function rasterizeSlide(index: number, scaleMultiplier = 1): Promise<HTMLCanvasElement> {
		const { stageEl, canvasSize } = await mountStage(index);
		const scale = 2 * deps.getImageResolutionScale() * scaleMultiplier;

		const result = await rasterizeElementTiledToCanvas(
			stageEl,
			canvasSize.width,
			canvasSize.height,
			deps.doc,
			{
				scale,
				backgroundColor: '#ffffff',
				html2canvasFallback: (sourceRect, outputSize) =>
					html2canvasFallback(stageEl, sourceRect, outputSize),
			},
		);
		return result.canvas;
	}

	return {
		rasterizeSlide,
		rasterizeSlideToRaster,
		rasterizeSlideToTiles,
		destroy() {
			unmountCurrent();
			host.remove();
		},
	};
}
