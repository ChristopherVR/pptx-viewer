/**
 * React component that renders an image with the `<a:clrChange>` colour
 * replacement effect applied via an offscreen canvas.
 *
 * Processing is asynchronous — the original image is shown briefly while the
 * canvas work completes, then the processed image replaces it. Results are
 * cached so subsequent renders are instant.
 */
import React, { useEffect, useState } from "react";

import type { PptxImageEffects } from "../../core";
import {
  applyColorChange,
  buildCacheKey,
  getCachedResult,
  setCachedResult,
  DEFAULT_COLOR_CHANGE_TOLERANCE,
} from "../utils/image-effects";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColorChangedImageProps {
  /** Original image data-URL (or blob URL). */
  src: string;
  /** The parsed clrChange effect from PptxImageEffects. */
  clrChange: NonNullable<PptxImageEffects["clrChange"]>;
  /** Tolerance percentage (0–100). Falls back to the element default or 12. */
  tolerancePct?: number;
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

export function ColorChangedImage({
  src,
  clrChange,
  tolerancePct,
  style,
  className,
  alt,
}: ColorChangedImageProps): React.ReactElement {
  const tolerance = tolerancePct ?? DEFAULT_COLOR_CHANGE_TOLERANCE;
  const cacheKey = buildCacheKey(
    src,
    clrChange.clrFrom,
    clrChange.clrTo,
    tolerance,
    Boolean(clrChange.clrToTransparent),
  );

  const cached = getCachedResult(cacheKey);
  const [processedSrc, setProcessedSrc] = useState<string | null>(
    cached ?? null,
  );

  useEffect(() => {
    // Already cached — nothing to do.
    if (getCachedResult(cacheKey)) {
      setProcessedSrc(getCachedResult(cacheKey) ?? null);
      return;
    }

    let cancelled = false;

    applyColorChange(
      src,
      clrChange.clrFrom,
      clrChange.clrTo,
      tolerance,
      Boolean(clrChange.clrToTransparent),
    )
      .then((result) => {
        if (!cancelled) {
          setCachedResult(cacheKey, result.dataUrl);
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
  }, [
    src,
    cacheKey,
    clrChange.clrFrom,
    clrChange.clrTo,
    tolerance,
    clrChange.clrToTransparent,
  ]);

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
