// @vitest-environment happy-dom
/**
 * GIF/video export capture scale and (for GIF) the post-capture size cap
 * should both come from the shared `resolveExportCaptureDecision`, driven by
 * File > Options > Advanced > Default Resolution
 * (`imageResolutionScale` = `resolveImageResolutionScale(viewerOptions)`), not
 * a fixed per-binding constant. Before this hook existed, React hardcoded
 * 0.5x (GIF) / 1x (video) regardless of the option.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useExportMediaHandlers } from './useExportMediaHandlers';
import type {
	ExportMediaHandlersResult,
	UseExportMediaHandlersInput,
} from './useExportMediaHandlers';

const exportAllSlidesAsGif = vi.fn(async () => new Blob(['gif'], { type: 'image/gif' }));
const exportAllSlidesAsVideo = vi.fn(async () => new Blob(['webm'], { type: 'video/webm' }));

vi.mock<typeof import('../utils/export')>(import('../utils/export'), () => ({
	exportAllSlidesAsGif: (...args: unknown[]) =>
		(exportAllSlidesAsGif as unknown as (...a: unknown[]) => Promise<Blob>)(...args),
	exportAllSlidesAsVideo: (...args: unknown[]) =>
		(exportAllSlidesAsVideo as unknown as (...a: unknown[]) => Promise<Blob>)(...args),
}));

function baseInput(imageResolutionScale?: number): UseExportMediaHandlersInput {
	return {
		slides: [{ id: 's1', elements: [] } as unknown as PptxSlide],
		activeSlideIndex: 0,
		canvasStageRef: { current: document.createElement('div') },
		setActiveSlideIndex: vi.fn(),
		imageResolutionScale,
		exportAbortRef: { current: null },
		setExportModalOpen: vi.fn(),
		setExportModalTitle: vi.fn(),
		setExportProgress: vi.fn(),
		setExportStatusMessage: vi.fn(),
	};
}

let api: ExportMediaHandlersResult | null = null;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({ input }: { input: UseExportMediaHandlersInput }): null {
	api = useExportMediaHandlers(input);
	return null;
}

beforeAll(() => {
	URL.createObjectURL ??= () => 'blob:test';
	URL.revokeObjectURL ??= () => {};
});

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	host?.remove();
	root = null;
	host = null;
	api = null;
	vi.clearAllMocks();
});

function mount(input: UseExportMediaHandlersInput): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness input={input} />);
	});
}

describe('gif export capture decision', () => {
	it('captures at 2x the default (1x) image-resolution multiplier and caps at 1920px', async () => {
		mount(baseInput());

		await act(async () => {
			await api?.handleExportGif();
		});

		expect(exportAllSlidesAsGif).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			1,
			expect.anything(),
			0,
			expect.objectContaining({ scale: 2, maxSide: 1920 }),
		);
	});

	it('scales up with a higher Default Resolution option, cap unchanged', async () => {
		mount(baseInput(330 / 96));

		await act(async () => {
			await api?.handleExportGif();
		});

		const [, , , , options] = exportAllSlidesAsGif.mock.calls[0] as [
			unknown,
			unknown,
			unknown,
			unknown,
			{ scale: number; maxSide: number },
		];
		expect(options.scale).toBeCloseTo((2 * 330) / 96);
		expect(options.maxSide).toBe(1920);
	});
});

describe('video export capture decision', () => {
	it('captures at 2x the default (1x) image-resolution multiplier, no size cap', async () => {
		mount(baseInput());

		await act(async () => {
			await api?.handleExportVideo();
		});

		const call = exportAllSlidesAsVideo.mock.calls[0] as [
			unknown,
			unknown,
			unknown,
			unknown,
			Record<string, unknown>,
		];
		expect(call[4].scale).toBe(2);
		expect(call[4]).not.toHaveProperty('maxSide');
	});

	it('scales down with a lower Default Resolution option', async () => {
		mount(baseInput(0.25));

		await act(async () => {
			await api?.handleExportVideo();
		});

		const call = exportAllSlidesAsVideo.mock.calls[0] as [
			unknown,
			unknown,
			unknown,
			unknown,
			{ scale: number },
		];
		expect(call[4].scale).toBeCloseTo(0.5);
	});
});
