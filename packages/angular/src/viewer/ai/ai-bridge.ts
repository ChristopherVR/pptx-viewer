/**
 * createAngularAiBridge: builds a {@link PptxAiBridge} that lets the
 * framework-agnostic AI core (`pptx-viewer-shared/ai`) read the open deck,
 * navigate it, and route edits through the Angular editor-history layer so
 * every AI change is a single, undoable Ctrl+Z.
 *
 * The bridge is a plain object closing over a small set of accessor callbacks
 * (mirroring React's `useAiBridge` ref indirection): each read pulls the live
 * value on demand, and each of the three write choke points funnels through
 * {@link BridgeDeps.applySlides} -> `EditorStateService.applyReplacement`, which
 * records ONE history snapshot per commit. Keeping writes funnelled is what lets
 * the {@link ProposalStore} apply a staged batch atomically.
 */
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxData,
	PptxHandler,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';

import { applyElementUpdate } from '../../internal/shared-ai';
import type {
	PptxAiBridge,
	PptxAiDataUpdater,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiFocusedTarget,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from '../../internal/shared-ai';

/** Live accessors the bridge closes over, supplied by the viewer component. */
export interface BridgeDeps {
	/** The editable (template-free) slide deck. */
	getSlides(): readonly PptxSlide[];
	/** Zero-based index of the active slide. */
	getActiveSlideIndex(): number;
	/** Slide canvas size in CSS pixels. */
	getCanvasSize(): { width: number; height: number };
	/** The resolved presentation theme, when loaded. */
	getTheme(): PptxTheme | undefined;
	/** Host-provided document display name, when set. */
	getFileName(): string | undefined;
	/** The loaded core handler, when a deck is open. */
	getHandler(): PptxHandler | undefined;
	/** Navigate the viewer to a slide by zero-based index. */
	goToSlide(index: number): void;
	/** Select the given elements on a slide (empty clears selection). */
	selectElements(slideIndex: number, elementIds: readonly string[]): void;
	/**
	 * Commit a fully-computed next slides array as ONE undoable history entry.
	 * Implemented by the component as `editor.applyReplacement(next, label)`.
	 */
	applySlides(next: PptxSlide[], label: string): void;
	/** Apply partial theme updates through the editor's theme handlers. */
	applyTheme(updates: Partial<PptxTheme>): void;
	// ── presentation-level (deck) state, for the AI `getDeckData`/`applyDeckData`
	// seam that the pptx-viewer-mcp "deck" tools (canvas size, metadata, sections,
	// presentation properties) route through. Slide/theme tools do not need these.
	/** Ordered presentation sections (editor-tracked, saved with the deck). */
	getSections(): readonly PptxSection[];
	/** Presentation-level properties (`p:presentationPr`), loader-tracked. */
	getPresentationProperties(): PptxPresentationProperties;
	/** Custom document properties (`docProps/custom.xml`), loader-tracked. */
	getCustomProperties(): readonly PptxCustomProperty[];
	/** Core document properties (`docProps/core.xml`), loader-tracked. */
	getCoreProperties(): PptxCoreProperties | undefined;
	/** Extended application properties (`docProps/app.xml`), loader-tracked. */
	getAppProperties(): PptxAppProperties | undefined;
	/** Set the slide canvas size (px) and mark the deck dirty. */
	setCanvasSize(size: { width: number; height: number }): void;
	/** Replace the presentation sections and mark the deck dirty. */
	setSections(sections: readonly PptxSection[]): void;
	/** Replace the presentation-level properties and mark the deck dirty. */
	setPresentationProperties(props: PptxPresentationProperties): void;
	/** Replace the custom document properties and mark the deck dirty. */
	setCustomProperties(props: readonly PptxCustomProperty[]): void;
	/** Replace the core document properties and mark the deck dirty. */
	setCoreProperties(props: PptxCoreProperties | undefined): void;
	/** Replace the extended application properties and mark the deck dirty. */
	setAppProperties(props: PptxAppProperties | undefined): void;
	/**
	 * The slides / elements the assistant should scope its work to (explicit AI
	 * picks, else a pinned focus, else the live canvas selection). When omitted,
	 * the assistant falls back to the whole active slide.
	 */
	getFocusedTargets?(): PptxAiFocusedTarget[];
	/** Optional transient host notification (toast / status line). */
	notify?(message: string, level?: PptxAiNotifyLevel): void;
}

/** Build a stable {@link PptxAiBridge} over the Angular viewer state/editor. */
export function createAngularAiBridge(deps: BridgeDeps): PptxAiBridge {
	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, label: string): void => {
		// Clone before handing to the updater so mutating updaters never touch the
		// live signal value; the committed result becomes one history entry.
		const next = updater(structuredClone([...deps.getSlides()]));
		deps.applySlides(next, label);
	};

	/**
	 * Assemble the presentation-level {@link PptxData} the deck tools read, with
	 * the live (edited) slides/theme and Angular's tracked deck metadata overlaid.
	 * Only the fields Angular actually tracks are populated; the rest stay absent
	 * so their MCP sub-tools degrade gracefully rather than reading stale data.
	 */
	const readDeckData = (): PptxData => {
		const size = deps.getCanvasSize();
		return {
			slides: [...deps.getSlides()],
			width: size.width,
			height: size.height,
			theme: deps.getTheme(),
			sections: [...deps.getSections()],
			presentationProperties: deps.getPresentationProperties(),
			customProperties: [...deps.getCustomProperties()],
			coreProperties: deps.getCoreProperties(),
			appProperties: deps.getAppProperties(),
		} satisfies Partial<PptxData> as PptxData;
	};

	const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

	return {
		getDeckMeta(): PptxAiDeckMeta {
			const slides = deps.getSlides();
			const size = deps.getCanvasSize();
			const firstTitle = slides[0]?.elements.find(
				(el) => 'text' in el && typeof el.text === 'string' && el.text.trim().length > 0,
			);
			return {
				slideCount: slides.length,
				activeSlideIndex: deps.getActiveSlideIndex(),
				title:
					deps.getFileName() ??
					(firstTitle && 'text' in firstTitle ? String(firstTitle.text) : undefined),
				width: size.width,
				height: size.height,
			};
		},
		getSlides: () => [...deps.getSlides()],
		getActiveSlideIndex: () => deps.getActiveSlideIndex(),
		getTheme: () => deps.getTheme(),
		getHandler: () => deps.getHandler(),
		goToSlide(index: number): void {
			deps.goToSlide(index);
		},
		selectElements(slideIndex: number, elementIds: string[]): void {
			deps.selectElements(slideIndex, elementIds);
		},
		applySlidesUpdate,
		updateElement(slideIndex: number, elementId: string, updates: PptxAiElementUpdate): void {
			applySlidesUpdate((slides) => {
				const el = slides[slideIndex]?.elements.find((e) => e.id === elementId);
				if (el) {
					applyElementUpdate(el, updates);
				}
				return slides;
			}, `Update element ${elementId}`);
		},
		applyTheme(updates: Partial<PptxTheme>): void {
			deps.applyTheme(updates);
		},
		getDeckData(): PptxData {
			return readDeckData();
		},
		applyDeckData(updater: PptxAiDataUpdater, label: string): void {
			const before = readDeckData();
			const after = updater(structuredClone(before));
			// Slides route through the undoable editor path (one history entry); the
			// other deck fields persist into the save model and re-render but are not
			// individually undoable, mirroring React's change-detecting fan-out. Each
			// setter marks the deck dirty, so no separate markDirty is needed.
			if (differs(before.slides, after.slides)) {
				deps.applySlides(after.slides, label);
			}
			if (before.width !== after.width || before.height !== after.height) {
				deps.setCanvasSize({ width: after.width, height: after.height });
			}
			const nextSections = after.sections ?? before.sections ?? [];
			if (differs(before.sections, nextSections)) {
				deps.setSections(nextSections);
			}
			const nextPresProps = after.presentationProperties ?? deps.getPresentationProperties();
			if (differs(before.presentationProperties, nextPresProps)) {
				deps.setPresentationProperties(nextPresProps);
			}
			const nextCustomProps = after.customProperties ?? before.customProperties ?? [];
			if (differs(before.customProperties, nextCustomProps)) {
				deps.setCustomProperties(nextCustomProps);
			}
			if (differs(before.coreProperties, after.coreProperties)) {
				deps.setCoreProperties(after.coreProperties);
			}
			if (differs(before.appProperties, after.appProperties)) {
				deps.setAppProperties(after.appProperties);
			}
		},
		getFocusedTargets(): PptxAiFocusedTarget[] {
			return (
				deps.getFocusedTargets?.() ?? [{ kind: 'slide', slideIndex: deps.getActiveSlideIndex() }]
			);
		},
		notify(message: string, level?: PptxAiNotifyLevel): void {
			deps.notify?.(message, level);
		},
	};
}
