/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per export step, several separated by
   guard clauses); merging them isn't a style choice here. */
import {
	downloadBlob as sharedDownloadBlob,
	pickSupportedMimeType,
	WEBM_MIME_CANDIDATES,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { GifFrame } from './gif-encoder';
import { resolveBaseName, runGifExport } from './useGifExport';
import type { GifExportOptions } from './useGifExport';

export type { GifExportOptions } from './useGifExport';

/**
 * Rasterise the slide at `index` to an `HTMLCanvasElement`. Supplied by the host
 * (it owns the DOM + `html2canvas-pro` integration over an off-screen
 * `SlideStage`); keeping it injected makes `useMediaExport` DOM-free and
 * unit-testable: exactly the contract `useExport` uses for PNG/PDF.
 */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

/** Signature of the lazily-loaded GIF encoder (see `gif-encoder.ts`). */
export type EncodeGif = (frames: GifFrame[], delayCs: number) => Uint8Array;

/**
 * Factory for a `MediaRecorder` over a canvas capture stream. Injectable so the
 * WebM path can be exercised in happy-dom (which ships no `MediaRecorder`).
 */
export type MediaRecorderFactory = (
	canvas: HTMLCanvasElement,
	fps: number,
	options: { mimeType: string; videoBitsPerSecond: number },
) => MediaRecorder;

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type MediaExportProgress = (current: number, total: number) => void;

export interface UseMediaExportOptions {
	/** Total slide count (the export iterates `0 … count - 1`). */
	slideCount: Ref<number>;
	/** Host-supplied off-screen rasteriser. */
	rasterizeSlide: RasterizeSlide;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: Ref<string> | string;
	/**
	 * Lazy loader for the GIF encoder. Defaults to a dynamic `import()` of
	 * `./gif-encoder` so the ~9 kB encoder stays out of the main chunk (mirrors
	 * how `useExport` lazy-loads `jspdf`). Overridable in tests.
	 */
	loadGifEncoder?: () => Promise<EncodeGif>;
	/**
	 * `MediaRecorder` factory. Defaults to constructing a recorder over
	 * `canvas.captureStream(fps)`. Overridable in tests / non-browser hosts.
	 */
	createRecorder?: MediaRecorderFactory;
	/**
	 * Off-screen compositing-canvas factory for WebM recording. Defaults to
	 * `document.createElement('canvas')`. Overridable in tests (happy-dom's
	 * canvas has no 2D context).
	 */
	createCanvas?: () => HTMLCanvasElement;
	/** Trigger a browser download for a blob. Overridable in tests. */
	downloadBlob?: (blob: Blob, fileName: string) => void;
}

/** Options accepted by both `exportGif` and `exportWebm`. */
export interface MediaExportOptions {
	/** Default display time per slide, in milliseconds. */
	slideDurationMs?: number;
	/** Per-slide duration overrides in ms (index maps to slide index). */
	slideTimingsMs?: number[];
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: MediaExportProgress;
	/** Abort the export early. */
	signal?: AbortSignal;
}

/** WebM-only tuning. */
export interface WebmExportOptions extends MediaExportOptions {
	/** Capture frame rate fed to `captureStream` (default 30). */
	fps?: number;
	/** Video bit rate in bits/s (default 5_000_000 = 5 Mbps, matching React). */
	videoBitsPerSecond?: number;
	/** Recording-phase progress callback: `(currentSlide, totalSlides)`. */
	onRecordProgress?: MediaExportProgress;
}

export interface UseMediaExportResult {
	/** True while a GIF or WebM export is running. */
	exporting: Ref<boolean>;
	/** 0–100 progress for the in-flight export (0 when idle). */
	progress: Ref<number>;
	/** Export every slide as an animated GIF download. Resolves to the blob. */
	exportGif: (options?: GifExportOptions) => Promise<Blob | undefined>;
	/** Export every slide as a WebM video download. Resolves to the blob. */
	exportWebm: (options?: WebmExportOptions) => Promise<Blob | undefined>;
}

const DEFAULT_WEBM_DURATION_MS = 3000,
	DEFAULT_FPS = 30,
	DEFAULT_VIDEO_BITS_PER_SECOND = 5_000_000;

function defaultCreateRecorder(
	canvas: HTMLCanvasElement,
	fps: number,
	options: { mimeType: string; videoBitsPerSecond: number },
): MediaRecorder {
	const stream = canvas.captureStream(fps);
	return new MediaRecorder(stream, options);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) {
		throw new DOMException('Export cancelled', 'AbortError');
	}
}

