/**
 * {@link PptxAiBridge} implementation over the Svelte viewer's reactive editor.
 *
 * Reads come straight off getters the root component wires to its `EditorState`
 * / `PresentationLoader` runes; navigation + selection reuse the editor's public
 * ops; and every write is funnelled through {@link SvelteAiBridgeDeps.commitSlides}
 * so an AI edit becomes a single undoable history entry, exactly like a manual
 * one. This module has NO dependency on the optional `ai` SDK, so the root can
 * build the bridge eagerly and only pay for the SDK when the panel first opens.
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
import type {
	PptxAiBridge,
	PptxAiDataUpdater,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';
import { applyElementUpdate } from 'pptx-viewer-shared/ai';

/** Live editor accessors the bridge closes over (all read from viewer runes). */
export interface SvelteAiBridgeDeps {
	/** The editable slides array (the single source of truth the AI mutates). */
	getSlides(): PptxSlide[];
	/** Zero-based index of the active slide. */
	getActiveSlideIndex(): number;
	/** Slide canvas size in CSS pixels. */
	getCanvasSize(): { width: number; height: number };
	/** The resolved presentation theme, when available. */
	getTheme(): PptxTheme | undefined;
	/** The loaded core handler, or null before a deck is open. */
	getHandler(): PptxHandler | null;
	/** Optional display file name, used as a friendly deck title. */
	getFileName(): string | undefined;
	/** Navigate the viewer to a slide by zero-based index. */
	goToSlide(index: number): void;
	/** Select elements on a slide (navigates first when off-slide). */
	selectElements(slideIndex: number, elementIds: string[]): void;
	/**
	 * Install a new slides array as ONE undoable history entry. The
	 * implementation is responsible for ensuring the editor is editable (so the
	 * commit is not silently dropped) before recording the step.
	 */
	commitSlides(next: PptxSlide[], label: string): void;
	/** Apply partial theme updates (colour/font scheme) and re-render. */
	applyTheme(updates: Partial<PptxTheme>): void;
	/** Optional host notification sink (status line / toast / console). */
	notify?(message: string, level?: PptxAiNotifyLevel): void;

	// ── presentation-level (deck) state, for getDeckData / applyDeckData ───────
	// Svelte tracks the full deck: sections + document metadata live on the
	// editor (undoable), canvas size on the loader. These accessors/setters let
	// the AI's whole-deck seam read and commit the pptx-viewer-mcp "deck" tools.
	/** Deck sections (editor-tracked, undoable). */
	getSections(): PptxSection[];
	/** Deck-wide slide-show / print settings (editor-tracked, undoable). */
	getPresentationProperties(): PptxPresentationProperties;
	/** Document core properties (Title / Author / ...), when present. */
	getCoreProperties(): PptxCoreProperties | undefined;
	/** Application properties (Company / Application), when present. */
	getAppProperties(): PptxAppProperties | undefined;
	/** Custom document-property list (editor-tracked, undoable). */
	getCustomProperties(): PptxCustomProperty[];
	/** Resize the slide canvas (loader value + editor history entry). */
	setCanvasSize(size: { width: number; height: number }): void;
	/** Replace the section list. */
	setSections(sections: PptxSection[]): void;
	/** Replace the deck-wide presentation properties. */
	setPresentationProperties(props: PptxPresentationProperties): void;
	/**
	 * Replace the document properties as one unit. Svelte's editor commits
	 * core / app / custom together, so the bridge fans all three through here.
	 */
	setDocumentProperties(
		core: PptxCoreProperties,
		app: PptxAppProperties,
		custom: PptxCustomProperty[],
	): void;
}

/** Build the AI bridge that exposes the live Svelte viewer to the AI core. */
export function createSvelteAiBridge(deps: SvelteAiBridgeDeps): PptxAiBridge {
	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, label: string): void => {
		const next = updater(structuredClone(deps.getSlides()));
		deps.commitSlides(next, label);
	};

	/** Reconstruct the presentation-level PptxData the deck MCP tools read/write. */
	const readDeckData = (): PptxData => {
		const canvas = deps.getCanvasSize();
		return {
			slides: deps.getSlides(),
			width: canvas.width,
			height: canvas.height,
			theme: deps.getTheme(),
			sections: deps.getSections(),
			presentationProperties: deps.getPresentationProperties(),
			customProperties: deps.getCustomProperties(),
			coreProperties: deps.getCoreProperties(),
			appProperties: deps.getAppProperties(),
		} satisfies Partial<PptxData> as PptxData;
	};

	const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

	return {
		getDeckMeta(): PptxAiDeckMeta {
			const slides = deps.getSlides();
			const canvas = deps.getCanvasSize();
			return {
				slideCount: slides.length,
				activeSlideIndex: deps.getActiveSlideIndex(),
				title: deps.getFileName() ?? deckTitle(slides),
				width: canvas.width,
				height: canvas.height,
			};
		},
		getSlides: () => deps.getSlides(),
		getActiveSlideIndex: () => deps.getActiveSlideIndex(),
		getTheme: () => deps.getTheme(),
		getHandler: () => deps.getHandler() ?? undefined,

		goToSlide: (index) => deps.goToSlide(index),
		selectElements: (slideIndex, elementIds) => deps.selectElements(slideIndex, elementIds),

		applySlidesUpdate,
		updateElement(slideIndex, elementId, updates: PptxAiElementUpdate) {
			applySlidesUpdate((slides) => {
				const el = slides[slideIndex]?.elements.find((candidate) => candidate.id === elementId);
				if (el) {
					applyElementUpdate(el, updates);
				}
				return slides;
			}, `Update ${elementId}`);
		},
		applyTheme: (updates) => deps.applyTheme(updates),

		getDeckData: () => readDeckData(),
		applyDeckData(updater: PptxAiDataUpdater, label: string) {
			const before = readDeckData();
			const after = updater(structuredClone(before));
			// Slides + canvas size route through the undoable editor paths; the
			// other deck fields commit through their own editor mutations (each an
			// undo entry). Fan out only the top-level fields that actually changed.
			if (differs(before.slides, after.slides)) {
				deps.commitSlides(after.slides, label);
			}
			if (before.width !== after.width || before.height !== after.height) {
				deps.setCanvasSize({ width: after.width, height: after.height });
			}
			const nextSections = after.sections ?? before.sections ?? [];
			if (differs(before.sections, nextSections)) {
				deps.setSections(nextSections);
			}
			const nextPresProps = after.presentationProperties ?? before.presentationProperties ?? {};
			if (differs(before.presentationProperties, nextPresProps)) {
				deps.setPresentationProperties(nextPresProps);
			}
			// Svelte commits core / app / custom document properties as one unit, so
			// touch the combined setter when any of the three changed.
			const nextCore = after.coreProperties ?? before.coreProperties;
			const nextApp = after.appProperties ?? before.appProperties;
			const nextCustom = after.customProperties ?? before.customProperties ?? [];
			if (
				differs(before.coreProperties, nextCore) ||
				differs(before.appProperties, nextApp) ||
				differs(before.customProperties, nextCustom)
			) {
				deps.setDocumentProperties(nextCore ?? {}, nextApp ?? {}, nextCustom);
			}
		},

		notify: deps.notify,
	};
}

/** First non-empty text run on the first slide, used as a friendly deck title. */
function deckTitle(slides: PptxSlide[]): string | undefined {
	for (const el of slides[0]?.elements ?? []) {
		if (el.type === 'text' && el.text?.trim()) {
			return el.text.trim().slice(0, 120);
		}
	}
	return undefined;
}
