import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { DEFAULT_MASTER_PAGE_SIZE } from 'pptx-viewer-shared';

import type { PresentationPlayback } from './animation';
import { createPresentationPlayback } from './animation';
import type { Translator } from './i18n';
import type { ElementRenderContext, ElementRendererRegistry } from './render';
import { renderSlideStage, reRenderPresentationElements } from './render';
import { buildRenderFieldContext } from './render-field-context';
import type { Store, ViewerState } from './state';
import type { ViewerChrome } from './ui';
import { renderHandoutMasterCanvas, renderNotesMasterCanvas } from './ui/master-canvases';

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
	/** History-integrated handout master layout mutation. */
	onHandoutSlidesPerPageChange(count: number): void;
	onMasterBackgroundColorChange(color: string): void;
	onSectionToggle(sectionId: string): void;
	onSectionRename(sectionId: string, name: string): void;
	onSectionDelete(sectionId: string): void;
	onSectionMove(sectionId: string, direction: 'up' | 'down'): void;
	/** Navigate from a presentation Zoom tile. */
	onZoomClick(targetSlideIndex: number, returnSlideIndex: number): void;
	onSmartArtNodeTextChange?(element: PptxElement, nodeId: string, text: string): void;
	onSmartArtNodeFillChange?(element: PptxElement, nodeId: string, fill: string): void;
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
	/**
	 * Render one slide statically at `scale` (template elements included), for
	 * surfaces outside the main canvas such as Reading View. Same path the
	 * thumbnail rail draws through, so no surface grows its own element renderer.
	 */
	renderSlideNode(slide: PptxSlide, scale: number): HTMLElement;
	/** Resolve the requested zoom into a concrete scale factor. */
	effectiveScale(): number;
	/**
	 * Scale at which the slide exactly fits the viewport, i.e. the scale that
	 * {@link zoomPercent} reports as 100%. The zoom controls need it because the
	 * stored zoom is an ABSOLUTE scale while the shared zoom step is expressed
	 * relative to fit, exactly as React's is.
	 */
	fitScale(): number;
	/** Display zoom relative to fit-to-viewport (fit === 100%), like React. */
	zoomPercent(): number;
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

	// Render context + stage node of the last presentation render, so playback can
	// re-render single elements (staged build, `p:animClr`) without a full rebuild.
	let presentationContext: ElementRenderContext | null = null;
	let presentationStageNode: HTMLElement | null = null;
	const captureContext = (context: ElementRenderContext): void => {
		presentationContext = context;
	};

	const renderStageFor = (
		slide: PptxSlide,
		scale: number,
		presenting = false,
		interactive = false,
		canvasSize = store.get().canvasSize,
	): HTMLElement => {
		const state = store.get();
		const template = state.templateElementsBySlideId[slide.id] ?? [];
		const renderSlide = template.length
			? { ...slide, elements: [...template, ...slide.elements] }
			: slide;
		return renderSlideStage({
			document: doc,
			slide: renderSlide,
			canvasSize,
			mediaDataUrls: state.mediaDataUrls,
			colorScheme: state.colorScheme,
			fontScheme: state.fontScheme,
			tableStyleMap: state.tableStyleMap,
			fieldContext: buildRenderFieldContext(state, slide),
			registry,
			t: deps.getTranslator(),
			scale,
			smartArt3D: deps.smartArt3D,
			presenting,
			slides: state.slides,
			currentSlideIndex: state.currentSlide,
			onZoomClick: deps.onZoomClick,
			onSmartArtNodeTextChange: interactive ? deps.onSmartArtNodeTextChange : undefined,
			onSmartArtNodeFillChange: interactive ? deps.onSmartArtNodeFillChange : undefined,
			interactive,
			templateEditing: state.editTemplateMode || state.masterViewTarget !== null,
			// Native-animation state + context capture only for the live presentation
			// stage; the editor canvas and thumbnails render statically.
			presentationStates: presenting ? presentationPlayback.elementStates : undefined,
			captureContext: presenting ? captureContext : undefined,
		});
	};

	/** Re-render tracked elements in place against the current playback states. */
	const reRenderElements = (ids: readonly string[]): void => {
		if (presentationContext && presentationStageNode) {
			reRenderPresentationElements(presentationContext, presentationStageNode, ids);
		}
	};
	const fitScaleFor = (canvasSize: { width: number; height: number }): number => {
		const state = store.get();
		const viewport = deps.getChrome().viewport;
		const padding = state.presenting ? 0 : FIT_PADDING_PX;
		const scale = Math.min(
			(viewport.clientWidth - padding) / Math.max(canvasSize.width, 1),
			(viewport.clientHeight - padding) / Math.max(canvasSize.height, 1),
		);
		return Number.isFinite(scale) && scale > 0 ? scale : 1;
	};
	const effectiveScaleFor = (canvasSize: { width: number; height: number }): number => {
		const state = store.get();
		return state.zoom !== 'fit' ? state.zoom : fitScaleFor(canvasSize);
	};

	const effectiveScale = (): number => {
		return effectiveScaleFor(store.get().canvasSize);
	};

	const fitScale = (): number => {
		return fitScaleFor(store.get().canvasSize);
	};

	const zoomPercent = (): number => {
		const canvasSize = store.get().canvasSize;
		return (effectiveScaleFor(canvasSize) / fitScaleFor(canvasSize)) * 100;
	};

	const renderStage = (): void => {
		const chrome = deps.getChrome();
		const state = store.get();
		const target = state.masterViewTarget;
		const master = target ? state.slideMasters[target.masterIndex] : undefined;
		const layout =
			target?.layoutIndex === null ? undefined : master?.layouts?.[target?.layoutIndex ?? -1];
		const slide: PptxSlide | undefined = target
			? master
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
				: undefined
			: state.slides[state.currentSlide];
		const specialMaster = target && state.masterViewTab !== 'slides';
		const pageSize = specialMaster
			? state.masterViewTab === 'notes'
				? (state.notesCanvasSize ?? DEFAULT_MASTER_PAGE_SIZE)
				: DEFAULT_MASTER_PAGE_SIZE
			: state.canvasSize;
		const hasContent = specialMaster || Boolean(slide);
		chrome.setEmpty(!hasContent);
		const scale = effectiveScaleFor(pageSize);
		chrome.stageWrap.style.width = `${pageSize.width * scale}px`;
		chrome.stageWrap.style.height = `${pageSize.height * scale}px`;
		chrome.stageWrap.replaceChildren();
		let stageNode: HTMLElement | null = null;
		if (specialMaster) {
			const selectedMaster =
				state.masterViewTab === 'notes' ? state.notesMaster : state.handoutMaster;
			if (selectedMaster?.elements?.length) {
				stageNode = renderStageFor(
					{
						id: selectedMaster.path,
						rId: '',
						slideNumber: 0,
						elements: selectedMaster.elements,
						backgroundColor: selectedMaster.backgroundColor,
						backgroundImage: selectedMaster.backgroundImage,
					},
					scale,
					false,
					true,
					pageSize,
				);
				stageNode.dataset.testid =
					state.masterViewTab === 'notes' ? 'notes-master-page' : 'handout-master-page';
			} else {
				const scaledSize = { width: pageSize.width * scale, height: pageSize.height * scale };
				stageNode =
					state.masterViewTab === 'notes'
						? renderNotesMasterCanvas(doc, deps.getTranslator(), state.notesMaster, scaledSize)
						: renderHandoutMasterCanvas(
								doc,
								deps.getTranslator(),
								state.handoutMaster,
								scaledSize,
								state.handoutSlidesPerPage,
							);
			}
		} else if (slide) {
			stageNode = renderStageFor(slide, scale, state.presenting, true, pageSize);
		}
		if (stageNode && slide) {
			chrome.stageWrap.appendChild(stageNode);
		}
		// React shows zoom relative to fit-to-viewport (fit === 100%), so the
		// default reads 100% instead of the raw stage scale factor.
		const stageZoomPercent = (scale / fitScaleFor(pageSize)) * 100;
		chrome.ribbon?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: stageZoomPercent,
		});
		chrome.statusBar?.update({
			current: state.currentSlide,
			total: state.slides.length,
			zoomPercent: stageZoomPercent,
		});
		chrome.presentationTouchControls.update(state.currentSlide, state.slides.length);
		chrome.mobileActionSheets?.update(state.currentSlide, state.slides, slide?.comments ?? []);
		chrome.notes.update({ slide: specialMaster ? undefined : slide, editable: state.editable });
		deps.onStageRendered?.();
		// Drive presentation-mode entrance state + slide transitions off the fresh
		// stage. Guarded on `presenting` inside `syncStage`; a no-op otherwise.
		if (stageNode) {
			presentationStageNode = stageNode;
			presentationPlayback.syncStage({
				doc,
				stageWrap: chrome.stageWrap,
				stage: stageNode,
				slide,
				slideIndex: state.currentSlide,
				presenting: state.presenting,
				showWithAnimation: state.presentationProperties.showWithAnimation,
				mediaDataUrls: state.mediaDataUrls,
				reRenderElements,
				// PowerPoint shows a slide you step BACK onto with its builds already
				// played; the store marks the pending entry as backward.
				seedCompleted: state.enteringBackward === true,
			});
		} else {
			presentationStageNode = null;
			presentationContext = null;
			presentationPlayback.reset();
		}
	};

	const renderThumbnails = (): void => {
		const state = store.get();
		const rail = deps.getChrome().thumbnails;
		if (state.masterViewTarget) {
			rail?.setVisible(false);
			deps.getChrome().masterSidebar.setVisible(true);
			deps.getChrome().masterSidebar.render({
				tab: state.masterViewTab,
				masters: state.slideMasters,
				active: state.masterViewTarget,
				canvasSize: state.canvasSize,
				notesBackground: state.notesMaster?.backgroundColor,
				notesPlaceholders: state.notesMaster?.placeholders,
				notesMasterPresent: Boolean(state.notesMaster),
				handoutBackground: state.handoutMaster?.backgroundColor,
				handoutPlaceholders: state.handoutMaster?.placeholders,
				handoutMasterPresent: Boolean(state.handoutMaster),
				handoutSlidesPerPage: state.handoutSlidesPerPage,
				renderStage: renderStageFor,
				onSelect: (masterIndex, layoutIndex) => {
					store.set({
						masterViewTarget: { masterIndex, layoutIndex },
						selectedElementId: null,
						selectedElementIds: [],
					});
				},
				onTabChange: (masterViewTab) => {
					store.set({ masterViewTab, selectedElementId: null, selectedElementIds: [] });
				},
				onCollapse: () => {
					store.set({
						masterViewTarget: null,
						masterViewTab: 'slides',
						editTemplateMode: false,
						selectedElementId: null,
						selectedElementIds: [],
					});
				},
				onHandoutSlidesPerPageChange: (handoutSlidesPerPage) => {
					deps.onHandoutSlidesPerPageChange(handoutSlidesPerPage);
				},
				onMasterBackgroundColorChange: deps.onMasterBackgroundColorChange,
			});
		} else {
			deps.getChrome().masterSidebar.setVisible(false);
			rail?.setVisible(true);
			rail?.render(
				state.slides,
				state.canvasSize,
				renderStageFor,
				state.sections,
				state.editable
					? {
							toggle: deps.onSectionToggle,
							rename: deps.onSectionRename,
							delete: deps.onSectionDelete,
							move: deps.onSectionMove,
						}
					: undefined,
			);
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
			chrome.mobileActionSheets?.setNotesExpanded(state.notesExpanded);
			chrome.ribbon?.setTemplateEditing(state.editTemplateMode);
			chrome.ribbon?.setViewOptions(state);
		},
		renderStage,
		renderThumbnails,
		renderSlideNode: (slide, scale) => renderStageFor(slide, scale),
		effectiveScale,
		fitScale,
		zoomPercent,
		presentationPlayback,
	};
}
