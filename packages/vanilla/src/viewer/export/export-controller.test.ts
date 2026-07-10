import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createExportController } from './export-controller';

const { addImage, addPage, save } = vi.hoisted(() => ({
	addImage: vi.fn(),
	addPage: vi.fn(),
	save: vi.fn(),
}));
vi.mock(import('jspdf'), () => {
	class MockJsPDF {
		addImage = addImage;
		addPage = addPage;
		save = save;
	}
	// The real `jsPDF` class carries static `API`/`version` members the mock
	// doesn't need; cast past `Partial<typeof import('jspdf')>` rather than
	// stubbing them out.
	return { jsPDF: MockJsPDF } as unknown as typeof import('jspdf');
});

function fakeCanvas(): HTMLCanvasElement {
	return { toDataURL: () => 'data:image/png;base64,AAAA' } as unknown as HTMLCanvasElement;
}

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) => ({ id: `s${i}`, rId: `rId${i}`, slideNumber: i + 1, elements: [] }) as PptxSlide,
	);
}

function makeStore(slideCount: number, currentSlide = 0): Store<ViewerState> {
	const store = createStore(createInitialViewerState());
	store.set({
		slides: makeSlides(slideCount),
		canvasSize: { width: 960, height: 540 },
		currentSlide,
	});
	return store;
}

describe('createExportController', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('exports a single slide as a PNG download', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const click = vi.fn();
		const orig = document.createElement.bind(document);
		const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = orig(tag) as HTMLElement;
			if (tag === 'a') {
				(el as HTMLAnchorElement).click = click;
			}
			return el;
		});

		const { exportSlidePng } = createExportController({
			store: makeStore(3),
			rasterizeSlide,
		});
		await exportSlidePng(1);

		expect(rasterizeSlide).toHaveBeenCalledWith(1);
		expect(click).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('defaults to the current slide when no index is given', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const { exportSlidePng } = createExportController({
			store: makeStore(3, 2),
			rasterizeSlide,
		});
		await exportSlidePng();
		expect(rasterizeSlide).toHaveBeenCalledWith(2);
	});

	it('ignores an out-of-range slide index', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const { exportSlidePng } = createExportController({
			store: makeStore(2),
			rasterizeSlide,
		});
		await exportSlidePng(5);
		expect(rasterizeSlide).not.toHaveBeenCalled();
	});

	it('exports every slide into a multi-page PDF', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const { exportPdf } = createExportController({ store: makeStore(3), rasterizeSlide });
		await exportPdf();

		expect(rasterizeSlide).toHaveBeenCalledTimes(3);
		expect(addImage).toHaveBeenCalledTimes(3);
		expect(addPage).toHaveBeenCalledTimes(2); // pages 2 and 3
		expect(save).toHaveBeenCalledOnce();
	});

	it('does nothing when there are no slides', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const { exportPdf } = createExportController({ store: makeStore(0), rasterizeSlide });
		await exportPdf();
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it('reports per-slide progress during a PDF export', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const onProgress = vi.fn();
		const { exportPdf } = createExportController({ store: makeStore(3), rasterizeSlide });
		await exportPdf({ onProgress });

		expect(onProgress).toHaveBeenNthCalledWith(1, 0, 3);
		expect(onProgress).toHaveBeenNthCalledWith(2, 1, 3);
		expect(onProgress).toHaveBeenNthCalledWith(3, 2, 3);
	});

	it('cancels a PDF export when the signal is already aborted', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const controller = new AbortController();
		controller.abort();
		const { exportPdf } = createExportController({ store: makeStore(3), rasterizeSlide });

		await expect(exportPdf({ signal: controller.signal })).rejects.toThrow('Export cancelled');
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it('cancels a PDF export mid-loop once the signal aborts', async () => {
		const controller = new AbortController();
		const rasterizeSlide = vi.fn().mockImplementation(async (index: number) => {
			if (index === 1) {
				controller.abort();
			}
			return fakeCanvas();
		});
		const { exportPdf } = createExportController({ store: makeStore(4), rasterizeSlide });

		await expect(exportPdf({ signal: controller.signal })).rejects.toThrow('Export cancelled');
		// Slides 0 and 1 were rasterised; the abort is observed before slide 2 starts.
		expect(rasterizeSlide).toHaveBeenCalledTimes(2); // slides 0 and 1 only
		expect(save).not.toHaveBeenCalled();
	});

	it('ignores a second export while one is already running', async () => {
		let resolveFirst: (() => void) | undefined;
		const rasterizeSlide = vi.fn().mockImplementation(
			() =>
				new Promise<HTMLCanvasElement>((resolve) => {
					resolveFirst = () => resolve(fakeCanvas());
				}),
		);
		const { exportSlidePng } = createExportController({ store: makeStore(2), rasterizeSlide });

		const first = exportSlidePng(0);
		const second = exportSlidePng(1);
		resolveFirst?.();
		await Promise.all([first, second]);

		expect(rasterizeSlide).toHaveBeenCalledExactlyOnceWith(0);
	});

	it('uses the given base file name (extension stripped) for downloads', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		let downloadName = '';
		const orig = document.createElement.bind(document);
		const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = orig(tag) as HTMLElement;
			if (tag === 'a') {
				const anchor = el as HTMLAnchorElement;
				vi.spyOn(anchor, 'click').mockImplementation(() => {});
				Object.defineProperty(anchor, 'download', {
					get: () => downloadName,
					set: (value: string) => {
						downloadName = value;
					},
				});
			}
			return el;
		});

		const { exportSlidePng } = createExportController({
			store: makeStore(1),
			rasterizeSlide,
			fileName: 'My Deck.pptx',
		});
		await exportSlidePng(0);

		expect(downloadName).toBe('My Deck-slide-1.png');
		spy.mockRestore();
	});
});
