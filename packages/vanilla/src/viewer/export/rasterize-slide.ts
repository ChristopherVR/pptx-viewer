import type { PptxSlide } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import type { ElementRendererRegistry } from '../render';
import { createEl, renderSlideStage } from '../render';
import type { Store, ViewerState } from '../state';
import { renderToCanvas } from './render-to-canvas';

export interface RasterizeSlideDeps {
	doc: Document;
	/** Host the off-screen capture stage is appended to; removed on `destroy()`. */
	container: HTMLElement;
	store: Store<ViewerState>;
	registry: ElementRendererRegistry;
	getTranslator(): Translator;
	/** Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`. */
	smartArt3D: boolean;
	/**
	 * Overridable frame-wait before capture (test seam: the real
	 * `requestAnimationFrame` double-wait is not worth driving through fake
	 * timers). Defaults to {@link nextFrame}.
	 */
	waitForFrame?: () => Promise<void>;
}

export interface RasterizeSlideController {
	/** Render slide `index` off-screen at scale 1 and capture it with html2canvas-pro. */
	rasterizeSlide(index: number): Promise<HTMLCanvasElement>;
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

	async function rasterizeSlide(index: number): Promise<HTMLCanvasElement> {
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
			registry: deps.registry,
			t: deps.getTranslator(),
			scale: 1,
			smartArt3D: deps.smartArt3D,
			presenting: false,
		});
		host.appendChild(stage);
		await waitForFrame();
		return renderToCanvas(stage, {
			backgroundColor: '#ffffff',
			scale: 2,
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
