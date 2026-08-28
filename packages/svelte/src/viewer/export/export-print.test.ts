import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { PrintDeps } from './export-print';
import { printSlides } from './export-print';

/**
 * Unit tests for the print flow. The rasteriser and the print-surface opener
 * are mocked; the shared settings validation / range resolution / HTML
 * assembly (`validatePrintSettings`, `computeSlideIndices`,
 * `buildPrintHtmlDocument` incl. DOMPurify sanitisation) run for real, so the
 * assertions inspect the actual assembled document.
 */

function makeSlide(id: string, text: string, notes: string): PptxSlide {
	return {
		id,
		elements: [{ type: 'text', id: `${id}-t`, text }],
		notes,
	} as unknown as PptxSlide;
}

function makeChartSlide(): PptxSlide {
	return {
		id: 'chart-slide',
		elements: [
			{
				type: 'chart',
				id: 'chart-1',
				x: 0,
				y: 0,
				width: 400,
				height: 240,
				chartData: {
					chartType: 'bar',
					categories: ['Q1', 'Q2'],
					series: [{ name: 'Revenue', values: [12, 18], color: '#123456' }],
				},
			},
		],
	} as PptxSlide;
}

const SLIDES: PptxSlide[] = [
	makeSlide('s1', 'First title', 'Speaker notes one'),
	makeSlide('s2', 'Second title', 'Speaker notes two'),
	makeSlide('s3', 'Third title', ''),
];

interface Harness {
	deps: PrintDeps;
	openPrintWindow: ReturnType<typeof vi.fn>;
	rasterizeSlide: ReturnType<typeof vi.fn>;
	html: () => string;
}

function make(overrides: Partial<PrintDeps> = {}): Harness {
	const openPrintWindow = vi.fn().mockReturnValue(true);
	const rasterizeSlide = vi
		.fn()
		.mockImplementation(
			async () =>
				({ toDataURL: () => 'data:image/png;base64,AAAA' }) as unknown as HTMLCanvasElement,
		);
	const deps: PrintDeps = {
		getSlides: () => SLIDES,
		getCurrent: () => 1,
		getCanvasSize: () => ({ width: 960, height: 540 }),
		rasterizeSlide,
		openPrintWindow,
		...overrides,
	};
	return {
		deps,
		openPrintWindow,
		rasterizeSlide,
		html: () => String(openPrintWindow.mock.calls[0]?.[0] ?? ''),
	};
}

describe('printSlides', () => {
	it('prints direct slides as rich vector SVG without rasterising', async () => {
		const harness = make({ getSlides: () => [makeChartSlide()] });
		await expect(printSlides(harness.deps)).resolves.toBeTruthy();

		expect(harness.rasterizeSlide).not.toHaveBeenCalled();
		const html = harness.html();
		expect(html).toContain('<title>Slides</title>');
		expect(html).toContain('size: landscape');
		expect(html).toContain('class="print-slide-page"');
		expect(html).toContain('data-pptx-element="chart"');
		expect(html).toContain('data-chart-mark="bar"');
		expect(html).not.toContain('data:image/png');
	});

	it('prints only the active slide for the current range', async () => {
		const harness = make();
		await printSlides(harness.deps, { printWhat: 'notes', slideRange: 'current' });
		expect(harness.rasterizeSlide).toHaveBeenCalledExactlyOnceWith(1, 1);
	});

	it('clamps a custom range to the slide count', async () => {
		const harness = make();
		await printSlides(harness.deps, {
			printWhat: 'notes',
			slideRange: 'custom',
			customRangeFrom: 2,
			customRangeTo: 9,
		});
		expect(harness.rasterizeSlide.mock.calls.map((call) => call[0])).toStrictEqual([1, 2]);
	});

	it('assembles the outline without rasterising and forces portrait', async () => {
		const harness = make();
		await expect(printSlides(harness.deps, { printWhat: 'outline' })).resolves.toBeTruthy();

		expect(harness.rasterizeSlide).not.toHaveBeenCalled();
		const html = harness.html();
		expect(html).toContain('<title>Outline</title>');
		expect(html).toContain('size: portrait');
		expect(html).toContain('<h2>First title</h2>');
		expect(html).toContain('<p>Speaker notes one</p>');
	});

	it('assembles notes pages with the slide notes text', async () => {
		const harness = make();
		await printSlides(harness.deps, { printWhat: 'notes' });
		const html = harness.html();
		expect(html).toContain('<title>Notes Pages</title>');
		expect(html).toContain('Speaker notes two');
		expect(html).toContain('size: portrait');
		expect(harness.rasterizeSlide).toHaveBeenCalledTimes(3);
	});

	it('assembles a handout grid with the configured slides per page', async () => {
		const harness = make();
		await printSlides(harness.deps, { printWhat: 'handouts', slidesPerPage: 4 });
		const html = harness.html();
		expect(html).toContain('<title>Handout 4 per page</title>');
		expect(html).toContain('handout-grid');
		expect(harness.rasterizeSlide).toHaveBeenCalledTimes(3);
	});

	it('applies the grayscale colour filter', async () => {
		const harness = make();
		await printSlides(harness.deps, { colorMode: 'grayscale' });
		expect(harness.html()).toContain('filter: grayscale(1);');
	});

	it('resolves false when the print surface is blocked', async () => {
		const harness = make();
		harness.openPrintWindow.mockReturnValue(false);
		await expect(printSlides(harness.deps)).resolves.toBeFalsy();
	});

	it('resolves false without opening anything when there are no slides', async () => {
		const harness = make({ getSlides: () => [] });
		await expect(printSlides(harness.deps)).resolves.toBeFalsy();
		expect(harness.openPrintWindow).not.toHaveBeenCalled();
		expect(harness.rasterizeSlide).not.toHaveBeenCalled();
	});
});
