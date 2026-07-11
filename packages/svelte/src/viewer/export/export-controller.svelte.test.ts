import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportController } from './export-controller.svelte';
import type { ExportControllerDeps } from './export-controller.svelte';

/**
 * ExportController is a runes class (`.svelte.ts`); this suite is named
 * `.svelte.test.ts` so the module is compiled with the runes runtime. Mirrors
 * the vanilla binding's `export-controller.test.ts` coverage, adapted to this
 * class's getter-based deps (`getSlideCount`/`getCurrent`/`getCanvasSize`)
 * instead of a `Store<ViewerState>`.
 */

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

// The GIF/video/print pipelines have their own dedicated suites
// (`export-gif.test.ts` etc.); here they are mocked so the controller tests
// only cover the delegation, download naming, and the `exporting` guard.
const { gifBlobMock, webmBlobMock, printSlidesMock } = vi.hoisted(() => ({
	gifBlobMock: vi.fn(),
	webmBlobMock: vi.fn(),
	printSlidesMock: vi.fn(),
}));
vi.mock(import('./export-gif'), async (importOriginal) => ({
	...(await importOriginal()),
	exportSlidesToGifBlob: gifBlobMock,
}));
vi.mock(import('./export-video'), async (importOriginal) => ({
	...(await importOriginal()),
	exportSlidesToWebmBlob: webmBlobMock,
}));
vi.mock(import('./export-print'), async (importOriginal) => ({
	...(await importOriginal()),
	printSlides: printSlidesMock,
}));

function fakeCanvas(): HTMLCanvasElement {
	return { toDataURL: () => 'data:image/png;base64,AAAA' } as unknown as HTMLCanvasElement;
}

function make(
	overrides: Partial<ExportControllerDeps> & {
		rasterizeSlide: ExportControllerDeps['rasterizeSlide'];
	},
): ExportController {
	return new ExportController({
		getSlideCount: () => 3,
		getCurrent: () => 0,
		getCanvasSize: () => ({ width: 960, height: 540 }),
		getSlides: () => [{}, {}, {}] as unknown as PptxSlide[],
		...overrides,
	});
}

/** Intercept `<a download>` clicks; returns the captured download names. */
function interceptDownloads(): { names: string[]; restore: () => void } {
	const names: string[] = [];
	const orig = document.createElement.bind(document);
	const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
		const el = orig(tag) as HTMLElement;
		if (tag === 'a') {
			const anchor = el as HTMLAnchorElement;
			anchor.click = () => {
				names.push(anchor.download);
			};
		}
		return el;
	});
	return { names, restore: () => spy.mockRestore() };
}

