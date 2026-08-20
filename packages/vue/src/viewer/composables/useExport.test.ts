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
