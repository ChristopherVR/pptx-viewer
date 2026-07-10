// @vitest-environment jsdom
//
// The print body is sanitised through DOMPurify (see `buildPrintHtmlDocument`
// in `pptx-viewer-shared`), which walks/rewrites the parsed DOM tree.
// happy-dom (this package's default test environment) has a tree-walking bug
// that drops the first of several sibling elements during that rewrite;
// jsdom does not, and is what actually approximates the real browsers this
// code runs in (`window.open` print windows), so this file opts into jsdom
// specifically to get a faithful sanitisation result.
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { PrintSettings } from '../components/print-dialog-types';
import { usePrint } from './usePrint';

function fakeCanvas(id = 'AAAA'): HTMLCanvasElement {
	return { toDataURL: () => `data:image/png;base64,${id}` } as unknown as HTMLCanvasElement;
}

function makeSlides(n: number, notes?: (i: number) => string): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) =>
			({
				id: `s${i}`,
				elements: [{ id: `e${i}`, type: 'text', text: `Title ${i + 1}` }],
				notes: notes?.(i),
			}) as unknown as PptxSlide,
	);
}

function baseSettings(overrides: Partial<PrintSettings> = {}): PrintSettings {
	return {
		printWhat: 'slides',
		orientation: 'landscape',
		colorMode: 'color',
		frameSlides: false,
		slidesPerPage: 6,
		slideRange: 'all',
		customRangeFrom: 1,
		customRangeTo: 1,
		...overrides,
	};
}

describe('usePrint', () => {
	it('opens and closes the dialog', () => {
		const { isPrintDialogOpen, openPrintDialog, closePrintDialog } = usePrint({
			slides: ref(makeSlides(2)),
			activeSlideIndex: ref(0),
			rasterizeSlide: vi.fn(),
		});
		expect(isPrintDialogOpen.value).toBeFalsy();
		openPrintDialog();
		expect(isPrintDialogOpen.value).toBeTruthy();
		closePrintDialog();
		expect(isPrintDialogOpen.value).toBeFalsy();
	});

	it('closes the dialog when printing starts', async () => {
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const result = usePrint({
			slides: ref(makeSlides(1)),
			activeSlideIndex: ref(0),
			rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
			openPrintWindow,
		});
		result.openPrintDialog();
		await result.print(baseSettings());
		expect(result.isPrintDialogOpen.value).toBeFalsy();
	});

	it('rasterises every selected slide for the slides layout', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(3)),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings());
		expect(rasterizeSlide).toHaveBeenCalledTimes(3);
		expect(openPrintWindow).toHaveBeenCalledOnce();
		const html = openPrintWindow.mock.calls[0][0] as string;
		expect(html).toContain('slide-img');
		expect(html).toContain('@page { size: landscape;');
	});

	it('only rasterises the active slide for the "current" range', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(5)),
			activeSlideIndex: ref(2),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ slideRange: 'current' }));
		expect(rasterizeSlide).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('honours a custom range', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(10)),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ slideRange: 'custom', customRangeFrom: 3, customRangeTo: 5 }));
		expect(rasterizeSlide.mock.calls.map((c) => c[0])).toStrictEqual([2, 3, 4]);
	});

	it('prints the outline without rasterising', async () => {
		const rasterizeSlide = vi.fn();
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(2, (i) => (i === 0 ? 'note one' : ''))),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ printWhat: 'outline' }));
		expect(rasterizeSlide).not.toHaveBeenCalled();
		const html = openPrintWindow.mock.calls[0][0] as string;
		expect(html).toContain('<h2>Title 1</h2>');
		expect(html).toContain('<p>note one</p>');
		expect(html).toContain('outline-page');
	});

	it('emits notes pages with escaped notes text', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(1, () => 'a & <b>')),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ printWhat: 'notes' }));
		const html = openPrintWindow.mock.calls[0][0] as string;
		expect(html).toContain('notes-page');
		expect(html).toContain('a &amp; &lt;b&gt;');
		// notes are always portrait
		expect(html).toContain('@page { size: portrait;');
	});

	it('paginates handouts by slides-per-page', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(7)),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ printWhat: 'handouts', slidesPerPage: 6 }));
		const html = openPrintWindow.mock.calls[0][0] as string;
		// 7 slides / 6 per page → 2 pages
		expect(html.match(/class="page"/gu)).toHaveLength(2);
		expect(html).toContain('handout-grid');
	});

	it('uses the 3-per-page note-line layout', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(3)),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings({ printWhat: 'handouts', slidesPerPage: 3 }));
		const html = openPrintWindow.mock.calls[0][0] as string;
		expect(html).toContain('handout-grid-3');
		expect(html).toContain('handout-note-line');
	});

	it('applies the grayscale colour filter', async () => {
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(1)),
			activeSlideIndex: ref(0),
			rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
			openPrintWindow,
		});
		await print(baseSettings({ colorMode: 'grayscale' }));
		expect(openPrintWindow.mock.calls[0][0]).toContain('filter: grayscale(1);');
	});

	it('does nothing when no slides are selected (empty deck)', async () => {
		const rasterizeSlide = vi.fn();
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const { print } = usePrint({
			slides: ref(makeSlides(0)),
			activeSlideIndex: ref(0),
			rasterizeSlide,
			openPrintWindow,
		});
		await print(baseSettings());
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(openPrintWindow).not.toHaveBeenCalled();
	});

	it('swallows rasterisation errors', async () => {
		const openPrintWindow = vi.fn().mockReturnValue(true);
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { print } = usePrint({
			slides: ref(makeSlides(2)),
			activeSlideIndex: ref(0),
			rasterizeSlide: vi.fn().mockRejectedValue(new Error('boom')),
			openPrintWindow,
		});
		await expect(print(baseSettings())).resolves.toBeUndefined();
		expect(openPrintWindow).not.toHaveBeenCalled();
		errSpy.mockRestore();
	});
});
