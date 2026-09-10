// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { CanvasSize } from '../types';
import { useExport } from './useExport';

const { addImage, addPage, save } = vi.hoisted(() => ({
	addImage: vi.fn(),
	addPage: vi.fn(),
	save: vi.fn(),
}));
vi.mock(import('jspdf'), () => ({
	jsPDF: class {
		addImage = addImage;
		addPage = addPage;
		save = save;
	},
}));

function fakeCanvas(): HTMLCanvasElement {
	return { toDataURL: () => 'data:image/png;base64,AAAA' } as unknown as HTMLCanvasElement;
}

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) => ({ id: `s${i}`, elements: [] }) as unknown as PptxSlide,
	);
}

// eslint-disable-next-line one-var -- module-scope const, separated from prior declarations
const canvasSize = ref<CanvasSize>({ width: 960, height: 540 });

describe('useExport', () => {
	it('exports a single slide as a PNG download', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			click = vi.fn(),
			orig = document.createElement.bind(document),
			spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
				const el = orig(tag) as HTMLElement;
				if (tag === 'a') {
					(el as HTMLAnchorElement).click = click;
				}
				return el;
			}),
			{ exportSlidePng } = useExport({
				slides: ref(makeSlides(3)),
				canvasSize,
				rasterizeSlide,
			});
		await exportSlidePng(1);
		expect(rasterizeSlide).toHaveBeenCalledWith(1);
		expect(click).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('exports a PNG via rasterizeSlideToRaster (shared driver) when the host supplies it, skipping rasterizeSlide entirely', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			raster = fakeCanvas(),
			rasterizeSlideToRaster = vi.fn().mockResolvedValue({
				kind: 'canvas',
				canvas: raster,
				strategy: 'html2canvas',
				width: 960,
				height: 540,
			}),
			click = vi.fn(),
			orig = document.createElement.bind(document),
			spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
				const el = orig(tag) as HTMLElement;
				if (tag === 'a') {
					(el as HTMLAnchorElement).click = click;
				}
				return el;
			}),
			{ exportSlidePng } = useExport({
				slides: ref(makeSlides(1)),
				canvasSize,
				rasterizeSlide,
				rasterizeSlideToRaster,
			});
		await exportSlidePng(0);
		expect(rasterizeSlideToRaster).toHaveBeenCalledWith(0);
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(click).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('ignores an out-of-range slide index', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			{ exportSlidePng } = useExport({
				slides: ref(makeSlides(2)),
				canvasSize,
				rasterizeSlide,
			});
		await exportSlidePng(5);
		expect(rasterizeSlide).not.toHaveBeenCalled();
	});

	it('exports every slide into a multi-page PDF', async () => {
		addImage.mockClear();
		addPage.mockClear();
		save.mockClear();
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			{ exportPdf } = useExport({ slides: ref(makeSlides(3)), canvasSize, rasterizeSlide });
		await exportPdf();
		expect(rasterizeSlide).toHaveBeenCalledTimes(3);
		expect(addImage).toHaveBeenCalledTimes(3);
		expect(addPage).toHaveBeenCalledTimes(2); // pages 2 and 3
		expect(save).toHaveBeenCalledOnce();
	});

	it('exports via rasterizeSlideToTiles (one addImage per tile) when the host supplies it, skipping rasterizeSlide entirely', async () => {
		addImage.mockClear();
		addPage.mockClear();
		save.mockClear();
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			rasterizeSlideToTiles = vi.fn().mockResolvedValue({
				fullWidth: 1920,
				fullHeight: 1080,
				tiled: true,
				tiles: [
					{ col: 0, row: 0, x: 0, y: 0, width: 960, height: 1080, canvas: fakeCanvas() },
					{ col: 1, row: 0, x: 960, y: 0, width: 960, height: 1080, canvas: fakeCanvas() },
				],
			}),
			{ exportPdf } = useExport({
				slides: ref(makeSlides(1)),
				canvasSize,
				rasterizeSlide,
				rasterizeSlideToTiles,
			});

		await exportPdf();

		expect(rasterizeSlideToTiles).toHaveBeenCalledWith(0);
		expect(rasterizeSlide).not.toHaveBeenCalled();
		// Two tiles for the one slide -> two addImage calls, no addPage (one slide).
		expect(addImage).toHaveBeenCalledTimes(2);
		expect(addPage).not.toHaveBeenCalled();
		// The right-half tile (x=960 of a 1920-wide raster) lands at native x=480
		// on the 960-wide native-size page (divide by the 2x scale).
		expect(addImage).toHaveBeenNthCalledWith(2, expect.any(String), 'PNG', 480, 0, 480, 540);
		expect(save).toHaveBeenCalledOnce();
	});

	it('degrades a single-tile rasterizeSlideToTiles result to one addImage call covering the whole page', async () => {
		addImage.mockClear();
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			rasterizeSlideToTiles = vi.fn().mockResolvedValue({
				fullWidth: 960,
				fullHeight: 540,
				tiled: false,
				tiles: [{ col: 0, row: 0, x: 0, y: 0, width: 960, height: 540, canvas: fakeCanvas() }],
			}),
			{ exportPdf } = useExport({
				slides: ref(makeSlides(1)),
				canvasSize,
				rasterizeSlide,
				rasterizeSlideToTiles,
			});

		await exportPdf();

		expect(addImage).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'PNG', 0, 0, 960, 540);
	});

	it('toggles the exporting flag around a run', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			result = useExport({ slides: ref(makeSlides(1)), canvasSize, rasterizeSlide });
		expect(result.exporting.value).toBeFalsy();
		// eslint-disable-next-line one-var -- separated from `result` above by an assertion
		const p = result.exportSlidePng(0);
		expect(result.exporting.value).toBeTruthy();
		await p;
		expect(result.exporting.value).toBeFalsy();
	});

	it('strips a .gif/.webm source extension too, not just pptx/pdf/png (regression)', async () => {
		// Previously `resolveBaseName` here stripped only .(pptx|pdf|png), so a
		// deck loaded from e.g. `deck.gif` (or re-exported and reloaded) kept the
		// stray extension and produced `deck.gif.pdf`. The shared
		// `resolveExportBaseName` strips the fuller export-surface set.
		save.mockClear();
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			{ exportPdf } = useExport({
				slides: ref(makeSlides(1)),
				canvasSize,
				rasterizeSlide,
				fileName: 'My Deck.webm',
			});
		await exportPdf();
		expect(save).toHaveBeenCalledWith('My Deck.pdf');
	});

	it('accepts a Ref<string> fileName, unwrapped before stripping the extension', async () => {
		save.mockClear();
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			{ exportPdf } = useExport({
				slides: ref(makeSlides(1)),
				canvasSize,
				rasterizeSlide,
				fileName: ref('Quarterly.gif'),
			});
		await exportPdf();
		expect(save).toHaveBeenCalledWith('Quarterly.pdf');
	});
});
