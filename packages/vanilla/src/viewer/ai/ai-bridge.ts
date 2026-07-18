/**
 * {@link PptxAiBridge} implementation over the vanilla viewer controller.
 *
 * Reads come straight off the reactive store; navigation + selection reuse the
 * public viewer controls; and every write is funnelled through the editor's
 * history layer (`commitSlides` / `applyElementPatch`) so an AI edit is a single
 * undoable step, exactly like a manual one. This module has NO dependency on the
 * optional `ai` SDK, so the viewer can construct the bridge eagerly and only pay
 * for the SDK when the chat panel is actually opened.
 */

import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';

import type { EditorController } from '../editor';
import type { Store, ViewerState } from '../state';
import { applyAiElementUpdate } from './ai-element-update';

export interface VanillaAiBridgeDeps {
	store: Store<ViewerState>;
	editor: EditorController;
	/** Navigate the viewer to a slide (viewer `goToSlide`). */
	goToSlide(index: number): void;
	/** Ensure editing is on so a write choke point is not silently dropped. */
	ensureEditable(): void;
	/** The loaded core handler, or null when nothing is loaded. */
	getHandler(): PptxHandler | null;
	/**
	 * Apply partial theme updates (colour/font scheme) to the deck and re-render.
	 * Theme scheme state lives outside the slides history snapshot, so this is a
	 * best-effort apply rather than a strictly undoable step.
	 */
	applyThemeUpdates(updates: Partial<PptxTheme>): void;
	/** Optional host notification sink (status line / toast / console). */
	notify?(message: string, level?: PptxAiNotifyLevel): void;
}

/** Build the AI bridge that exposes the live vanilla viewer to the AI core. */
export function createVanillaAiBridge(deps: VanillaAiBridgeDeps): PptxAiBridge {
	const { store, editor } = deps;

	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, _label: string): void => {
		const next = updater(structuredClone(store.get().slides));
		deps.ensureEditable();
		editor.commitSlides(next, store.get().currentSlide);
	};

	return {
		getDeckMeta(): PptxAiDeckMeta {
			const state = store.get();
			return {
				slideCount: state.slides.length,
				activeSlideIndex: state.currentSlide,
				title: deckTitle(state.slides),
				width: state.canvasSize.width,
				height: state.canvasSize.height,
			};
		},
		getSlides: () => store.get().slides,
		getActiveSlideIndex: () => store.get().currentSlide,
		getTheme(): PptxTheme | undefined {
			const { colorScheme } = store.get();
			return colorScheme ? { colorScheme } : undefined;
		},
		getHandler: () => deps.getHandler() ?? undefined,

		goToSlide: (index) => deps.goToSlide(index),
		selectElements(slideIndex, elementIds) {
			deps.goToSlide(slideIndex);
			editor.selectElements(elementIds);
		},

		applySlidesUpdate,
		updateElement(slideIndex, elementId, updates: PptxAiElementUpdate) {
			applySlidesUpdate((slides) => {
				const el = slides[slideIndex]?.elements.find((e) => e.id === elementId);
				if (el) {
					applyAiElementUpdate(el, updates);
				}
				return slides;
			}, `Update ${elementId}`);
		},
		applyTheme: (updates) => deps.applyThemeUpdates(updates),

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
