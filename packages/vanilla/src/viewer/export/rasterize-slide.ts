import type { PptxSlide } from 'pptx-viewer-core';
import type {
	RasterizeElementResult,
	RasterizeElementTiledCanvasResult,
	RasterizeElementTilesResult,
} from 'pptx-viewer-shared';
import {
	rasterizeElement,
	rasterizeElementTiledToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { ElementRendererRegistry } from '../render';
import { createEl, renderSlideStage } from '../render';
import { buildRenderFieldContext } from '../render-field-context';
import type { Store, ViewerState } from '../state';
import { renderToCanvas } from './render-to-canvas';

export interface RasterizeSlideDeps {
	doc: Document;
	/** Host the off-screen capture stage is appended to; removed on `destroy()`. */
	container: HTMLElement;
	store: Store<ViewerState>;
	registry: ElementRendererRegistry;
	getTranslator(): Translator;
	/**
	 * Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`.
	 * A getter, not a plain boolean, read fresh on every `rasterizeSlide()`
	 * call so a mid-session Options > Advanced > "Disable 3D rendering" toggle
	 * (already ANDed in by the caller, see `resolve3DRenderingFlags`) reaches
	 * the very next export/print without reconstructing this controller.
	 */
	getSmartArt3D(): boolean;
	/**
	 * Opt-in interactive WebGL surface-chart renderer flag; see
	 * `PptxViewerOptions.surfaceChart3D`. Same "read fresh" note as
	 * `getSmartArt3D`.
	 */
	getSurfaceChart3D(): boolean;
	/**
	 * Opt-in interactive WebGL bar3D-chart renderer flag; see
	 * `PptxViewerOptions.barChart3D`. Same "read fresh" note as `getSmartArt3D`.
	 */
	getBarChart3D(): boolean;
	/**
	 * Opt-in interactive WebGL line3D-chart renderer flag; see
	 * `PptxViewerOptions.lineChart3D`. Same "read fresh" note as
	 * `getSmartArt3D`.
	 */
	getLineChart3D(): boolean;
	/**
	 * Opt-in interactive WebGL area3D-chart renderer flag; see
	 * `PptxViewerOptions.areaChart3D`. Same "read fresh" note as
	 * `getSmartArt3D`.
	 */
	getAreaChart3D(): boolean;
	/**
	 * Opt-in interactive WebGL pie3D-chart renderer flag; see
	 * `PptxViewerOptions.pieChart3D`. Same "read fresh" note as `getSmartArt3D`.
	 */
	getPieChart3D(): boolean;
	/**
	 * Options > Advanced > "Default resolution" / "Do not compress images"
	 * raster-scale multiplier (see `resolveImageResolutionScale` in
	 * `pptx-viewer-shared`), applied on top of the baseline capture scale so
	 * the option has real effect without changing the default (highFidelity)
	 * export quality.
	 */
	getImageResolutionScale(): number;
	/**
	 * Overridable frame-wait before capture (test seam: the real
	 * `requestAnimationFrame` double-wait is not worth driving through fake
	 * timers). Defaults to {@link nextFrame}.
	 */
	waitForFrame?: () => Promise<void>;
}

export interface RasterizeSlideController {
	/**
	 * Render slide `index` off-screen at scale 1 and capture it to a single
	 * full-resolution canvas via the shared `rasterizeElementTiledToCanvas`
	 * (foreignObject -> vector-SVG -> html2canvas-pro fallback chain), tiling
	 * and stitching transparently (never reducing scale) if the requested
	 * resolution would exceed the browser's canvas cap. `scaleMultiplier`
	 * (default 1) is an extra factor on top of the baseline 2x * Options >
	 * Advanced > Image Size/Quality scale; the Print dialog's notes/handouts
	 * raster path passes a higher value when Options > Advanced > "High
	 * quality" is on, without changing plain PNG/PDF export.
	 */
	rasterizeSlide(index: number, scaleMultiplier?: number): Promise<HTMLCanvasElement>;
	/**
	 * Same capture as {@link rasterizeSlide}, but returns the full
	 * `RasterizeElementResult` instead of unwrapping to a plain canvas. Used
	 * by the PNG-export and "copy slide as image" paths so a request whose
	 * full resolution exceeds the browser's canvas cap is tiled and stitched
	 * as pre-encoded PNG bytes (`kind: 'png-bytes'`) instead of a canvas
	 * `toBlob`/`toDataURL` call, since no single canvas could hold the full
	 * image.
	 */
	rasterizeSlideToRaster(index: number, scaleMultiplier?: number): Promise<RasterizeElementResult>;
	/**
	 * Same capture, but returns the raw per-tile canvases (no PNG stitching).
	 * Used by PDF export so a page whose resolution exceeds the browser
	 * canvas cap is composed of several small tile images instead of one
	 * oversized or stitched canvas.
	 */
	rasterizeSlideToTiles(
		index: number,
		scaleMultiplier?: number,
	): Promise<RasterizeElementTilesResult>;
	/** Remove the off-screen capture stage from the DOM. */
	destroy(): void;
}

/**
 * Two animation frames: lets the browser lay out and paint the freshly
 * mounted stage (images, fonts, backgrounds) before the shared rasteriser
 * captures it, matching Vue's `nextTick()` + `requestAnimationFrame` in
 * `useExportWiring.rasterizeSlide`.
 */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

/**
 * Build the off-screen capture stage used by PNG/PDF export: a hidden host
 * (fixed off-canvas, `aria-hidden`) that renders one slide at a time at scale
 * 1 via the shared `renderSlideStage`, then rasterises it through the shared
 * `rasterizeElement` / `rasterizeElementTiles` /
 * `rasterizeElementTiledToCanvas` entry points; `renderToCanvas`
 * (html2canvas-pro) is only ever the last-resort `html2canvasFallback` driver
 * handed to them. Vanilla port of Vue's `useExportWiring.rasterizeSlide`
 * (`packages/vue/src/viewer/composables/useExportWiring.ts`): Vue re-renders
 * an off-screen `<SlideStage>` behind a template ref; the vanilla binding
 * owns the DOM directly, so this builds and re-populates one host element for
 * the life of the controller instead.
 */
export function createRasterizeSlide(deps: RasterizeSlideDeps): RasterizeSlideController {
	const host = createEl(deps.doc, 'div', 'pptxv-export-stage', {
		position: 'fixed',
		left: '-99999px',
		top: '0',
		pointerEvents: 'none',
		opacity: '0',
	});
	host.setAttribute('aria-hidden', 'true');
	deps.container.appendChild(host);
	const waitForFrame = deps.waitForFrame ?? nextFrame;

	/**
	 * Mount slide `index` on the off-screen stage and return everything the
	 * three rasterise variants below need: the mounted stage element, its
	 * natural (unscaled) size, the resolved export scale, and an
	 * `html2canvasFallback` closed over that stage.
	 */
	async function mountStage(
		index: number,
		scaleMultiplier: number,
	): Promise<{
		stage: HTMLElement;
		naturalWidth: number;
		naturalHeight: number;
		scale: number;
		html2canvasFallback: (
			sourceRect: { x: number; y: number; width: number; height: number },
			outputSize: { width: number; height: number },
		) => Promise<HTMLCanvasElement>;
	}> {
		const state = deps.store.get();
		const slide: PptxSlide | undefined = state.slides[index];
		if (!slide) {
			throw new Error(`Export failed: no slide at index ${index}`);
		}
		host.replaceChildren();
		const stage = renderSlideStage({
			document: deps.doc,
			slide,
			canvasSize: state.canvasSize,
			mediaDataUrls: state.mediaDataUrls,
			// The capture stage renders outside the live render controller, so it
			// has to build its own field context: without it an exported PNG/PDF
			// prints the authored "Slide #" placeholder while the screen shows
			// "Slide 1".
			fieldContext: buildRenderFieldContext(state, slide),
			registry: deps.registry,
			t: deps.getTranslator(),
			scale: 1,
			smartArt3D: deps.getSmartArt3D(),
			surfaceChart3D: deps.getSurfaceChart3D(),
			barChart3D: deps.getBarChart3D(),
			lineChart3D: deps.getLineChart3D(),
			areaChart3D: deps.getAreaChart3D(),
			pieChart3D: deps.getPieChart3D(),
			presenting: false,
		});
		host.appendChild(stage);
		await waitForFrame();
		const scale = 2 * deps.getImageResolutionScale() * scaleMultiplier;

		return {
			stage,
			naturalWidth: state.canvasSize.width,
			naturalHeight: state.canvasSize.height,
			scale,
			html2canvasFallback: (sourceRect, outputSize) =>
				renderToCanvas(stage, {
					backgroundColor: '#ffffff',
					scale: outputSize.width / (sourceRect.width || 1),
					x: sourceRect.x,
					y: sourceRect.y,
					width: sourceRect.width,
					height: sourceRect.height,
					logging: false,
				}),
		};
	}

	/**
	 * Rasterise slide `index` via the shared `foreignObject` -> vector-SVG ->
	 * html2canvas fallback chain, returning the full `RasterizeElementResult`
	 * (tiled `png-bytes` included). Used by PNG export and "copy slide as
	 * image" so a request whose full resolution exceeds the browser's canvas
	 * cap is tiled and stitched into pre-encoded PNG bytes.
	 */
	async function rasterizeSlideToRaster(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementResult> {
		const { stage, naturalWidth, naturalHeight, scale, html2canvasFallback } = await mountStage(
			index,
			scaleMultiplier,
		);
		return rasterizeElement(stage, naturalWidth, naturalHeight, deps.doc, {
			scale,
			backgroundColor: '#ffffff',
			html2canvasFallback,
		});
	}

	/**
	 * Rasterise slide `index` into its raw per-tile canvases (no PNG
	 * stitching). Used by PDF export so a page whose resolution exceeds the
	 * browser canvas cap is composed of several small tile images instead of
	 * one oversized or stitched canvas.
	 */
	async function rasterizeSlideToTiles(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementTilesResult> {
		const { stage, naturalWidth, naturalHeight, scale, html2canvasFallback } = await mountStage(
			index,
			scaleMultiplier,
		);
		return rasterizeElementTiles(stage, naturalWidth, naturalHeight, deps.doc, {
			scale,
			backgroundColor: '#ffffff',
			html2canvasFallback,
		});
	}

	/**
	 * Rasterise slide `index` to a single full-resolution canvas, for every
	 * caller that needs exactly one (GIF/video/print, all of which composite
	 * or re-encode a single image per frame/page; this binding has no JPEG or
	 * notes-PDF export). A request whose full resolution would need tiling
	 * (beyond the browser's canvas cap) is tiled and stitched transparently
	 * (`putImageData`, never a resolution cut), since those callers need one
	 * canvas rather than tiled or pre-encoded PNG bytes.
	 * `exportSlidePng`/`copySlideAsImage` use {@link rasterizeSlideToRaster}
	 * directly instead, and PDF export uses {@link rasterizeSlideToTiles}.
	 */
	async function rasterizeSlide(index: number, scaleMultiplier = 1): Promise<HTMLCanvasElement> {
		const { stage, naturalWidth, naturalHeight, scale, html2canvasFallback } = await mountStage(
			index,
			scaleMultiplier,
		);
		const result: RasterizeElementTiledCanvasResult = await rasterizeElementTiledToCanvas(
			stage,
			naturalWidth,
			naturalHeight,
			deps.doc,
			{ scale, backgroundColor: '#ffffff', html2canvasFallback },
		);
		return result.canvas;
	}

	return {
		rasterizeSlide,
		rasterizeSlideToRaster,
		rasterizeSlideToTiles,
		destroy() {
			host.remove();
		},
	};
}
