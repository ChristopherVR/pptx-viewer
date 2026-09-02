import type { PptxHandoutMaster, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { runPrint } from './export-print';
import type { ExportCaptureDeps } from './export-types';

/**
 * Unit tests for the print runner. The capture layer and the print-window
 * opener are mocked (export-controller test pattern); the shared
 * print-document assembly (settings validation, range/colour resolution, body
 * builders, DOMPurify-hardened document builder) runs for real, so the
 * captured HTML is asserted as the genuine printable document.
 */

const PNG_DATA_URL = 'data:image/png;base64,AAAA';

function fakeCanvas(): HTMLCanvasElement {
	return { toDataURL: () => PNG_DATA_URL } as unknown as HTMLCanvasElement;
}

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) =>
			({
				id: `s${i}`,
				rId: `rId${i}`,
				slideNumber: i + 1,
				elements: [
					{
						id: `chart-${i}`,
						type: 'chart',
						x: 20,
						y: 20,
						width: 400,
						height: 240,
						chartData: {
							chartType: 'bar',
							categories: ['Q1', 'Q2'],
							series: [{ name: 'Revenue', values: [12, 18] }],
						},
					},
				],
				notes: `Notes for slide ${i + 1}`,
			}) as unknown as PptxSlide,
	);
}

function makeDeps(
	slideCount: number,
	currentSlide = 0,
): ExportCaptureDeps & { rasterizeSlide: ReturnType<typeof vi.fn> } {
	const store: Store<ViewerState> = createStore(createInitialViewerState());
	store.set({
		slides: makeSlides(slideCount),
		canvasSize: { width: 960, height: 540 },
		currentSlide,
	});
	return {
		store,
		rasterizeSlide: vi.fn().mockImplementation(async () => fakeCanvas()),
		baseName: 'deck',
	};
}

describe('runPrint', () => {
	it('assembles the full-page slides document and opens the print window', async () => {
		const deps = makeDeps(3);
		const openPrintWindow = vi.fn((_html: string) => true);

		const opened = await runPrint(deps, { openPrintWindow });

		expect(opened).toBeTruthy();
		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
		expect(openPrintWindow).toHaveBeenCalledOnce();
		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('<!doctype html>');
		expect(html).toContain('<title>Slides (Vector)</title>');
		expect(html).toContain('size: landscape');
		expect(html.match(/print-slide-page/gu)?.length).toBeGreaterThanOrEqual(3);
		expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(html).toContain('data-chart-mark="bar"');
		expect(html).not.toContain(PNG_DATA_URL);
	});

	it('prints only the current slide for the current range', async () => {
		const deps = makeDeps(3, 2);
		const openPrintWindow = vi.fn((_html: string) => true);

		await runPrint(deps, { slideRange: 'current', openPrintWindow });

		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
		const html = openPrintWindow.mock.calls[0][0];
		expect(html.match(/aria-label="Slide/gu)).toHaveLength(1);
	});

	it('clamps a custom range and applies the grayscale colour filter', async () => {
		const deps = makeDeps(4);
		const openPrintWindow = vi.fn((_html: string) => true);

		await runPrint(deps, {
			slideRange: 'custom',
			customRangeFrom: 2,
			customRangeTo: 99,
			colorMode: 'grayscale',
			openPrintWindow,
		});

		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('filter: grayscale(1);');
		expect(html.match(/aria-label="Slide/gu)).toHaveLength(3);
	});

	it('builds notes pages in portrait with the slide notes text', async () => {
		const deps = makeDeps(2);
		const openPrintWindow = vi.fn((_html: string) => true);

		await runPrint(deps, { printWhat: 'notes', orientation: 'landscape', openPrintWindow });

		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('<title>Notes Pages</title>');
		// Notes/handouts/outline force portrait regardless of the option.
		expect(html).toContain('@page { size: portrait; margin: 8mm; }');
		expect(html).toContain('Notes for slide 1');
		expect(html).toContain('Notes for slide 2');
	});

	it('builds handout pages honouring slidesPerPage', async () => {
		const deps = makeDeps(4);
		const openPrintWindow = vi.fn((_html: string) => true);

		await runPrint(deps, { printWhat: 'handouts', slidesPerPage: 4, openPrintWindow });

		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('<title>Handout 4 per page</title>');
		expect(html).toContain('handout-grid');
	});

	it('paints the handout master footer text from store state when ftr is enabled', async () => {
		const deps = makeDeps(4);
		const handoutMaster: PptxHandoutMaster = {
			path: 'ppt/handoutMasters/handoutMaster1.xml',
			slidesPerPage: 4,
			headerFooter: { hasFooter: true },
			elements: [
				{
					id: 'ftr1',
					type: 'text',
					placeholderType: 'ftr',
					x: 0,
					y: 0,
					width: 100,
					height: 20,
					text: 'Confidential - Acme Corp',
				} as unknown as PptxSlide['elements'][number],
			],
		};
		deps.store.set({ handoutMaster });
		const openPrintWindow = vi.fn((_html: string) => true);

		await runPrint(deps, { printWhat: 'handouts', slidesPerPage: 4, openPrintWindow });

		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('Confidential - Acme Corp');
	});

	it('builds the outline without rasterising any slide', async () => {
		const deps = makeDeps(2);
		const openPrintWindow = vi.fn((_html: string) => true);

		const opened = await runPrint(deps, { printWhat: 'outline', openPrintWindow });

		expect(opened).toBeTruthy();
		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
		const html = openPrintWindow.mock.calls[0][0];
		expect(html).toContain('<title>Outline</title>');
		expect(html).toContain('outline-page');
	});

	it('resolves false when the popup is blocked', async () => {
		const deps = makeDeps(1);
		const openPrintWindow = vi.fn((_html: string) => false);

		await expect(runPrint(deps, { openPrintWindow })).resolves.toBeFalsy();
	});

	it('reports progress and honours an abort between captures', async () => {
		const controller = new AbortController();
		const deps = makeDeps(3);
		const onProgress = vi.fn();
		deps.rasterizeSlide.mockImplementation(async (index: number) => {
			if (index === 0) {
				controller.abort();
			}
			return fakeCanvas();
		});
		const openPrintWindow = vi.fn((_html: string) => true);

		await expect(
			runPrint(deps, {
				printWhat: 'notes',
				onProgress,
				signal: controller.signal,
				openPrintWindow,
			}),
		).rejects.toThrow('Export cancelled');
		expect(deps.rasterizeSlide).toHaveBeenCalledOnce();
		expect(openPrintWindow).not.toHaveBeenCalled();
		expect(onProgress).toHaveBeenCalledWith(0, 3);
	});
});
