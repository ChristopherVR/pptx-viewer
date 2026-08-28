import type { PptxSlide } from 'pptx-viewer-core';

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
	 * Render slide `index` off-screen at scale 1 and capture it with
	 * html2canvas-pro. `scaleMultiplier` (default 1) is an extra factor on top
	 * of the baseline 2x * Options > Advanced > Image Size/Quality scale; the
	 * Print dialog's notes/handouts raster path passes a higher value when
	 * Options > Advanced > "High quality" is on, without changing plain
	 * PNG/PDF export.
	 */
	rasterizeSlide(index: number, scaleMultiplier?: number): Promise<HTMLCanvasElement>;
	/** Remove the off-screen capture stage from the DOM. */
	destroy(): void;
}

/**
 * Two animation frames: lets the browser lay out and paint the freshly
 * mounted stage (images, fonts, backgrounds) before html2canvas-pro captures
 * it, matching Vue's `nextTick()` + `requestAnimationFrame` in
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
 * 1 via the shared `renderSlideStage`, then rasterises it with
 * `renderToCanvas`. Vanilla port of Vue's `useExportWiring.rasterizeSlide`
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

	async function rasterizeSlide(index: number, scaleMultiplier = 1): Promise<HTMLCanvasElement> {
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
		return renderToCanvas(stage, {
			backgroundColor: '#ffffff',
			scale: 2 * deps.getImageResolutionScale() * scaleMultiplier,
			width: state.canvasSize.width,
			height: state.canvasSize.height,
			logging: false,
		});
	}

	return {
		rasterizeSlide,
		destroy() {
			host.remove();
		},
	};
}
