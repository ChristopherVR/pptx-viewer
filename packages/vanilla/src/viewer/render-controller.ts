import type { PptxSlide } from 'pptx-viewer-core';

import type { Translator } from './i18n';
import type { ElementRendererRegistry } from './render';
import { renderSlideStage } from './render';
import type { Store, ViewerState } from './state';
import type { ViewerChrome } from './ui';

/** Fit-mode breathing room around the stage (viewport padding), in px. */
const FIT_PADDING_PX = 32;

export interface RenderControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	registry: ElementRendererRegistry;
	/** Getters so chrome/translator swaps (setLocale) are picked up live. */
	getChrome(): ViewerChrome;
	getTranslator(): Translator;
	/**
	 * Invoked after every stage render (the stage host is rebuilt with
	 * `replaceChildren`); the editor re-mounts its overlay layer here.
	 */
	onStageRendered?(): void;
}

export interface RenderController {
	/** Re-render everything (used after a chrome rebuild). */
	renderAll(): void;
	/** Re-render the main stage + toolbar counters at the current state. */
	renderStage(): void;
	/** Rebuild the thumbnail rail from the current slide list. */
	renderThumbnails(): void;
	/** Resolve the requested zoom into a concrete scale factor. */
	effectiveScale(): number;
}

/**
 * The DOM render orchestration for {@link PptxViewer}: turns store state into
 * stage / thumbnail / toolbar updates. Split from the class to keep both
 * halves small; it owns no state of its own.
 */
export function createRenderController(deps: RenderControllerDeps): RenderController {
	const { doc, store, registry } = deps;

	const renderStageFor = (slide: PptxSlide, scale: number): HTMLElement => {
		const state = store.get();
		return renderSlideStage({
			document: doc,
			slide,
			canvasSize: state.canvasSize,
			mediaDataUrls: state.mediaDataUrls,
			registry,
			t: deps.getTranslator(),
			scale,
		});
	};

	const effectiveScale = (): number => {
		const state = store.get();
		if (state.zoom !== 'fit') {
			return state.zoom;
		}
		const viewport = deps.getChrome().viewport;
		const padding = state.presenting ? 0 : FIT_PADDING_PX;
		const scale = Math.min(
			(viewport.clientWidth - padding) / Math.max(state.canvasSize.width, 1),
			(viewport.clientHeight - padding) / Math.max(state.canvasSize.height, 1),
		);
		return Number.isFinite(scale) && scale > 0 ? scale : 1;
	};

	const renderStage = (): void => {
		const chrome = deps.getChrome();
		const state = store.get();
		const slide = state.slides[state.currentSlide];
		chrome.setEmpty(!slide);
		const scale = effectiveScale();
		chrome.stageWrap.style.width = `${state.canvasSize.width * scale}px`;
		chrome.stageWrap.style.height = `${state.canvasSize.height * scale}px`;
		chrome.stageWrap.replaceChildren();
		if (slide) {
			chrome.stageWrap.appendChild(renderStageFor(slide, scale));
		}
		chrome.toolbar?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: scale * 100,
		});
		deps.onStageRendered?.();
	};

	const renderThumbnails = (): void => {
		const { slides, canvasSize } = store.get();
		deps.getChrome().thumbnails?.render(slides, canvasSize, renderStageFor);
	};

	return {
		renderAll() {
			const chrome = deps.getChrome();
			const state = store.get();
			chrome.setLoading(state.loading);
			chrome.setError(state.error);
			chrome.setPresenting(state.presenting);
			renderThumbnails();
			renderStage();
			chrome.thumbnails?.setActive(state.currentSlide);
		},
		renderStage,
		renderThumbnails,
		effectiveScale,
	};
}
