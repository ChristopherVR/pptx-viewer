/**
 * Animated GIF export -- captures slides and encodes them via the
 * pure-JS GIF89a encoder in export-gif-encoder.ts.
 */
import React from "react";

import type { ExportProgressCallback } from "./export-helpers";
import { renderElementToCanvas, waitForRender } from "./export-helpers";
import { encodeGif } from "./export-gif-encoder";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Options for GIF export. */
export interface GifExportOptions {
  /** Render scale multiplier for each slide capture (default 0.5 = 50%). */
  scale?: number;
  /** Duration in milliseconds each slide is displayed (default 2000). */
  slideDurationMs?: number;
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
  /** AbortSignal to cancel the export. */
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/*  GIF Export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Export all slides as an animated GIF blob.
 *
 * Uses a minimal pure-JS GIF encoder (median-cut quantization + LZW).
 */
export async function exportAllSlidesAsGif(
  slideStageRef: React.RefObject<HTMLElement | null>,
  totalSlides: number,
  setActiveSlide: (index: number) => void,
  currentSlideIndex: number,
  options: GifExportOptions = {},
): Promise<Blob> {
  const { scale = 0.5, slideDurationMs = 2000, onProgress, signal } = options;

  // Step 1: Capture all slides as ImageData
  const frames: { imageData: ImageData; width: number; height: number }[] = [];

  for (let i = 0; i < totalSlides; i++) {
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
    onProgress?.(i, totalSlides);

    setActiveSlide(i);
    await waitForRender(150);

    const stageEl = slideStageRef.current;
    if (!stageEl) continue;

    const canvas = await renderElementToCanvas(stageEl, scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    frames.push({
      imageData,
      width: canvas.width,
      height: canvas.height,
    });
  }

  setActiveSlide(currentSlideIndex);

  if (frames.length === 0) {
    throw new Error("No slides were captured for GIF export");
  }

  // Step 2: Encode as GIF
  const gifBytes = encodeGif(frames, Math.round(slideDurationMs / 10));

  onProgress?.(totalSlides, totalSlides);

  // Create a fresh ArrayBuffer copy to satisfy BlobPart typing
  const buf = new ArrayBuffer(gifBytes.length);
  new Uint8Array(buf).set(gifBytes);
  return new Blob([buf], { type: "image/gif" });
}
