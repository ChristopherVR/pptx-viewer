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
	/** Callback ref for the scroll container; re-wires scroll tracking whenever it mounts. */
	scrollContainerRef: (el: HTMLDivElement | null) => void;
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
	const containerElRef = useRef<HTMLDivElement | null>(null);
	// The container is tracked in state, not only in a ref: the rail renders it
	// only while open, so it can mount after this hook's first effect. A
	// mount-once effect then never saw it, the viewport stayed 0 px tall and
	// the rail never rendered past its first dozen thumbnails.
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const scrollContainerRef = useCallback((el: HTMLDivElement | null) => {
		containerElRef.current = el;
		setContainer(el);
	}, []);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);

	// ── Observe scroll position ──
	useEffect(() => {
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
	}, [container]);

	// ── Calculate visible range ──
	const range = computeVirtualRange(totalItems, itemHeight, scrollTop, viewportHeight, overscan);

	const safeItemHeight = Math.max(itemHeight, 1);

	// ── Scroll to index ──
	const scrollToIndex = useCallback(
		(index: number, behavior: ScrollBehavior = 'smooth') => {
			const el = containerElRef.current;
			if (!el) {
				return;
			}

			const targetTop = index * safeItemHeight;
			const targetBottom = targetTop + safeItemHeight;
			const containerTop = el.scrollTop;
			const containerBottom = containerTop + el.clientHeight;

			// Only scroll if the target is not fully visible
			if (targetTop < containerTop) {
				el.scrollTo({ top: targetTop, behavior });
			} else if (targetBottom > containerBottom) {
				el.scrollTo({
					top: targetBottom - el.clientHeight,
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
