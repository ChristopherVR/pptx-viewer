/**
 * Video (WebM) export via MediaRecorder + captureStream().
 */
import React from "react";

import type { ExportProgressCallback } from "./export-helpers";
import { renderElementToCanvas, waitForRender } from "./export-helpers";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Options for video (WebM) export. */
export interface VideoExportOptions {
  /** Render scale multiplier for each slide capture (default 1). */
  scale?: number;
  /** Duration in milliseconds each slide is displayed (default 3000). */
  slideDurationMs?: number;
  /** Per-slide timing overrides (rehearsed timings). Index maps to slide index. */
  slideTimingsMs?: number[];
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
  /** AbortSignal to cancel the export. */
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/*  Video Export                                                      */
/* ------------------------------------------------------------------ */

/**
 * Export all slides as a WebM video blob.
 *
 * Strategy: Render each slide to a canvas via html2canvas, then draw
 * each frame onto a recording canvas using captureStream() + MediaRecorder.
 * Each slide is held for its configured duration.
 */
export async function exportAllSlidesAsVideo(
  slideStageRef: React.RefObject<HTMLElement | null>,
  totalSlides: number,
  setActiveSlide: (index: number) => void,
  currentSlideIndex: number,
  options: VideoExportOptions = {},
): Promise<Blob> {
  const {
    scale = 1,
    slideDurationMs = 3000,
    slideTimingsMs,
    onProgress,
    signal,
  } = options;

  // Step 1: Capture all slides as canvases
  const slideCanvases: HTMLCanvasElement[] = [];

  for (let i = 0; i < totalSlides; i++) {
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
    onProgress?.(i, totalSlides);

    setActiveSlide(i);
    await waitForRender(150);

    const stageEl = slideStageRef.current;
    if (!stageEl) {
      console.warn(
        `[export] Could not find slide stage element for slide ${i}`,
      );
      continue;
    }

    const canvas = await renderElementToCanvas(stageEl, scale);
    slideCanvases.push(canvas);
  }

  // Restore the user's original slide
  setActiveSlide(currentSlideIndex);

  if (slideCanvases.length === 0) {
    throw new Error("No slides were captured for video export");
  }

  // Step 2: Create a recording canvas and start MediaRecorder
  const firstCanvas = slideCanvases[0];
  const recordingCanvas = document.createElement("canvas");
  recordingCanvas.width = firstCanvas.width;
  recordingCanvas.height = firstCanvas.height;
  const ctx = recordingCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create 2D context for video recording");

  const stream = recordingCanvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 5_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recorderDone = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Step 3: Draw each slide for its duration
  for (let i = 0; i < slideCanvases.length; i++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new DOMException("Export cancelled", "AbortError");
    }

    const duration = slideTimingsMs?.[i] ?? slideDurationMs;
    ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
    ctx.drawImage(slideCanvases[i], 0, 0);

    // Hold the frame for the slide duration using a sleep loop
    // that triggers redraws to feed the captureStream.
    const frameInterval = 33; // ~30fps
    const framesNeeded = Math.ceil(duration / frameInterval);
    for (let f = 0; f < framesNeeded; f++) {
      if (signal?.aborted) {
        recorder.stop();
        throw new DOMException("Export cancelled", "AbortError");
      }
      // Redraw the same frame to feed the stream
      ctx.drawImage(slideCanvases[i], 0, 0);
      await new Promise<void>((r) => setTimeout(r, frameInterval));
    }
  }

  recorder.stop();
  await recorderDone;

  onProgress?.(totalSlides, totalSlides);

  return new Blob(chunks, { type: "video/webm" });
}