/**
 * Media-export composable: render slides to an animated **GIF** or a **WebM**
 * video. Vue port of the React `useExportHandlers` GIF/video paths
 * (`export-gif.ts` / `export-video.ts`).
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host wires
 * `html2canvas-pro` over an off-screen slide stage, the same injection
 * `useExport` uses for PNG/PDF). The GIF encoder is a self-contained pure-JS
 * GIF89a implementation loaded via a dynamic `import()` so it stays out of the
 * main chunk; WebM is recorded with the browser-built-in `MediaRecorder`. Both
 * the encoder and the recorder factory are injectable for unit testing.
 */
export function useMediaExport(options: UseMediaExportOptions): UseMediaExportResult {
	const { slideCount, rasterizeSlide } = options,
		loadGifEncoder =
			options.loadGifEncoder ?? (async () => (await import('./gif-encoder')).encodeGif),
		createRecorder = options.createRecorder ?? defaultCreateRecorder,
		createCanvas = options.createCanvas ?? (() => document.createElement('canvas')),
		downloadBlob = options.downloadBlob ?? sharedDownloadBlob,
		exporting = ref(false),
		progress = ref(0);

	function exportGif(opts: GifExportOptions = {}): Promise<Blob | undefined> {
		return runGifExport(
			{
				slideCount,
				rasterizeSlide,
				loadGifEncoder,
				fileName: options.fileName,
				downloadBlob,
				exporting,
				progress,
			},
			opts,
		);
	}

	async function exportWebm(opts: WebmExportOptions = {}): Promise<Blob | undefined> {
		const total = slideCount.value;
		if (exporting.value || total === 0) {
			return undefined;
		}
		const {
			slideDurationMs = DEFAULT_WEBM_DURATION_MS,
			slideTimingsMs,
			fps = DEFAULT_FPS,
			videoBitsPerSecond = DEFAULT_VIDEO_BITS_PER_SECOND,
			onProgress,
			onRecordProgress,
			signal,
		} = opts;

		exporting.value = true;
		progress.value = 0;
		try {
			// Phase 1: rasterise every slide to a canvas.
			const canvases: HTMLCanvasElement[] = [];
			for (let i = 0; i < total; i++) {
				throwIfAborted(signal);
				onProgress?.(i, total);
				canvases.push(await rasterizeSlide(i));
				progress.value = Math.round(((i + 1) / total) * 45);
			}
			if (canvases.length === 0) {
				throw new Error('[useMediaExport] No slides were captured for video export');
			}

			// Phase 2: composite each slide onto a recording canvas and record it.
			const first = canvases[0],
				recordingCanvas = createCanvas();
			recordingCanvas.width = first.width;
			recordingCanvas.height = first.height;
			const ctx = recordingCanvas.getContext('2d');
			if (!ctx) {
				throw new Error('[useMediaExport] Failed to create 2D context for video recording');
			}

			const recorder = createRecorder(recordingCanvas, fps, {
					mimeType: pickSupportedMimeType([...WEBM_MIME_CANDIDATES]),
					videoBitsPerSecond,
				}),
				chunks: Blob[] = [];
			recorder.ondataavailable = (e: BlobEvent) => {
				if (e.data.size > 0) {
					chunks.push(e.data);
				}
			};
			const recorderDone = new Promise<void>((resolve, reject) => {
				recorder.onstop = () => {
					resolve();
				};
				recorder.onerror = () => {
					reject(new Error('[useMediaExport] MediaRecorder error'));
				};
			});

			recorder.start();

			const frameIntervalMs = 1000 / fps;
			for (let i = 0; i < canvases.length; i++) {
				if (signal?.aborted) {
					recorder.stop();
					throw new DOMException('Export cancelled', 'AbortError');
				}
				onRecordProgress?.(i, canvases.length);

				const duration = slideTimingsMs?.[i] ?? slideDurationMs,
					framesNeeded = Math.max(1, Math.ceil(duration / frameIntervalMs));
				ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
				ctx.drawImage(canvases[i], 0, 0);

				for (let f = 0; f < framesNeeded; f++) {
					if (signal?.aborted) {
						recorder.stop();
						throw new DOMException('Export cancelled', 'AbortError');
					}
					ctx.drawImage(canvases[i], 0, 0);
					await new Promise<void>((resolve) => {
						setTimeout(resolve, frameIntervalMs);
					});
				}
				progress.value = 45 + Math.round(((i + 1) / canvases.length) * 45);
			}

			recorder.stop();
			await recorderDone;

			const blob = new Blob(chunks, { type: 'video/webm' });
			onProgress?.(total, total);
			progress.value = 95;
			downloadBlob(blob, `${resolveBaseName(options.fileName)}.webm`);
			progress.value = 100;
			return blob;
		} finally {
			exporting.value = false;
		}
	}

	return { exporting, progress, exportGif, exportWebm };
}
