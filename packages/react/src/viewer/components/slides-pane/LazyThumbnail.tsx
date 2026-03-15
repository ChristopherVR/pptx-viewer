/**
 * LazyThumbnail — Defers rendering of a SlideThumbnail until its
 * container enters (or is near) the viewport.
 *
 * Uses IntersectionObserver with a generous rootMargin so thumbnails
 * are rendered slightly before they scroll into view, preventing
 * visible pop-in during normal scrolling.
 *
 * Once a thumbnail has been rendered, it stays rendered (no unloading)
 * to avoid re-creating expensive DOM subtrees when the user scrolls back.
 */
import React, { useEffect, useRef, useState } from "react";

import type { PptxSlide } from "pptx-viewer-core";
import type { CanvasSize } from "../../types";
import { SlideThumbnail } from "../SlideThumbnail";
import { SLIDE_NAV_THUMBNAIL_WIDTH } from "../../constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LazyThumbnailProps {
  slide: PptxSlide;
  canvasSize: CanvasSize;
  /** Pre-computed preview height so the placeholder matches exactly. */
  previewHeight: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LazyThumbnailInner({
  slide,
  canvasSize,
  previewHeight,
}: LazyThumbnailProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If IntersectionObserver isn't available, render immediately
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          // Once visible, stop observing — we don't unload thumbnails
          observer.disconnect();
        }
      },
      {
        // Pre-render thumbnails 200px before they enter the viewport
        rootMargin: "200px 0px",
      },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        <SlideThumbnail
          slide={slide}
          templateElements={[]}
          canvasSize={canvasSize}
        />
      ) : (
        <div
          className="relative w-full overflow-hidden rounded border border-border bg-muted/30 animate-pulse"
          style={{
            height: previewHeight,
            minWidth: SLIDE_NAV_THUMBNAIL_WIDTH,
          }}
        />
      )}
    </div>
  );
}

export const LazyThumbnail = React.memo(LazyThumbnailInner);
