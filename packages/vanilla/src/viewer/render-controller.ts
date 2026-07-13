import type { PptxSlide } from 'pptx-viewer-core';

import type { PresentationPlayback } from './animation';
import { createPresentationPlayback } from './animation';
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
	/** Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`. */
	smartArt3D: boolean;
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
	/**
	 * Presentation-mode animation/transition playback, driven by the stage
	 * rebuild flow. Navigation (`viewer-controls`) consults `advance()` so a
	 * "next" first steps the on-click animation timeline before advancing slides.
	 */
	readonly presentationPlayback: PresentationPlayback;
}

/**
 * The DOM render orchestration for {@link PptxViewer}: turns store state into
 * stage / thumbnail / toolbar updates. Split from the class to keep both
 * halves small; it owns no state of its own.
 */
export function createRenderController(deps: RenderControllerDeps): RenderController {
	const { doc, store, registry } = deps;
	const presentationPlayback = createPresentationPlayback();

	const renderStageFor = (
		slide: PptxSlide,
		scale: number,
		presenting = false,
		interactive = false,
	): HTMLElement => {
		const state = store.get();
		const template = state.templateElementsBySlideId[slide.id] ?? [];
		const renderSlide = template.length
			? { ...slide, elements: [...template, ...slide.elements] }
			: slide;
		return renderSlideStage({
			document: doc,
			slide: renderSlide,
			canvasSize: state.canvasSize,
			mediaDataUrls: state.mediaDataUrls,
			colorScheme: state.colorScheme,
			tableStyleMap: state.tableStyleMap,
			registry,
			t: deps.getTranslator(),
			scale,
			smartArt3D: deps.smartArt3D,
			presenting,
			interactive,
			templateEditing: state.editTemplateMode || state.masterViewTarget !== null,
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
		const target = state.masterViewTarget;
		const master = target ? state.slideMasters[target.masterIndex] : undefined;
		const layout =
			target?.layoutIndex === null ? undefined : master?.layouts?.[target?.layoutIndex ?? -1];
		const slide: PptxSlide | undefined =
			target && master
				? {
						id: layout?.path ?? master.path,
						rId: '',
						slideNumber: 0,
						elements: layout
							? [...(master.elements ?? []), ...(layout.elements ?? [])]
							: (master.elements ?? []),
						backgroundColor: layout?.backgroundColor ?? master.backgroundColor,
						backgroundImage: layout?.backgroundImage ?? master.backgroundImage,
					}
				: state.slides[state.currentSlide];
		chrome.setEmpty(!slide);
		const scale = effectiveScale();
		chrome.stageWrap.style.width = `${state.canvasSize.width * scale}px`;
		chrome.stageWrap.style.height = `${state.canvasSize.height * scale}px`;
		chrome.stageWrap.replaceChildren();
		let stageNode: HTMLElement | null = null;
		if (slide) {
			stageNode = renderStageFor(slide, scale, state.presenting, true);
			chrome.stageWrap.appendChild(stageNode);
		}
		chrome.ribbon?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: scale * 100,
		});
		chrome.statusBar?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: scale * 100,
		});
		chrome.mobileNavigation?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: scale * 100,
		});
		chrome.presentationTouchControls.update(state.currentSlide, state.slides.length);
		chrome.mobileActionSheets?.update(state.currentSlide, state.slides, slide?.comments ?? []);
		chrome.notes.update({ slide, editable: state.editable });
		deps.onStageRendered?.();
		// Drive presentation-mode entrance state + slide transitions off the fresh
		// stage. Guarded on `presenting` inside `syncStage`; a no-op otherwise.
		if (stageNode) {
			presentationPlayback.syncStage({
				doc,
				stageWrap: chrome.stageWrap,
				stage: stageNode,
				slide,
				slideIndex: state.currentSlide,
				presenting: state.presenting,
			});
		} else {
			presentationPlayback.reset();
		}
	};

	const renderThumbnails = (): void => {
		const state = store.get();
		const rail = deps.getChrome().thumbnails;
		if (rail && state.masterViewTarget) {
			rail.renderMasters(
				state.slideMasters,
				state.canvasSize,
				renderStageFor,
				(masterIndex, layoutIndex) => {
					store.set({
						masterViewTarget: { masterIndex, layoutIndex },
						selectedElementId: null,
						selectedElementIds: [],
					});
				},
				state.masterViewTarget,
			);
		} else {
			rail?.render(state.slides, state.canvasSize, renderStageFor);
		}
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
			chrome.notes.setExpanded(state.notesExpanded);
			chrome.ribbon?.setNotesExpanded(state.notesExpanded);
			chrome.mobileNavigation?.setNotesExpanded(state.notesExpanded);
			chrome.ribbon?.setTemplateEditing(state.editTemplateMode);
		},
		renderStage,
		renderThumbnails,
		effectiveScale,
		presentationPlayback,
	};
}
