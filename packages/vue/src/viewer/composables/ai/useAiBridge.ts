/**
 * useAiBridge: builds a stable {@link PptxAiBridge} that lets the
 * framework-agnostic AI core (`pptx-viewer-shared/ai`) read the open deck,
 * navigate it, and route edits through the Vue editor-history layer so every AI
 * change is a single Ctrl+Z.
 *
 * The three write choke points (`applySlidesUpdate` / `updateElement` /
 * `applyTheme`) all funnel through the same `pushHistory()`-before-mutate path
 * the manual editor uses, so an AI batch commits as one undoable entry. Unlike
 * the React bridge (whose count-based history auto-snapshot needs a nonce bump
 * for content-only edits), the Vue history is an explicit push-before-mutate
 * stack, so calling `pushHistory()` here is sufficient for text/style-only AI
 * writes to be captured.
 *
 * The returned bridge object identity is stable (created once, closing over the
 * reactive refs), so the chat session built from it in {@link useAiChat} is not
 * torn down and rebuilt on every keystroke.
 */
import { cloneSlide } from 'pptx-viewer-core';
import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { applyElementUpdate } from 'pptx-viewer-shared/ai';
import type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiFocusedTarget,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';
import type { Ref } from 'vue';

import { computeFocusTargets } from './focus-targets';

/** Live reactive inputs the bridge closes over. */
export interface UseAiBridgeInput {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	canvasSize: Ref<CanvasSize>;
	theme: Ref<PptxTheme | undefined>;
	handler: Ref<PptxHandler | null>;
	/** Display name of the open document, when known. */
	fileName: () => string | undefined;
	/** Snapshot the current slides onto the undo stack (call before mutating). */
	pushHistory: () => void;
	/** Flag the document dirty so autosave / status chrome updates. */
	markDirty: () => void;
	/** Navigate the viewer to a slide by zero-based index. */
	goTo: (index: number) => void;
	/** Replace the current element selection. */
	setSelection: (ids: string[]) => void;
	/** Route partial theme updates through the editor's theme handlers. */
	applyThemeUpdates: (updates: Partial<PptxTheme>) => void;
	/** All selected element ids on the active slide (drives live focus scope). */
	selectedElementIds?: () => string[];
	/** A pinned focus set from the chat (wins over the live selection). */
	pinnedFocus?: () => PptxAiFocusedTarget[] | null;
	/** Elements explicitly picked in pick mode (win over pin + selection). */
	pickedFocus?: () => PptxAiFocusedTarget[] | null;
	notify?: (message: string, level?: PptxAiNotifyLevel) => void;
}

export function useAiBridge(input: UseAiBridgeInput): PptxAiBridge {
	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, _label: string): void => {
		// Push the current state, then install a freshly-cloned, updater-mutated
		// slide array. The clone keeps the just-snapshotted slides untouched so a
		// single undo restores them faithfully.
		input.pushHistory();
		input.slides.value = updater(input.slides.value.map(cloneSlide));
		input.markDirty();
	};

	return {
		getDeckMeta(): PptxAiDeckMeta {
			const slides = input.slides.value;
			const firstTitle = slides[0]?.elements.find(
				(el) => 'text' in el && typeof el.text === 'string' && el.text.trim().length > 0,
			);
			return {
				slideCount: slides.length,
				activeSlideIndex: input.activeSlideIndex.value,
				title:
					input.fileName() ??
					(firstTitle && 'text' in firstTitle ? String(firstTitle.text) : undefined),
				width: input.canvasSize.value.width,
				height: input.canvasSize.value.height,
			};
		},
		getSlides: () => input.slides.value,
		getActiveSlideIndex: () => input.activeSlideIndex.value,
		getTheme: () => input.theme.value,
		getHandler: () => input.handler.value ?? undefined,
		goToSlide(index: number) {
			input.goTo(index);
		},
		selectElements(slideIndex: number, elementIds: string[]) {
			if (slideIndex !== input.activeSlideIndex.value) {
				input.goTo(slideIndex);
			}
			input.setSelection(elementIds);
		},
		applySlidesUpdate,
		updateElement(slideIndex: number, elementId: string, updates: PptxAiElementUpdate) {
			applySlidesUpdate((slides) => {
				const el = slides[slideIndex]?.elements.find((e) => e.id === elementId);
				if (el) {
					applyElementUpdate(el, updates);
				}
				return slides;
			}, `Update element ${elementId}`);
		},
		applyTheme(updates: Partial<PptxTheme>) {
			input.applyThemeUpdates(updates);
		},
		getFocusedTargets(): PptxAiFocusedTarget[] {
			// Explicit picks (pick mode) are the strongest signal of intent.
			const picked = input.pickedFocus?.();
			if (picked && picked.length > 0) {
				return picked;
			}
			// A pinned focus (set from the chat) wins over the live selection so the
			// assistant stays scoped even after the user clicks elsewhere.
			const pinned = input.pinnedFocus?.();
			if (pinned && pinned.length > 0) {
				return pinned;
			}
			const selectedIds = input.selectedElementIds?.() ?? [];
			return computeFocusTargets({
				activeSlideIndex: input.activeSlideIndex.value,
				selectedElementIds: selectedIds,
				selectedElementId: selectedIds[0] ?? null,
			});
		},
		notify(message: string, level?: PptxAiNotifyLevel) {
			input.notify?.(message, level);
		},
	};
}
