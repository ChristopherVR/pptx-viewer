import type { GifFrame } from 'pptx-viewer-shared';
import { clampGifDimensions, encodeGif, exportAbortError, planGifFrames } from 'pptx-viewer-shared';

import type { ExportProgress, RasterizeSlide } from './export-controller.svelte';

/**
 * Animated-GIF export capture/encode pipeline. All the pure logic is shared:
 * `planGifFrames` derives the per-slide frame delays (default duration +
 * per-slide overrides), `clampGifDimensions` bounds the output size, and
 * `encodeGif` (median-cut quantisation + LZW GIF89a) produces the bytes with
 * each frame carrying its own plan delay. This module only owns the
 * DOM-adjacent glue: rasterising each slide via the injected capture callback
 * and normalising every frame onto a uniform-size canvas before pixel
 * extraction. Blob download is left to the caller (`ExportController`).
 */

/** Options for the animated-GIF export. */
export interface ExportGifOptions {
	/** Duration each slide is shown, in milliseconds. Default 2000. */
	slideDurationMs?: number;
	/** Per-slide duration overrides in milliseconds (index maps to slide index). */
	slideTimingsMs?: number[];
	/**
	 * Longest allowed output side in pixels; frames are scaled down
	 * proportionally. Default 960 (GIF encoding cost grows with pixel count:
	 * every pixel is matched against a 256-colour palette per frame).
	 */
	maxDimension?: number;
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Abort the export early; checked before each slide capture. */
	signal?: AbortSignal;
}

/** Injected capture dependencies (kept DOM-free for unit tests). */
export interface GifCaptureDeps {
	/** Live slide count; read fresh on every call. */
	getSlideCount(): number;
	rasterizeSlide: RasterizeSlide;
	/** Canvas factory override (test seam). Defaults to `document.createElement`. */
	createCanvas?: (width: number, height: number) => HTMLCanvasElement;
}

function defaultCreateCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/**
 * Draw `source` onto a fresh canvas of `width`x`height` and extract its RGBA
 * pixels. Routing every frame through the same target size guarantees the
 * uniform frame dimensions the GIF encoder requires, and applies the
 * `clampGifDimensions` downscale in the same step.
 */
function extractFramePixels(
	source: HTMLCanvasElement,
	width: number,
	height: number,
	createCanvas: (width: number, height: number) => HTMLCanvasElement,
): ImageData {
	const target = createCanvas(width, height);
	const ctx = target.getContext('2d');
	if (!ctx) {
		throw new Error('GIF export failed: 2D canvas context unavailable');
	}
	ctx.drawImage(source, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height);
}

/**
 * Capture every slide and encode the sequence as an animated GIF Blob.
 * Rejects with the shared `AbortError` when `signal` aborts between slides.
 */
export async function exportSlidesToGifBlob(
	deps: GifCaptureDeps,
	options: ExportGifOptions = {},
): Promise<Blob> {
	const {
		slideDurationMs = 2000,
		slideTimingsMs,
		maxDimension = 960,
		onProgress,
		signal,
	} = options;
	const total = deps.getSlideCount();
	if (total === 0) {
		throw new Error('GIF export failed: no slides to export');
	}
	const createCanvas = deps.createCanvas ?? defaultCreateCanvas;
	const plans = planGifFrames({ totalSlides: total, slideDurationMs, slideTimingsMs });

	const frames: GifFrame[] = [];
	let frameWidth = 0;
	let frameHeight = 0;
	for (const plan of plans) {
		if (signal?.aborted) {
			throw exportAbortError();
		}
		onProgress?.(plan.slideIndex, total);
		const canvas = await deps.rasterizeSlide(plan.slideIndex);
		if (frameWidth === 0) {
			({ width: frameWidth, height: frameHeight } = clampGifDimensions(
				canvas.width,
				canvas.height,
				maxDimension,
			));
		}
		frames.push({
			imageData: extractFramePixels(canvas, frameWidth, frameHeight, createCanvas),
			width: frameWidth,
			height: frameHeight,
			delayCs: plan.delayCs,
		});
	}

	const gifBytes = encodeGif(frames);
	onProgress?.(total, total);

	// Copy into a fresh ArrayBuffer to satisfy the BlobPart typing.
	const buf = new ArrayBuffer(gifBytes.length);
	new Uint8Array(buf).set(gifBytes);
	return new Blob([buf], { type: 'image/gif' });
}
