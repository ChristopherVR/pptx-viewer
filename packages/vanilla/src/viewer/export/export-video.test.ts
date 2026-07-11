import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import type { ExportVideoDeps } from './export-video';
import { runVideoExport } from './export-video';

/**
 * Unit tests for the WebM video export runner. The capture layer, the
 * recording canvas, and `MediaRecorder` are all mocked (export-controller
 * test pattern); the shared `video-plan` maths (segments, fps, MIME
 * selection) runs for real, so the sequencing assertions exercise the actual
 * plan-driven draw loop.
 */

class MockMediaRecorder {
	static instances: MockMediaRecorder[] = [];
	static isTypeSupported = vi.fn(() => true);

	readonly stream: MediaStream;
	readonly options: MediaRecorderOptions | undefined;
	state: 'inactive' | 'recording' = 'inactive';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: (() => void) | null = null;
	startCalls = 0;
	stopCalls = 0;

	constructor(stream: MediaStream, options?: MediaRecorderOptions) {
		this.stream = stream;
		this.options = options;
		MockMediaRecorder.instances.push(this);
	}

	start(): void {
		this.startCalls += 1;
		this.state = 'recording';
	}

	stop(): void {
		this.stopCalls += 1;
		if (this.state === 'recording') {
			this.state = 'inactive';
			this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) });
			this.onstop?.();
		}
	}
}

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) => ({ id: `s${i}`, rId: `rId${i}`, slideNumber: i + 1, elements: [] }) as PptxSlide,
	);
}

function fakeSlideCanvas(): HTMLCanvasElement {
	return { width: 8, height: 6 } as unknown as HTMLCanvasElement;
}

interface TestHarness {
	deps: ExportVideoDeps & { rasterizeSlide: ReturnType<typeof vi.fn> };
	drawImage: ReturnType<typeof vi.fn>;
	captureStream: ReturnType<typeof vi.fn>;
	downloads: () => { names: string[]; blobs: Blob[]; clicks: number };
}

describe('runVideoExport', () => {
	let createdBlobs: Blob[];
	let downloadNames: string[];
	let clicks: number;
	let origCreateObjectURL: typeof URL.createObjectURL;
	let origRevokeObjectURL: typeof URL.revokeObjectURL;

	function makeHarness(slideCount: number): TestHarness {
		const store: Store<ViewerState> = createStore(createInitialViewerState());
		store.set({ slides: makeSlides(slideCount), canvasSize: { width: 8, height: 6 } });

		const drawImage = vi.fn();
		const captureStream = vi.fn(() => ({}) as MediaStream);
		const recordingCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({ drawImage }),
			captureStream,
		};

		const orig = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				return recordingCanvas as unknown as HTMLElement;
			}
			const el = orig(tag) as HTMLElement;
			if (tag === 'a') {
				const anchor = el as HTMLAnchorElement;
				anchor.click = () => {
					clicks += 1;
					downloadNames.push(anchor.download);
				};
			}
			return el;
		});

		return {
			deps: {
				store,
				rasterizeSlide: vi.fn().mockImplementation(async () => fakeSlideCanvas()),
				baseName: 'deck',
				waitMs: () => Promise.resolve(),
			},
			drawImage,
			captureStream,
			downloads: () => ({ names: downloadNames, blobs: createdBlobs, clicks }),
		};
	}

	beforeEach(() => {
		createdBlobs = [];
		downloadNames = [];
		clicks = 0;
		MockMediaRecorder.instances = [];
		MockMediaRecorder.isTypeSupported.mockClear();
		vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
		origCreateObjectURL = URL.createObjectURL;
		origRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = (obj: Blob | MediaSource) => {
			createdBlobs.push(obj as Blob);
			return 'blob:mock';
		};
		URL.revokeObjectURL = () => {};
	});

	afterEach(() => {
		URL.createObjectURL = origCreateObjectURL;
		URL.revokeObjectURL = origRevokeObjectURL;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('records every slide through MediaRecorder and downloads a WebM blob', async () => {
		const harness = makeHarness(2);
		await runVideoExport(harness.deps, { slideDurationMs: 100, fps: 10 });

		expect(harness.deps.rasterizeSlide.mock.calls.map((c) => c[0])).toStrictEqual([0, 1]);
		expect(MockMediaRecorder.instances).toHaveLength(1);
		const recorder = MockMediaRecorder.instances[0];
		expect(recorder.startCalls).toBe(1);
		expect(recorder.stopCalls).toBe(1);
		// vp9 is the first shared candidate and isTypeSupported always agrees.
		expect(recorder.options?.mimeType).toBe('video/webm;codecs=vp9');
		expect(recorder.options?.videoBitsPerSecond).toBe(5_000_000);
		expect(harness.captureStream).toHaveBeenCalledWith(10);
		// 100ms per slide at 10fps = 1 frame per slide.
		expect(harness.drawImage).toHaveBeenCalledTimes(2);

		const { names, blobs, clicks: clickCount } = harness.downloads();
		expect(clickCount).toBe(1);
		expect(names).toStrictEqual(['deck.webm']);
		expect(blobs).toHaveLength(1);
		expect(blobs[0].type).toBe('video/webm');
	});

	it('derives per-slide frame counts from the shared segment plan', async () => {
		const harness = makeHarness(2);
		await runVideoExport(harness.deps, {
			slideDurationMs: 100,
			slideTimingsMs: [100, 300],
			fps: 10,
		});

		// Slide 0: 1 frame (100ms @ 10fps); slide 1: 3 frames (300ms @ 10fps).
		expect(harness.drawImage).toHaveBeenCalledTimes(4);
	});

	it('reports capture and recording progress', async () => {
		const harness = makeHarness(2);
		const onProgress = vi.fn();
		const onRecordProgress = vi.fn();
		await runVideoExport(harness.deps, {
			slideDurationMs: 100,
			fps: 10,
			onProgress,
			onRecordProgress,
		});

		expect(onProgress.mock.calls).toStrictEqual([
			[0, 2],
			[1, 2],
			[2, 2],
		]);
		expect(onRecordProgress.mock.calls).toStrictEqual([
			[0, 2],
			[1, 2],
		]);
	});

	it('does nothing when there are no slides', async () => {
		const harness = makeHarness(0);
		await runVideoExport(harness.deps);
		expect(harness.deps.rasterizeSlide).not.toHaveBeenCalled();
		expect(MockMediaRecorder.instances).toHaveLength(0);
		expect(harness.downloads().clicks).toBe(0);
	});

	it('aborts during capture before any recording starts', async () => {
		const controller = new AbortController();
		controller.abort();
		const harness = makeHarness(2);

		await expect(runVideoExport(harness.deps, { signal: controller.signal })).rejects.toThrow(
			'Export cancelled',
		);
		expect(harness.deps.rasterizeSlide).not.toHaveBeenCalled();
		expect(MockMediaRecorder.instances).toHaveLength(0);
	});

	it('stops the recorder and rethrows when aborted mid-recording', async () => {
		const controller = new AbortController();
		const harness = makeHarness(2);
		harness.deps.waitMs = () => {
			controller.abort();
			return Promise.resolve();
		};

		await expect(
			runVideoExport(harness.deps, { slideDurationMs: 100, fps: 10, signal: controller.signal }),
		).rejects.toThrow('Export cancelled');

		const recorder = MockMediaRecorder.instances[0];
		expect(recorder.startCalls).toBe(1);
		expect(recorder.stopCalls).toBe(1);
		// The first frame drew, the abort landed before the second slide's frame.
		expect(harness.drawImage).toHaveBeenCalledOnce();
		expect(harness.downloads().clicks).toBe(0);
	});
});
