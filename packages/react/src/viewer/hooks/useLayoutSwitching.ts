import type {
	PptxElement,
	PptxSlide,
	PptxLayoutOption,
	PptxLayoutPreview,
	PptxHandler,
} from 'pptx-viewer-core';
/**
 * useLayoutSwitching -- Hook for switching an existing slide's layout.
 *
 * Wraps the core `getAvailableLayoutsForSlide` and `applyLayoutToSlide`
 * APIs and exposes them as React-friendly callbacks with loading state.
 */
import { useState, useCallback, useRef } from 'react';

import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

/**
 * Input for {@link useLayoutSwitching}.
 */
export interface UseLayoutSwitchingInput {
	/** Current PPTX handler instance (may be null before load). */
	handler: PptxHandler | null;
	/** Current slides array. */
	slides: PptxSlide[];
	/** Index of the currently active slide. */
	activeSlideIndex: number;
	/** Element operations for updating the slides array. */
	ops: ElementOperations;
	/** Editor history for marking dirty state. */
	history: EditorHistoryResult;
	/**
	 * Called with the slide's refreshed layout / master artwork after a switch.
	 *
	 * The viewer keeps that artwork outside `slide.elements`, so nothing else
	 * would notice the relationship change and the canvas would keep painting the
	 * previous layout until the file was reopened.
	 */
	onTemplateElementsChanged?: (slideId: string, elements: PptxElement[]) => void;
}

/**
 * Result returned by {@link useLayoutSwitching}.
 */
export interface LayoutSwitchingResult {
	/** Available layouts for the active slide (populated after calling `loadAvailableLayouts`). */
	availableLayouts: PptxLayoutOption[];
	/** Whether a layout operation is in progress. */
	isLoading: boolean;
	/** Load the available layouts for the current slide. */
	loadAvailableLayouts: () => Promise<void>;
	/** Apply a layout to the active slide by its archive path. */
	applyLayout: (layoutPath: string) => Promise<void>;
	/**
	 * Build the artwork thumbnails the New Slide / Layout galleries draw.
	 *
	 * Deliberately a callback rather than state: parsing every layout is only
	 * worth doing once the user opens one of those menus, and core memoises the
	 * result so reopening costs nothing.
	 */
	loadLayoutPreviews: () => Promise<PptxLayoutPreview[]>;
	/** The current slide's layout path (if known). */
	currentLayoutPath: string | undefined;
}

/**
 * Hook that provides layout switching capabilities for the editor.
 *
 * @example
 * ```tsx
 * const { availableLayouts, applyLayout, loadAvailableLayouts } =
 *   useLayoutSwitching({ handler, slides, activeSlideIndex, ops, history });
 *
 * // Load layouts when the user opens a layout picker
 * await loadAvailableLayouts();
 *
 * // Switch to a different layout
 * await applyLayout("ppt/slideLayouts/slideLayout3.xml");
 * ```
 */
export function useLayoutSwitching(input: UseLayoutSwitchingInput): LayoutSwitchingResult {
	const { handler, slides, activeSlideIndex, ops, history, onTemplateElementsChanged } = input;

	const [availableLayouts, setAvailableLayouts] = useState<PptxLayoutOption[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	// Keep a ref to the latest slides so callbacks don't go stale
	const slidesRef = useRef(slides);
	slidesRef.current = slides;

	const currentLayoutPath = slides[activeSlideIndex]?.layoutPath;

	const loadAvailableLayouts = useCallback(async () => {
		if (!handler) {
			return;
		}
		setIsLoading(true);
		try {
			const layouts = await handler.getAvailableLayoutsForSlide(
				activeSlideIndex,
				slidesRef.current,
			);
			setAvailableLayouts(layouts);
		} finally {
			setIsLoading(false);
		}
		// `activeSlideIndex` IS read above (inside the `try`), but the analyzer
		// doesn't see through an `await` call wrapped in try/finally and flags it
		// as unused; verified as a false positive with a minimal repro.
		// oxlint-disable-next-line react/memo-dependencies -- see comment above
	}, [handler, activeSlideIndex]);

	const applyLayout = useCallback(
		async (layoutPath: string) => {
			if (!handler) {
				return;
			}
			setIsLoading(true);
			try {
				const updated = await handler.applyLayoutToSlide(
					activeSlideIndex,
					layoutPath,
					slidesRef.current,
				);
				// Replace the slide in the slides array via ops
				ops.updateSlides((prev) => {
					const next = [...prev];
					next[activeSlideIndex] = updated;
					return next;
				});
				if (onTemplateElementsChanged) {
					onTemplateElementsChanged(
						updated.id,
						await handler.getTemplateElementsForSlide(updated.id),
					);
				}
				history.markDirty();
			} finally {
				setIsLoading(false);
			}
		},
		// `activeSlideIndex` IS read above (inside the `try`), but the analyzer
		// doesn't see through an `await` call wrapped in try/finally and flags it
		// as unused; verified as a false positive with a minimal repro.
		// oxlint-disable-next-line react/memo-dependencies -- see comment above
		[handler, activeSlideIndex, ops, history, onTemplateElementsChanged],
	);

	const loadLayoutPreviews = useCallback(
		async () => (handler ? handler.getLayoutPreviews() : []),
		[handler],
	);

	return {
		availableLayouts,
		isLoading,
		loadAvailableLayouts,
		applyLayout,
		loadLayoutPreviews,
		currentLayoutPath,
	};
}