describe('exportController', () => {
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

		const controller = make({ rasterizeSlide });
		await controller.exportSlidePng(1);

		expect(rasterizeSlide).toHaveBeenCalledWith(1);
		expect(click).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('defaults to the current slide when no index is given', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const controller = make({ rasterizeSlide, getCurrent: () => 2 });
		await controller.exportSlidePng();
		expect(rasterizeSlide).toHaveBeenCalledWith(2);
	});

	it('ignores an out-of-range slide index', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const controller = make({ rasterizeSlide, getSlideCount: () => 2 });
		await controller.exportSlidePng(5);
		expect(rasterizeSlide).not.toHaveBeenCalled();
	});

	it('toggles `exporting` around a PNG export', async () => {
		let resolveRaster: (() => void) | undefined;
		const rasterizeSlide = vi.fn().mockImplementation(
			() =>
				new Promise<HTMLCanvasElement>((resolve) => {
					resolveRaster = () => resolve(fakeCanvas());
				}),
		);
		const controller = make({ rasterizeSlide });
		expect(controller.exporting).toBeFalsy();
		const pending = controller.exportSlidePng(0);
		expect(controller.exporting).toBeTruthy();
		resolveRaster?.();
		await pending;
		expect(controller.exporting).toBeFalsy();
	});

	it('exports every slide into a multi-page PDF', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const controller = make({ rasterizeSlide });
		await controller.exportPdf();

		expect(rasterizeSlide).toHaveBeenCalledTimes(3);
		expect(addImage).toHaveBeenCalledTimes(3);
		expect(addPage).toHaveBeenCalledTimes(2); // pages 2 and 3
		expect(save).toHaveBeenCalledOnce();
	});

	it('does nothing when there are no slides', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const controller = make({ rasterizeSlide, getSlideCount: () => 0 });
		await controller.exportPdf();
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it('reports per-slide progress during a PDF export', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const onProgress = vi.fn();
		const controller = make({ rasterizeSlide });
		await controller.exportPdf({ onProgress });

		expect(onProgress).toHaveBeenNthCalledWith(1, 0, 3);
		expect(onProgress).toHaveBeenNthCalledWith(2, 1, 3);
		expect(onProgress).toHaveBeenNthCalledWith(3, 2, 3);
	});

	it('cancels a PDF export when the signal is already aborted', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const abortController = new AbortController();
		abortController.abort();
		const controller = make({ rasterizeSlide });

		await expect(controller.exportPdf({ signal: abortController.signal })).rejects.toThrow(
			'Export cancelled',
		);
		expect(rasterizeSlide).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
		expect(controller.exporting).toBeFalsy();
	});

	it('cancels a PDF export mid-loop once the signal aborts', async () => {
		const abortController = new AbortController();
		const rasterizeSlide = vi.fn().mockImplementation(async (index: number) => {
			if (index === 1) {
				abortController.abort();
			}
			return fakeCanvas();
		});
		const controller = make({ rasterizeSlide, getSlideCount: () => 4 });

		await expect(controller.exportPdf({ signal: abortController.signal })).rejects.toThrow(
			'Export cancelled',
		);
		// Slides 0 and 1 were rasterised; the abort is observed before slide 2 starts.
		expect(rasterizeSlide).toHaveBeenCalledTimes(2);
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
		const controller = make({ rasterizeSlide, getSlideCount: () => 2 });

		const first = controller.exportSlidePng(0);
		const second = controller.exportSlidePng(1);
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

		const controller = make({ rasterizeSlide, getSlideCount: () => 1, fileName: 'My Deck.pptx' });
		await controller.exportSlidePng(0);

		expect(downloadName).toBe('My Deck-slide-1.png');
		spy.mockRestore();
	});

	it('exports a GIF: delegates to the pipeline and downloads the blob', async () => {
		gifBlobMock.mockResolvedValue(new Blob(['gif'], { type: 'image/gif' }));
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas());
		const { names, restore } = interceptDownloads();

		const controller = make({ rasterizeSlide, fileName: 'My Deck.pptx' });
		const options = { slideDurationMs: 500 };
		await controller.exportGif(options);

		expect(gifBlobMock).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ getSlideCount: expect.any(Function) }),
			options,
		);
		expect(names).toStrictEqual(['My Deck.gif']);
		expect(controller.exporting).toBeFalsy();
		restore();
	});

	it('skips the GIF export when there are no slides', async () => {
		const controller = make({
			rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
			getSlideCount: () => 0,
		});
		await controller.exportGif();
		expect(gifBlobMock).not.toHaveBeenCalled();
	});

	it('exports a video: delegates to the pipeline and downloads the blob', async () => {
		webmBlobMock.mockResolvedValue(new Blob(['webm'], { type: 'video/webm' }));
		const { names, restore } = interceptDownloads();

		const controller = make({ rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()) });
		await controller.exportVideo({ fps: 10 });

		expect(webmBlobMock).toHaveBeenCalledExactlyOnceWith(expect.anything(), { fps: 10 });
		expect(names).toStrictEqual(['presentation.webm']);
		expect(controller.exporting).toBeFalsy();
		restore();
	});

	it('clears `exporting` when the video pipeline rejects', async () => {
		webmBlobMock.mockRejectedValue(new Error('boom'));
		const controller = make({ rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()) });
		await expect(controller.exportVideo()).rejects.toThrow('boom');
		expect(controller.exporting).toBeFalsy();
	});

	it('print: delegates settings + deps and resolves the opener result', async () => {
		printSlidesMock.mockResolvedValue(true);
		const controller = make({ rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()) });
		await expect(controller.print({ printWhat: 'notes' })).resolves.toBeTruthy();
		expect(printSlidesMock).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ getSlides: expect.any(Function) }),
			{ printWhat: 'notes' },
		);
	});

	it('print resolves false when there are no slides', async () => {
		const controller = make({
			rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
			getSlides: () => [],
		});
		await expect(controller.print()).resolves.toBeFalsy();
		expect(printSlidesMock).not.toHaveBeenCalled();
	});

	it('refuses to start a GIF export while another export is running', async () => {
		let resolveGif: ((blob: Blob) => void) | undefined;
		gifBlobMock.mockImplementation(
			() =>
				new Promise<Blob>((resolve) => {
					resolveGif = resolve;
				}),
		);
		const { restore } = interceptDownloads();
		const controller = make({ rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()) });

		const first = controller.exportGif();
		await expect(controller.print()).resolves.toBeFalsy();
		expect(printSlidesMock).not.toHaveBeenCalled();
		resolveGif?.(new Blob(['gif'], { type: 'image/gif' }));
		await first;
		expect(controller.exporting).toBeFalsy();
		restore();
	});
});
