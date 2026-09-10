/**
 * Animated GIF export -- captures slides via the shared `foreignObject`
 * fidelity pipeline, tiling and stitching transparently past the browser
 * canvas cap instead of downscaling (see `renderElementToTiledCanvas`,
 * `html2canvas-pro` only as the documented fallback), downscales each
 * captured frame to the shared post-capture cap (`clampGifDimensions`, see
 * `resolveExportCaptureDecision` in `pptx-viewer-shared`), and encodes them
 * via the pure-JS GIF89a encoder in export-gif-encoder.ts.
 */
import { clampGifDimensions, GIF_POST_CAPTURE_MAX_SIDE } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { encodeGif } from './export-gif-encoder';
import type { ExportProgressCallback } from './export-helpers';
import { renderElementToTiledCanvas, waitForRender } from './export-helpers';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Options for GIF export. */
export interface GifExportOptions {
	/** Render scale multiplier for each slide capture (default 0.5 = 50%). */
	scale?: number;
	/** Duration in milliseconds each slide is displayed (default 2000). */
	slideDurationMs?: number;
	/**
	 * Longest allowed frame side in pixels after capture; a captured canvas
	 * larger than this is downscaled before quantisation (GIF encoding cost
	 * grows with pixel count). Defaults to the shared
	 * `GIF_POST_CAPTURE_MAX_SIDE` (see `resolveExportCaptureDecision`'s
	 * `postCaptureMaxSide` for the `'gif'` format).
	 */
	maxSide?: number;
	/** Progress callback: (currentSlide, totalSlides). */
	onProgress?: ExportProgressCallback;
	/** AbortSignal to cancel the export. */
	signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/*  GIF Export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Downscale a captured slide canvas to `maxSide` (via `clampGifDimensions`)
 * and extract its RGBA pixels. Mirrors the vanilla/Svelte bindings' own
 * frame-extraction helpers: the DOM canvas-draw + `getImageData` glue stays
 * per-binding, only the dimension math (`clampGifDimensions`) is shared.
 */
function frameFromCanvas(
	canvas: HTMLCanvasElement,
	maxSide: number,
): { imageData: ImageData; width: number; height: number } | undefined {
	const { width, height } = clampGifDimensions(canvas.width, canvas.height, maxSide);
	let source = canvas;
	if (width !== canvas.width || height !== canvas.height) {
		const scaled = canvas.ownerDocument.createElement('canvas');
		scaled.width = width;
		scaled.height = height;
		const scaledCtx = scaled.getContext('2d');
		if (!scaledCtx) {
			return undefined;
		}
		scaledCtx.drawImage(canvas, 0, 0, width, height);
		source = scaled;
	}
	const ctx = source.getContext('2d');
	if (!ctx) {
		return undefined;
	}
	return { imageData: ctx.getImageData(0, 0, width, height), width, height };
}

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
	const {
		scale = 0.5,
		slideDurationMs = 2000,
		maxSide = GIF_POST_CAPTURE_MAX_SIDE,
		onProgress,
		signal,
	} = options;

	// Step 1: Capture all slides as ImageData
	const frames: { imageData: ImageData; width: number; height: number }[] = [];

	for (let i = 0; i < totalSlides; i++) {
		if (signal?.aborted) {
			throw new DOMException('Export cancelled', 'AbortError');
		}
		onProgress?.(i, totalSlides);

		setActiveSlide(i);
		await waitForRender(150);

		const stageEl = slideStageRef.current;
		if (!stageEl) {
			continue;
		}

		const { canvas } = await renderElementToTiledCanvas(stageEl, scale);
		const frame = frameFromCanvas(canvas, maxSide);
		if (!frame) {
			continue;
		}
		frames.push(frame);
	}

	setActiveSlide(currentSlideIndex);

	if (frames.length === 0) {
		throw new Error(translationsEn['pptx.export.errorNoSlidesGif']);
	}

	// Step 2: Encode as GIF
	const gifBytes = encodeGif(frames, Math.round(slideDurationMs / 10));

	onProgress?.(totalSlides, totalSlides);

	// Create a fresh ArrayBuffer copy to satisfy BlobPart typing
	const buf = new ArrayBuffer(gifBytes.length);
	new Uint8Array(buf).set(gifBytes);
	return new Blob([buf], { type: 'image/gif' });
}
