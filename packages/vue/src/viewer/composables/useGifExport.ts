/* oxlint-disable eslint/one-var -- matches useMediaExport.ts's pervasive
   pattern of several independent short-lived `const`s per export step. */
/**
 * GIF-specific capture/encode logic for `useMediaExport`, split out to keep
 * that composable under the project's per-file line budget.
 *
 * Capture scale comes from the injected `rasterizeSlide` (already honoring
 * File > Options > Advanced > Default Resolution, see
 * `useExportRasterize.ts`). The post-capture size cap (`maxSide`) defaults to
 * the shared `GIF_POST_CAPTURE_MAX_SIDE`, matching every other binding's GIF
 * export via `resolveExportCaptureDecision`'s `postCaptureMaxSide` for the
 * `'gif'` format.
 */
import {
	clampGifDimensions,
	downloadBlob as sharedDownloadBlob,
	GIF_POST_CAPTURE_MAX_SIDE,
	resolveExportBaseName,
} from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import type { GifFrame } from './gif-encoder';
import type { EncodeGif, MediaExportOptions, RasterizeSlide } from './useMediaExport';

/** GIF-only tuning, in addition to the shared `MediaExportOptions`. */
export interface GifExportOptions extends MediaExportOptions {
	/**
	 * Longest allowed frame side in pixels after capture; a captured canvas
	 * larger than this is downscaled before quantisation (GIF encoding cost
	 * grows with pixel count). Defaults to the shared
	 * `GIF_POST_CAPTURE_MAX_SIDE` (see `resolveExportCaptureDecision`'s
	 * `postCaptureMaxSide` for the `'gif'` format).
	 */
	maxSide?: number;
}

/** The pieces `useMediaExport` hands over so this module stays DOM/Vue-free otherwise. */
export interface GifExportDeps {
	slideCount: Ref<number>;
	rasterizeSlide: RasterizeSlide;
	loadGifEncoder: () => Promise<EncodeGif>;
	fileName?: Ref<string> | string;
	downloadBlob?: (blob: Blob, fileName: string) => void;
	exporting: Ref<boolean>;
	progress: Ref<number>;
}

const DEFAULT_GIF_DURATION_MS = 2000;

/** Unwrap `fileName` to a plain string before handing it to the shared resolver. */
export function resolveBaseName(fileName: Ref<string> | string | undefined): string {
	const value = typeof fileName === 'string' || fileName === undefined ? fileName : fileName.value;
	return resolveExportBaseName(value);
}

/**
 * Downscale a captured slide canvas to `maxSide` (via the shared
 * `clampGifDimensions`) and extract its RGBA pixels. GIF encoding cost grows
 * with pixel count (every pixel is matched against a 256-colour palette per
 * frame), so every binding bounds its capture before quantising; see
 * `resolveExportCaptureDecision`'s `postCaptureMaxSide`.
 */
function frameFromCanvas(canvas: HTMLCanvasElement, maxSide: number): GifFrame | undefined {
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
 * Capture every slide, encode as an animated GIF, and trigger the download.
 * Vue port of the React/vanilla/Svelte GIF export paths; see the module
 * doc-comment for the capture-scale/post-capture-cap contract.
 */
export async function runGifExport(
	deps: GifExportDeps,
	opts: GifExportOptions = {},
): Promise<Blob | undefined> {
	const { slideCount, rasterizeSlide, loadGifEncoder, exporting, progress } = deps,
		downloadBlob = deps.downloadBlob ?? sharedDownloadBlob,
		total = slideCount.value;
	if (exporting.value || total === 0) {
		return undefined;
	}
	const {
		slideDurationMs = DEFAULT_GIF_DURATION_MS,
		slideTimingsMs,
		maxSide = GIF_POST_CAPTURE_MAX_SIDE,
		onProgress,
		signal,
	} = opts;

	exporting.value = true;
	progress.value = 0;
	try {
		const frames: GifFrame[] = [];
		for (let i = 0; i < total; i++) {
			if (signal?.aborted) {
				throw new DOMException('Export cancelled', 'AbortError');
			}
			onProgress?.(i, total);
			const canvas = await rasterizeSlide(i),
				frame = frameFromCanvas(canvas, maxSide);
			if (!frame) {
				continue;
			}
			frames.push(frame);
			progress.value = Math.round(((i + 1) / total) * 90);
		}

		if (frames.length === 0) {
			throw new Error('[useMediaExport] No slides were captured for GIF export');
		}

		const encodeGif = await loadGifEncoder(),
			// GIF89a uses a single shared delay; honour a per-slide override when the
			// timings are uniform, otherwise fall back to the default duration.
			firstTiming = slideTimingsMs?.[0],
			durationMs =
				firstTiming !== undefined && slideTimingsMs?.every((t) => t === firstTiming)
					? firstTiming
					: slideDurationMs,
			delayCs = Math.max(1, Math.round(durationMs / 10)),
			bytes = encodeGif(frames, delayCs),
			buffer = new ArrayBuffer(bytes.length);
		new Uint8Array(buffer).set(bytes);
		const blob = new Blob([buffer], { type: 'image/gif' });

		onProgress?.(total, total);
		progress.value = 95;
		downloadBlob(blob, `${resolveBaseName(deps.fileName)}.gif`);
		progress.value = 100;
		return blob;
	} finally {
		exporting.value = false;
	}
}
