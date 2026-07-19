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

import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
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
}

/** Build the AI bridge that exposes the live Svelte viewer to the AI core. */
export function createSvelteAiBridge(deps: SvelteAiBridgeDeps): PptxAiBridge {
	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, label: string): void => {
		const next = updater(structuredClone(deps.getSlides()));
		deps.commitSlides(next, label);
	};

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
