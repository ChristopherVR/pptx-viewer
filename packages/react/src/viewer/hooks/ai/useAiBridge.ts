/**
 * useAiBridge: builds a stable {@link PptxAiBridge} that lets the
 * framework-agnostic AI core (`pptx-viewer-shared/ai`) read the open deck,
 * navigate it, and route edits through the React editor-history layer so every
 * AI change is a single Ctrl+Z.
 *
 * The bridge identity is kept stable across renders (its methods read live
 * values from a ref) so the chat session built from it in {@link useAiChat} is
 * not torn down and rebuilt on every keystroke.
 */
import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';
import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';

import { applyAiElementUpdate } from './ai-element-update';

/** Live inputs the bridge closes over. Updated on every render via a ref. */
export interface UseAiBridgeInput {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: { width: number; height: number };
	theme: PptxTheme | undefined;
	fileName?: string;
	handlerRef: RefObject<PptxHandler | null>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setActiveSlideIndex: (index: number) => void;
	applySelection: (primaryId: string | null, ids?: string[]) => void;
	/** Force the history stack to capture the next slides change (content-only edits). */
	bumpHistory: () => void;
	markDirty: () => void;
	/** Route partial theme updates through the editor's theme handlers. */
	applyThemeUpdates: (updates: Partial<PptxTheme>) => void;
	notify?: (message: string, level?: PptxAiNotifyLevel) => void;
}

export function useAiBridge(input: UseAiBridgeInput): PptxAiBridge {
	const ref = useRef(input);
	ref.current = input;

	return useMemo<PptxAiBridge>(() => {
		const applySlidesUpdate = (updater: PptxAiSlidesUpdater, _label: string): void => {
			const live = ref.current;
			live.setSlides((prev) => updater(structuredClone(prev)));
			// Content-only edits (text/style) do not change slide/element counts,
			// so nudge the history nonce to force the snapshot capture that makes
			// the AI edit a single undoable entry.
			live.bumpHistory();
			live.markDirty();
		};

		return {
			getDeckMeta(): PptxAiDeckMeta {
				const live = ref.current;
				const firstTitle = live.slides[0]?.elements.find(
					(el) => 'text' in el && typeof el.text === 'string' && el.text.trim().length > 0,
				);
				return {
					slideCount: live.slides.length,
					activeSlideIndex: live.activeSlideIndex,
					title:
						live.fileName ??
						(firstTitle && 'text' in firstTitle ? String(firstTitle.text) : undefined),
					width: live.canvasSize.width,
					height: live.canvasSize.height,
				};
			},
			getSlides: () => ref.current.slides,
			getActiveSlideIndex: () => ref.current.activeSlideIndex,
			getTheme: () => ref.current.theme,
			getHandler: () => ref.current.handlerRef.current ?? undefined,
			goToSlide(index: number) {
				ref.current.setActiveSlideIndex(index);
			},
			selectElements(slideIndex: number, elementIds: string[]) {
				const live = ref.current;
				if (slideIndex !== live.activeSlideIndex) {
					live.setActiveSlideIndex(slideIndex);
				}
				live.applySelection(elementIds[0] ?? null, elementIds);
			},
			applySlidesUpdate,
			updateElement(slideIndex: number, elementId: string, updates: PptxAiElementUpdate) {
				applySlidesUpdate((slides) => {
					const el = slides[slideIndex]?.elements.find((e) => e.id === elementId);
					if (el) {
						applyAiElementUpdate(el, updates);
					}
					return slides;
				}, `Update element ${elementId}`);
			},
			applyTheme(updates: Partial<PptxTheme>) {
				ref.current.applyThemeUpdates(updates);
			},
			notify(message: string, level?: PptxAiNotifyLevel) {
				ref.current.notify?.(message, level);
			},
		};
	}, []);
}
