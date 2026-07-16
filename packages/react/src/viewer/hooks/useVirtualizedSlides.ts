/**
 * useVirtualizedSlides: Virtual scrolling for the slide panel sidebar.
 *
 * Calculates the visible range of slides based on the scroll container's
 * scroll position and viewport height, then returns only the indices
 * that should be rendered. An overscan buffer ensures smooth scrolling
 * by pre-rendering items just outside the viewport.
 *
 * @module useVirtualizedSlides
 */
import { computeVirtualRange, DEFAULT_VIRTUAL_OVERSCAN } from 'pptx-viewer-shared';
import type { VirtualizedRange } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export { computeVirtualRange } from 'pptx-viewer-shared';
export type { VirtualizedRange } from 'pptx-viewer-shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VirtualizedSlidesOptions {
	/** Total number of slide items. */
	totalItems: number;
	/** Estimated height of each slide item in pixels. */
	itemHeight: number;
	/** Number of extra items to render above/below the viewport. */
	overscan?: number;
}

export interface VirtualizedSlidesResult extends VirtualizedRange {
	/** Ref to attach to the scroll container element. */
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	/** Call this to scroll a specific index into view. */
	scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useVirtualizedSlides({
	totalItems,
	itemHeight,
	overscan = DEFAULT_VIRTUAL_OVERSCAN,
}: VirtualizedSlidesOptions): VirtualizedSlidesResult {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);

	// ── Observe scroll position ──
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		const handleScroll = () => {
			setScrollTop(container.scrollTop);
		};

		// Set initial viewport height
		setViewportHeight(container.clientHeight);
		setScrollTop(container.scrollTop);

		container.addEventListener('scroll', handleScroll, { passive: true });

		// Observe container resize for accurate viewport height
		let resizeObserver: ResizeObserver | undefined;
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					setViewportHeight(entry.contentRect.height);
				}
			});
			resizeObserver.observe(container);
		}

		return () => {
			container.removeEventListener('scroll', handleScroll);
			resizeObserver?.disconnect();
		};
	}, []);

	// ── Calculate visible range ──
	const range = computeVirtualRange(totalItems, itemHeight, scrollTop, viewportHeight, overscan);

	const safeItemHeight = Math.max(itemHeight, 1);

	// ── Scroll to index ──
	const scrollToIndex = useCallback(
		(index: number, behavior: ScrollBehavior = 'smooth') => {
			const container = scrollContainerRef.current;
			if (!container) {
				return;
			}

			const targetTop = index * safeItemHeight;
			const targetBottom = targetTop + safeItemHeight;
			const containerTop = container.scrollTop;
			const containerBottom = containerTop + container.clientHeight;

			// Only scroll if the target is not fully visible
			if (targetTop < containerTop) {
				container.scrollTo({ top: targetTop, behavior });
			} else if (targetBottom > containerBottom) {
				container.scrollTo({
					top: targetBottom - container.clientHeight,
					behavior,
				});
			}
		},
		[safeItemHeight],
	);

	return {
		...range,
		scrollContainerRef,
		scrollToIndex,
	};
}
