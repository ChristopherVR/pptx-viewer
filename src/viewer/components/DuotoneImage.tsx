/**
 * React component that renders an image with the `<a:duotone>` effect
 * applied via an offscreen canvas (true per-pixel luminance mapping).
 *
 * Processing is asynchronous — the original image is shown briefly while the
 * canvas work completes, then the processed image replaces it. Results are
 * cached so subsequent renders are instant.
 */
import React, { useEffect, useState } from "react";

import type { PptxImageEffects } from "../../core";
import {
  applyDuotone,
  buildDuotoneCacheKey,
  getDuotoneCachedResult,
  setDuotoneCachedResult,
} from "../utils/duotone-effects";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DuotoneImageProps {
  /** Original image data-URL (or blob URL). */
  src: string;
  /** The parsed duotone effect from PptxImageEffects. */
  duotone: NonNullable<PptxImageEffects["duotone"]>;
  /** Extra CSS styles applied to the `<img>` tag. */
  style?: React.CSSProperties;
  /** CSS class names for the `<img>` tag. */
  className?: string;
  /** Alt text. */
  alt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DuotoneImage({
  src,
  duotone,
  style,
  className,
  alt,
}: DuotoneImageProps): React.ReactElement {
  const cacheKey = buildDuotoneCacheKey(src, duotone.color1, duotone.color2);

  const cached = getDuotoneCachedResult(cacheKey);
  const [processedSrc, setProcessedSrc] = useState<string | null>(
    cached ?? null,
  );

  useEffect(() => {
    // Already cached — nothing to do.
    const cachedResult = getDuotoneCachedResult(cacheKey);
    if (cachedResult) {
      setProcessedSrc(cachedResult);
      return;
    }

    let cancelled = false;

    applyDuotone(src, duotone.color1, duotone.color2)
      .then((result) => {
        if (!cancelled) {
          setDuotoneCachedResult(cacheKey, result.dataUrl);
          setProcessedSrc(result.dataUrl);
        }
      })
      .catch(() => {
        // On failure, fall back to the original image (already the
        // initial state when there's no cache hit).
      });

    return () => {
      cancelled = true;
    };
  }, [src, cacheKey, duotone.color1, duotone.color2]);

  return (
    <img
      src={processedSrc ?? src}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
