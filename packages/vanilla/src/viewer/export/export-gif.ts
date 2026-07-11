import type { GifFrame } from 'pptx-viewer-shared';
import {
	clampGifDimensions,
	downloadBlob,
	encodeGif,
	exportAbortError,
	planGifFrames,
} from 'pptx-viewer-shared';

import type { ExportCaptureDeps, ExportProgress } from './export-types';

/**
 * Animated-GIF export for the vanilla binding. All slides are captured (one
 * frame per slide) via the injected `rasterizeSlide`, then encoded with the
 * shared pure-JS GIF89a encoder (`pptx-viewer-shared` `gif-encoder`: median-cut
 * quantisation + LZW). Frame timing comes from the shared `planGifFrames`
 * planner and oversized captures are downscaled via `clampGifDimensions`; only
 * the DOM capture / canvas scaling / Blob download driver lives here.
 */

/** Options for the animated-GIF export (all slides, one frame per slide). */
export interface ExportGifOptions {
	/**
	 * Duration each slide is shown, in milliseconds (default 2000). Per-slide
	 * overrides can be supplied via {@link ExportGifOptions.slideTimingsMs}.
	 */
	slideDurationMs?: number;
	/**
	 * Per-slide duration overrides in milliseconds (index maps to slide index,
	 * e.g. rehearsed timings). Flows through the shared `planGifFrames` plan
	 * into per-frame GIF delays.
	 */
	slideTimingsMs?: number[];
	/**
	 * Cap on the longer side of the encoded frames, in pixels (default 1920).
	 * Captured canvases larger than this are downscaled before quantisation,
	 * keeping encode time and file size manageable.
	 */
	maxDimension?: number;
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Abort the export early; the capture loop checks this between slides. */
	signal?: AbortSignal;
}

/**
 * Extract a GIF frame (RGBA `ImageData`) from a captured slide canvas,
 * downscaling first when either side exceeds `maxDimension`. Every capture
 * shares the same slide canvas size, so all frames come out identical in
 * dimensions (an `encodeGif` requirement).
 */
function frameFromCanvas(canvas: HTMLCanvasElement, maxDimension: number): GifFrame {
	const { width, height } = clampGifDimensions(canvas.width, canvas.height, maxDimension);
	let source = canvas;
	if (width !== canvas.width || height !== canvas.height) {
		const scaled = canvas.ownerDocument.createElement('canvas');
		scaled.width = width;
		scaled.height = height;
		const scaledCtx = scaled.getContext('2d');
		if (!scaledCtx) {
			throw new Error('[pptx-vanilla-viewer] GIF export failed: 2D context unavailable');
		}
		scaledCtx.drawImage(canvas, 0, 0, width, height);
		source = scaled;
	}
	const ctx = source.getContext('2d');
	if (!ctx) {
		throw new Error('[pptx-vanilla-viewer] GIF export failed: 2D context unavailable');
	}
	return { imageData: ctx.getImageData(0, 0, width, height), width, height };
}

/**
 * Capture every slide, encode the frames as an animated GIF, and trigger a
 * `<baseName>.gif` download. No-op when the deck is empty. Throws the shared
 * `AbortError` when `signal` aborts between slide captures.
 */
export async function runGifExport(
	deps: ExportCaptureDeps,
	options: ExportGifOptions = {},
): Promise<void> {
	const {
		slideDurationMs = 2000,
		slideTimingsMs,
		maxDimension = 1920,
		onProgress,
		signal,
	} = options;
	const total = deps.store.get().slides.length;
	if (total === 0) {
		return;
	}

	const plans = planGifFrames({ totalSlides: total, slideDurationMs, slideTimingsMs });
	const frames: GifFrame[] = [];
	for (const plan of plans) {
		if (signal?.aborted) {
			throw exportAbortError();
		}
		onProgress?.(plan.slideIndex, total);
		const canvas = await deps.rasterizeSlide(plan.slideIndex);
		frames.push({ ...frameFromCanvas(canvas, maxDimension), delayCs: plan.delayCs });
	}

	const bytes = encodeGif(frames, plans[0].delayCs);
	onProgress?.(total, total);

	// Fresh ArrayBuffer copy to satisfy BlobPart typing (matches React/Angular).
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	downloadBlob(new Blob([buffer], { type: 'image/gif' }), `${deps.baseName}.gif`);
}
