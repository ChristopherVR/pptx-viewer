import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, FieldSubstitutionContext } from 'pptx-viewer-shared';
import { mount, unmount } from 'svelte';

import { I18N_CONTEXT_KEY } from '../../i18n/context';
import type { Translator } from '../../i18n/translator';
import SlideStage from '../components/SlideStage.svelte';
import { FieldContextKey } from '../state/field-context';
import { SmartArt3DContextKey } from '../state/smart-art-3d-context';
import { SurfaceChart3DContextKey } from '../state/surface-chart-3d-context';
import { renderToCanvas } from './render-to-canvas';

export interface RasterizeSlideDeps {
	doc: Document;
	/** Host the off-screen capture stage is appended to; removed on `destroy()`. */
	container: HTMLElement;
	getSlides(): PptxSlide[];
	getCanvasSize(): CanvasSize;
	getMediaDataUrls(): Map<string, string>;
	getTranslator(): Translator;
	/** Opt-in WebGL SmartArt renderer flag; see `PowerPointViewerProps.smartArt3D`. */
	smartArt3D: boolean;
	/**
	 * Opt-in WebGL surface-chart renderer flag; see
	 * `PowerPointViewerProps.surfaceChart3D`.
	 */
	surfaceChart3D: boolean;
	/**
	 * Deck-level OOXML field-substitution context. The capture stage is mounted
	 * outside the viewer tree, so without this an exported PNG/PDF would print
	 * the authored "Slide #" placeholder while the screen shows "Slide 1".
	 * `SlideStage` re-points its per-slide fields at the slide being captured.
	 */
	getFieldContext?: () => FieldSubstitutionContext | undefined;
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

	async function rasterizeSlide(index: number): Promise<HTMLCanvasElement> {
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
				[FieldContextKey, () => deps.getFieldContext?.()],
			]),
		});
		await waitForFrame();
		const stageEl = host.querySelector<HTMLElement>('.pptx-svelte-stage');
		if (!stageEl) {
			throw new Error('Export failed: stage did not render');
		}
		return renderToCanvas(stageEl, {
			backgroundColor: '#ffffff',
			scale: 2,
			width: canvasSize.width,
			height: canvasSize.height,
			logging: false,
		});
	}

	return {
		rasterizeSlide,
		destroy() {
			unmountCurrent();
			host.remove();
		},
	};
}
