import { signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import type { ExportService } from './export.service';
import {
	captureEachSlide,
	captureSlideCanvases,
	captureSlideDataUrl,
	captureSlideTiles,
} from './viewer-export-capture';
import type { CaptureProgressSinks, ExportHost } from './viewer-export-capture';

function fakeCanvas(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	// jsdom has no real canvas backend; stub `toDataURL` the way every other
	// export test in this package does rather than relying on its "data:,"
	// stub output.
	vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
	return canvas;
}

function fakeExportSvc(): {
	exportSvc: ExportService;
	renderElement: ReturnType<typeof vi.fn>;
	renderElementToTiles: ReturnType<typeof vi.fn>;
} {
	const renderElement = vi.fn(async () => fakeCanvas());
	const renderElementToTiles = vi.fn(async () => ({
		fullWidth: 1920,
		fullHeight: 1080,
		tiled: false,
		tiles: [] as never[],
	}));
	return {
		exportSvc: { renderElement, renderElementToTiles } as unknown as ExportService,
		renderElement,
		renderElementToTiles,
	};
}

function fakeHost(
	slideCount: number,
	resolveStage: () => HTMLElement | undefined = () => document.createElement('div'),
): {
	host: ExportHost;
	activeSlideIndex: WritableSignal<number>;
} {
	const activeSlideIndex = signal(0);
	return {
		activeSlideIndex,
		host: {
			activeSlideIndex,
			slideCount: () => slideCount,
			mergedSlides: () => [],
			resolveStage,
			imageExportScale: () => 2,
		},
	};
}

function fakeSinks(): CaptureProgressSinks & {
	setProgress: ReturnType<typeof vi.fn<(value: number) => void>>;
	setStatusMessage: ReturnType<typeof vi.fn<(value: string) => void>>;
} {
	return {
		setProgress: vi.fn<(value: number) => void>(),
		setStatusMessage: vi.fn<(value: string) => void>(),
	};
}

describe('captureEachSlide', () => {
	it('visits every slide in order, hands each live stage to `capture`, and reports progress per slide', async () => {
		const stages = [0, 1, 2].map(() => document.createElement('div'));
		const { host, activeSlideIndex } = fakeHost(3, () => stages[activeSlideIndex()]);
		activeSlideIndex.set(2);
		const sinks = fakeSinks();
		const seen: HTMLElement[] = [];

		const results = await captureEachSlide(
			host,
			sinks,
			new AbortController().signal,
			'Capturing',
			60,
			async (stage) => {
				seen.push(stage);
				return activeSlideIndex();
			},
		);

		expect(results).toStrictEqual([0, 1, 2]);
		expect(seen).toStrictEqual(stages);
		expect(activeSlideIndex()).toBe(2);
		expect(sinks.setProgress).toHaveBeenCalledTimes(3);
		expect(sinks.setStatusMessage).toHaveBeenCalledTimes(3);
		expect(sinks.setStatusMessage).toHaveBeenLastCalledWith(expect.stringContaining('Capturing'));
	});

	it('restores the original slide even when `capture` throws', async () => {
		const { host, activeSlideIndex } = fakeHost(2);
		activeSlideIndex.set(1);

		await expect(
			captureEachSlide(host, fakeSinks(), new AbortController().signal, 'v', 90, async () => {
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');

		expect(activeSlideIndex()).toBe(1);
	});
});

describe('captureSlideCanvases', () => {
	it('flips the live stage through every slide, rasterises each via ExportService, and restores the original index', async () => {
		const { exportSvc, renderElement } = fakeExportSvc();
		const { host, activeSlideIndex } = fakeHost(3);
		activeSlideIndex.set(1);
		const sinks = fakeSinks();

		const canvases = await captureSlideCanvases(
			exportSvc,
			host,
			sinks,
			new AbortController().signal,
			'Rendering',
			90,
			3,
		);

		expect(canvases).toHaveLength(3);
		expect(renderElement).toHaveBeenCalledTimes(3);
		expect(renderElement).toHaveBeenCalledWith(expect.any(HTMLElement), 3);
		expect(activeSlideIndex()).toBe(1);
		expect(sinks.setStatusMessage).toHaveBeenCalledWith(expect.stringContaining('Rendering'));
	});

	it('skips a slide whose stage cannot be resolved', async () => {
		const { exportSvc, renderElement } = fakeExportSvc();
		let calls = 0;
		const { host } = fakeHost(2, () => (calls++ === 0 ? undefined : document.createElement('div')));
		const sinks = fakeSinks();

		const canvases = await captureSlideCanvases(
			exportSvc,
			host,
			sinks,
			new AbortController().signal,
			'v',
			90,
		);

		expect(canvases).toHaveLength(1);
		expect(renderElement).toHaveBeenCalledOnce();
	});

	it('bails out cooperatively and restores the index when the signal is already aborted', async () => {
		const { exportSvc, renderElement } = fakeExportSvc();
		const { host, activeSlideIndex } = fakeHost(3);
		activeSlideIndex.set(0);
		const controller = new AbortController();
		controller.abort();

		await expect(
			captureSlideCanvases(exportSvc, host, fakeSinks(), controller.signal, 'v', 90),
		).rejects.toThrow('Export cancelled');

		expect(renderElement).not.toHaveBeenCalled();
		expect(activeSlideIndex()).toBe(0);
	});
});

describe('captureSlideTiles', () => {
	it('renders every slide to its raw tile set via ExportService.renderElementToTiles', async () => {
		const { exportSvc, renderElementToTiles } = fakeExportSvc();
		const { host } = fakeHost(2);

		const pages = await captureSlideTiles(
			exportSvc,
			host,
			fakeSinks(),
			new AbortController().signal,
			'v',
			90,
			4,
		);

		expect(pages).toHaveLength(2);
		expect(renderElementToTiles).toHaveBeenCalledTimes(2);
		expect(renderElementToTiles).toHaveBeenCalledWith(expect.any(HTMLElement), 4);
	});
});

describe('captureSlideDataUrl', () => {
	it('flips to the requested slide and returns its PNG data URL at the given scale', async () => {
		const { exportSvc, renderElement } = fakeExportSvc();
		const { host, activeSlideIndex } = fakeHost(3);

		const url = await captureSlideDataUrl(exportSvc, host, 2, 5);

		expect(url).toMatch(/^data:image\/png/);
		expect(activeSlideIndex()).toBe(2);
		expect(renderElement).toHaveBeenCalledWith(expect.any(HTMLElement), 5);
	});

	it("falls back to the host's own image-export scale when none is given", async () => {
		const { exportSvc, renderElement } = fakeExportSvc();
		const { host } = fakeHost(1);

		await captureSlideDataUrl(exportSvc, host, 0);

		expect(renderElement).toHaveBeenCalledWith(expect.any(HTMLElement), 2);
	});

	it('returns null when the stage cannot be resolved', async () => {
		const { exportSvc } = fakeExportSvc();
		const { host } = fakeHost(1, () => undefined);

		await expect(captureSlideDataUrl(exportSvc, host, 0)).resolves.toBeNull();
	});
});
