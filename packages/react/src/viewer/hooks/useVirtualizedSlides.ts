/**
 * useVirtualizedSlides — Virtual scrolling for the slide panel sidebar.
 *
 * Calculates the visible range of slides based on the scroll container's
 * scroll position and viewport height, then returns only the indices
 * that should be rendered. An overscan buffer ensures smooth scrolling
 * by pre-rendering items just outside the viewport.
 *
 * @module useVirtualizedSlides
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Number of items to render outside the visible viewport on each side. */
const DEFAULT_OVERSCAN = 5;

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

export interface VirtualizedRange {
  /** The first index to render (inclusive). */
  startIndex: number;
  /** The last index to render (inclusive). */
  endIndex: number;
  /** Total height of the virtual container (for scrollbar sizing). */
  totalHeight: number;
  /** Offset (top padding) to position the rendered window correctly. */
  offsetY: number;
  /** The visible range without overscan (for analytics/testing). */
  visibleRange: { start: number; end: number };
}

export interface VirtualizedSlidesResult extends VirtualizedRange {
  /** Ref to attach to the scroll container element. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Call this to scroll a specific index into view. */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

/* ------------------------------------------------------------------ */
/*  Pure computation (exported for testing)                            */
/* ------------------------------------------------------------------ */

/**
 * Compute the rendered index range given scroll state and item dimensions.
 *
 * This is a pure function with no React or DOM dependencies so it can
 * be unit-tested without `renderHook` or a DOM environment.
 */
export function computeVirtualRange(
  totalItems: number,
  itemHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan: number = DEFAULT_OVERSCAN,
): VirtualizedRange {
  const safeItemHeight = Math.max(itemHeight, 1);
  const totalHeight = totalItems * safeItemHeight;

  if (totalItems === 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      totalHeight: 0,
      offsetY: 0,
      visibleRange: { start: 0, end: -1 },
    };
  }

  // Visible range (no overscan)
  const visibleStart = Math.floor(scrollTop / safeItemHeight);
  const visibleEnd = Math.min(
    totalItems - 1,
    Math.floor((scrollTop + viewportHeight) / safeItemHeight),
  );

  // Rendered range (with overscan)
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(totalItems - 1, visibleEnd + overscan);

  const offsetY = startIndex * safeItemHeight;

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    visibleRange: { start: visibleStart, end: visibleEnd },
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useVirtualizedSlides({
  totalItems,
  itemHeight,
  overscan = DEFAULT_OVERSCAN,
}: VirtualizedSlidesOptions): VirtualizedSlidesResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // ── Observe scroll position ──
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    // Set initial viewport height
    setViewportHeight(container.clientHeight);
    setScrollTop(container.scrollTop);

    container.addEventListener("scroll", handleScroll, { passive: true });

    // Observe container resize for accurate viewport height
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setViewportHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, []);

  // ── Calculate visible range ──
  const range = computeVirtualRange(
    totalItems,
    itemHeight,
    scrollTop,
    viewportHeight,
    overscan,
  );

  const safeItemHeight = Math.max(itemHeight, 1);

  // ── Scroll to index ──
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = scrollContainerRef.current;
      if (!container) return;

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
