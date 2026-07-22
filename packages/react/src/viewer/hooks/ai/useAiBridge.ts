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
	PptxAiFocusedTarget,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';
import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';

import { applyAiElementUpdate } from './ai-element-update';
import { computeFocusTargets } from './focus-targets';

/** Live inputs the bridge closes over. Updated on every render via a ref. */
export interface UseAiBridgeInput {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: { width: number; height: number };
	theme: PptxTheme | undefined;
	fileName?: string;
	/** Primary selected element id on the active slide (null when none). */
	selectedElementId: string | null;
	/** All selected element ids on the active slide (multi-select, tables incl). */
	selectedElementIds: string[];
	/**
	 * When the user pins a focus in the chat, these override the live selection
	 * for {@link PptxAiBridge.getFocusedTargets}; null means "follow selection".
	 */
	pinnedFocus: PptxAiFocusedTarget[] | null;
	/**
	 * Elements the user explicitly picked (pick mode). When non-empty these are
	 * the assistant's focus, winning over a pin and the live selection.
	 */
	pickedFocus?: PptxAiFocusedTarget[] | null;
	handlerRef: RefObject<PptxHandler | null>;
	// Presentation-level state, exposed so the AI's `getDeckData`/`applyDeckData`
	// seam can read and commit metadata / sections / canvas size / presentation
	// properties (the pptx-viewer-mcp "deck" tools). Slide + theme tools do not
	// need these; they route through applySlidesUpdate / applyTheme.
	sections: PptxSection[];
	presentationProperties: PptxPresentationProperties;
	customProperties: PptxCustomProperty[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	setCanvasSize: (size: { width: number; height: number }) => void;
	setSections: (sections: PptxSection[]) => void;
	setPresentationProperties: (props: PptxPresentationProperties) => void;
	setCustomProperties: (props: PptxCustomProperty[]) => void;
	setCoreProperties: (props: PptxCoreProperties | undefined) => void;
	setAppProperties: (props: PptxAppProperties | undefined) => void;
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

		/** Reconstruct the presentation-level PptxData the AI deck tools read/write. */
		const readDeckData = (live: UseAiBridgeInput): PptxData =>
			({
				slides: live.slides,
				width: live.canvasSize.width,
				height: live.canvasSize.height,
				theme: live.theme,
				sections: live.sections,
				presentationProperties: live.presentationProperties,
				customProperties: live.customProperties,
				coreProperties: live.coreProperties,
				appProperties: live.appProperties,
			}) satisfies Partial<PptxData> as PptxData;

		const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

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
			getDeckData(): PptxData {
				return readDeckData(ref.current);
			},
			applyDeckData(updater: PptxAiDataUpdater, _label: string) {
				const live = ref.current;
				const before = readDeckData(live);
				const after = updater(structuredClone(before));
				// Slides and canvas size are captured by the undo history; the other
				// presentation-level fields persist into the save model and re-render,
				// but are not yet individually undoable (a history-snapshot follow-up).
				if (differs(before.slides, after.slides)) {
					live.setSlides(() => after.slides);
					live.bumpHistory();
				}
				if (before.width !== after.width || before.height !== after.height) {
					live.setCanvasSize({ width: after.width, height: after.height });
				}
				const nextSections = after.sections ?? before.sections ?? [];
				if (differs(before.sections, nextSections)) {
					live.setSections(nextSections);
				}
				const nextPresProps = after.presentationProperties ?? live.presentationProperties;
				if (differs(before.presentationProperties, nextPresProps)) {
					live.setPresentationProperties(nextPresProps);
				}
				const nextCustomProps = after.customProperties ?? before.customProperties ?? [];
				if (differs(before.customProperties, nextCustomProps)) {
					live.setCustomProperties(nextCustomProps);
				}
				if (differs(before.coreProperties, after.coreProperties)) {
					live.setCoreProperties(after.coreProperties);
				}
				if (differs(before.appProperties, after.appProperties)) {
					live.setAppProperties(after.appProperties);
				}
				live.markDirty();
			},
			getFocusedTargets(): PptxAiFocusedTarget[] {
				const live = ref.current;
				// Explicit picks (pick mode) are the strongest signal of intent.
				if (live.pickedFocus && live.pickedFocus.length > 0) {
					return live.pickedFocus;
				}
				// A pinned focus (set from the chat) wins over the live selection so
				// the assistant stays scoped even after the user clicks elsewhere.
				if (live.pinnedFocus && live.pinnedFocus.length > 0) {
					return live.pinnedFocus;
				}
				return computeFocusTargets({
					activeSlideIndex: live.activeSlideIndex,
					selectedElementIds: live.selectedElementIds,
					selectedElementId: live.selectedElementId,
				});
			},
			notify(message: string, level?: PptxAiNotifyLevel) {
				ref.current.notify?.(message, level);
			},
		};
	}, []);
}
