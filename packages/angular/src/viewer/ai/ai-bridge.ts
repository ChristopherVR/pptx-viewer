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
import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';

import { applyElementUpdate } from '../../internal/shared-ai';
import type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
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
		notify(message: string, level?: PptxAiNotifyLevel): void {
			deps.notify?.(message, level);
		},
	};
}
