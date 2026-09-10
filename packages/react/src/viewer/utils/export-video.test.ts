// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderElementToClampedCanvas } from './export-helpers';
import { exportAllSlidesAsVideo } from './export-video';

vi.mock<typeof import('./export-helpers')>(import('./export-helpers'), () => ({
	downloadBlob: vi.fn(),
	downloadDataUrl: vi.fn(),
	renderElementToRaster: vi.fn(),
	renderElementToTiles: vi.fn(),
	renderElementToClampedCanvas: vi.fn(() =>
		Promise.resolve({
			kind: 'canvas' as const,
			canvas: { width: 8, height: 6 } as unknown as HTMLCanvasElement,
			strategy: 'foreignObject' as const,
			width: 8,
			height: 6,
			clamped: false,
			effectiveScale: 1,
		}),
	),
	rasterResultToPngBlob: vi.fn(),
	rasterResultToPngDataUrl: vi.fn(),
	waitForRender: vi.fn(() => Promise.resolve()),
}));

/**
 * Mirrors the vanilla/svelte binding's `MockMediaRecorder` pattern (see
 * `packages/vanilla/src/viewer/export/export-video.test.ts`): the capture
 * layer (`renderElementToClampedCanvas`), the recording canvas, and
 * `MediaRecorder` are all mocked; the shared `video-plan` maths (segments,
 * fps, MIME selection) runs for real.
 */
class MockMediaRecorder {
	static instances: MockMediaRecorder[] = [];
	static isTypeSupported = vi.fn(() => true);

	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(
		public stream: MediaStream,
		public options?: MediaRecorderOptions,
	) {
		MockMediaRecorder.instances.push(this);
	}

	start(): void {}

	stop(): void {
		this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) });
		this.onstop?.();
	}
}

function makeMockElement(): HTMLElement {
	return {} as HTMLElement;
}

describe('exportAllSlidesAsVideo', () => {
	let drawImage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		MockMediaRecorder.instances = [];
		vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);

		drawImage = vi.fn();
		const captureStream = vi.fn(() => ({}) as MediaStream);
		const recordingCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({ drawImage, clearRect: vi.fn() }),
			captureStream,
		};
		const orig = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				return recordingCanvas as unknown as HTMLElement;
			}
			return orig(tag);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('captures every slide via the clamped foreignObject-fidelity path, not raw html2canvas', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		const blob = await exportAllSlidesAsVideo(ref, 2, vi.fn(), 0, {
			slideDurationMs: 10,
		});

		expect(renderElementToClampedCanvas).toHaveBeenCalledTimes(2);
		expect(renderElementToClampedCanvas).toHaveBeenCalledWith(stageEl, 1);
		expect(blob.type).toBe('video/webm');
		expect(drawImage).toHaveBeenCalledWith({ width: 8, height: 6 }, 0, 0);
	});

	it('throws when no slide stage was ever found', async () => {
		const ref = { current: null } as React.RefObject<HTMLElement | null>;

		await expect(exportAllSlidesAsVideo(ref, 2, vi.fn(), 0)).rejects.toThrow(
			'No slides were captured for video export',
		);
	});

	it('rejects with AbortError before capturing anything when already cancelled', async () => {
		vi.mocked(renderElementToClampedCanvas).mockClear();
		const ref = { current: makeMockElement() } as React.RefObject<HTMLElement | null>;

		await expect(
			exportAllSlidesAsVideo(ref, 2, vi.fn(), 0, { signal: AbortSignal.abort() }),
		).rejects.toMatchObject({ name: 'AbortError' });

		expect(renderElementToClampedCanvas).not.toHaveBeenCalled();
		expect(MockMediaRecorder.instances).toHaveLength(0);
	});
});
