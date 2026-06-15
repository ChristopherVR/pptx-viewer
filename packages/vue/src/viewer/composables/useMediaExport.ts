import { ref } from 'vue';
import type { Ref } from 'vue';

import type { GifFrame } from './gif-encoder';

/**
 * Rasterise the slide at `index` to an `HTMLCanvasElement`. Supplied by the host
 * (it owns the DOM + `html2canvas-pro` integration over an off-screen
 * `SlideStage`); keeping it injected makes `useMediaExport` DOM-free and
 * unit-testable — exactly the contract `useExport` uses for PNG/PDF.
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
	exportGif: (options?: MediaExportOptions) => Promise<Blob | undefined>;
	/** Export every slide as a WebM video download. Resolves to the blob. */
	exportWebm: (options?: WebmExportOptions) => Promise<Blob | undefined>;
}

const DEFAULT_GIF_DURATION_MS = 2000;
const DEFAULT_WEBM_DURATION_MS = 3000;
const DEFAULT_FPS = 30;
const DEFAULT_VIDEO_BITS_PER_SECOND = 5_000_000;
const WEBM_MIME_CANDIDATES = [
	'video/webm;codecs=vp9',
	'video/webm;codecs=vp8',
	'video/webm',
] as const;

function resolveBaseName(fileName: UseMediaExportOptions['fileName']): string {
	if (fileName === undefined) {
		return 'presentation';
	}
	const value = typeof fileName === 'string' ? fileName : fileName.value;
	const trimmed = value.trim().replace(/\.(?:pptx|pdf|png|gif|webm)$/iu, '');
	return trimmed === '' ? 'presentation' : trimmed;
}

/** Default browser download: object-URL anchor click, deferred cleanup. */
function defaultDownloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, 200);
}

/** Pick the first `MediaRecorder`-supported WebM MIME, else the last candidate. */
function pickWebmMimeType(): string {
	if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
		return WEBM_MIME_CANDIDATES[0];
	}
	for (const mime of WEBM_MIME_CANDIDATES) {
		if (MediaRecorder.isTypeSupported(mime)) {
			return mime;
		}
	}
	return WEBM_MIME_CANDIDATES[WEBM_MIME_CANDIDATES.length - 1];
}

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
 * Media-export composable — render slides to an animated **GIF** or a **WebM**
 * video. Vue port of the React `useExportHandlers` GIF/video paths
 * (`export-gif.ts` / `export-video.ts`).
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host wires
 * `html2canvas-pro` over an off-screen slide stage — the same injection
 * `useExport` uses for PNG/PDF). The GIF encoder is a self-contained pure-JS
 * GIF89a implementation loaded via a dynamic `import()` so it stays out of the
 * main chunk; WebM is recorded with the browser-built-in `MediaRecorder`. Both
 * the encoder and the recorder factory are injectable for unit testing.
 */
export function useMediaExport(options: UseMediaExportOptions): UseMediaExportResult {
	const { slideCount, rasterizeSlide } = options;
	const loadGifEncoder =
		options.loadGifEncoder ?? (async () => (await import('./gif-encoder')).encodeGif);
	const createRecorder = options.createRecorder ?? defaultCreateRecorder;
	const createCanvas = options.createCanvas ?? (() => document.createElement('canvas'));
	const downloadBlob = options.downloadBlob ?? defaultDownloadBlob;

	const exporting = ref(false);
	const progress = ref(0);

	async function exportGif(opts: MediaExportOptions = {}): Promise<Blob | undefined> {
		const total = slideCount.value;
		if (exporting.value || total === 0) {
			return undefined;
		}
		const { slideDurationMs = DEFAULT_GIF_DURATION_MS, slideTimingsMs, onProgress, signal } = opts;

		exporting.value = true;
		progress.value = 0;
		try {
			const frames: GifFrame[] = [];
			for (let i = 0; i < total; i++) {
				throwIfAborted(signal);
				onProgress?.(i, total);
				const canvas = await rasterizeSlide(i);
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					continue;
				}
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				frames.push({ imageData, width: canvas.width, height: canvas.height });
				progress.value = Math.round(((i + 1) / total) * 90);
			}

			if (frames.length === 0) {
				throw new Error('[useMediaExport] No slides were captured for GIF export');
			}

			const encodeGif = await loadGifEncoder();
			// GIF89a uses a single shared delay; honour a per-slide override when the
			// timings are uniform, otherwise fall back to the default duration.
			const firstTiming = slideTimingsMs?.[0];
			const durationMs =
				firstTiming !== undefined && slideTimingsMs?.every((t) => t === firstTiming)
					? firstTiming
					: slideDurationMs;
			const delayCs = Math.max(1, Math.round(durationMs / 10));
			const bytes = encodeGif(frames, delayCs);

			const buffer = new ArrayBuffer(bytes.length);
			new Uint8Array(buffer).set(bytes);
			const blob = new Blob([buffer], { type: 'image/gif' });

			onProgress?.(total, total);
			progress.value = 95;
			downloadBlob(blob, `${resolveBaseName(options.fileName)}.gif`);
			progress.value = 100;
			return blob;
		} finally {
			exporting.value = false;
		}
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
			const first = canvases[0];
			const recordingCanvas = createCanvas();
			recordingCanvas.width = first.width;
			recordingCanvas.height = first.height;
			const ctx = recordingCanvas.getContext('2d');
			if (!ctx) {
				throw new Error('[useMediaExport] Failed to create 2D context for video recording');
			}

			const recorder = createRecorder(recordingCanvas, fps, {
				mimeType: pickWebmMimeType(),
				videoBitsPerSecond,
			});

			const chunks: Blob[] = [];
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

				const duration = slideTimingsMs?.[i] ?? slideDurationMs;
				const framesNeeded = Math.max(1, Math.ceil(duration / frameIntervalMs));
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
