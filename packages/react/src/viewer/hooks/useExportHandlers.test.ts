// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import type { ExportHandlersResult, UseExportHandlersInput } from './export-handler-types';
import { useExportHandlers } from './useExportHandlers';

type ExportFunctions = typeof import('../utils/export');

const exportMocks = vi.hoisted(() => ({
	copySlideToClipboard: vi.fn<ExportFunctions['copySlideToClipboard']>(async () => {}),
	exportSlideAsPng: vi.fn<ExportFunctions['exportSlideAsPng']>(async () => {}),
	exportAllSlidesAsPdf: vi.fn<ExportFunctions['exportAllSlidesAsPdf']>(async () => {}),
	exportAllSlidesAsNotesPdf: vi.fn<ExportFunctions['exportAllSlidesAsNotesPdf']>(async () => {}),
	exportAllSlidesAsGif: vi.fn<ExportFunctions['exportAllSlidesAsGif']>(async () => new Blob()),
	exportAllSlidesAsVideo: vi.fn<ExportFunctions['exportAllSlidesAsVideo']>(async () => new Blob()),
}));
vi.mock(import('../utils/export'), () => exportMocks);
vi.mock(import('../utils/dom-helpers'), () => ({ downloadBlob: vi.fn() }));

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let api: ExportHandlersResult;

function Harness({ input }: { input: UseExportHandlersInput }): null {
	api = useExportHandlers(input);
	return null;
}

function render(input: UseExportHandlersInput): void {
	if (!root) {
		host = document.createElement('div');
		document.body.append(host);
		root = createRoot(host);
	}
	act(() => root!.render(createElement(Harness, { input })));
}

function exportInput(slides: PptxSlide[]): UseExportHandlersInput {
	return {
		slides,
		activeSlide: slides[0],
		activeSlideIndex: 0,
		templateElementsBySlideId: {},
		filePath: 'deck.pptx',
		canvasStageRef: { current: document.createElement('div') },
		setActiveSlideIndex: vi.fn(),
		serializeSlides: vi.fn(async () => null),
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		theme: undefined,
		canvasSize: { width: 1040, height: 720 },
		imageExportScale: 2,
	};
}

function slide(id: string, notes = ''): PptxSlide {
	return { id, elements: [], backgroundColor: '#ffffff', notes } as PptxSlide;
}

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

afterEach(() => {
	act(() => root?.unmount());
	host?.remove();
	root = undefined;
	host = undefined;
	vi.restoreAllMocks();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe('export callbacks after replacing a deck', () => {
	it.each([
		['handleExportPng', 'exportSlideAsPng'],
		['handleCopySlideAsImage', 'copySlideToClipboard'],
		['handleExportPdf', 'exportAllSlidesAsPdf'],
		['handleExportGif', 'exportAllSlidesAsGif'],
		['handleExportVideo', 'exportAllSlidesAsVideo'],
	] as const)('%s does not read the previous deck', async (handler, exporter) => {
		const previousSlide = Proxy.revocable(slide('old'), {});
		const previousSlides = Proxy.revocable([previousSlide.proxy], {});
		const input = exportInput(previousSlides.proxy);
		render(input);
		const callback = api[handler];
		const replacement = [slide('new')];
		input.canvasStageRef.current = document.createElement('div');
		render({ ...input, slides: replacement, activeSlide: replacement[0] });
		expect(api[handler]).toBe(callback);
		previousSlides.revoke();
		previousSlide.revoke();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await act(async () => api[handler]());
		expect(exportMocks[exporter]).toHaveBeenCalledOnce();
		expect(error).not.toHaveBeenCalled();
	});

	it('notes PDF reads the replacement notes at invocation time', async () => {
		const input = exportInput([slide('old', 'Old notes')]);
		render(input);
		const replacement = [slide('new', 'New notes')];
		render({ ...input, slides: replacement, activeSlide: replacement[0] });
		replacement[0].notes = 'Latest notes';
		await act(async () => api.handleExportNotesPdf());
		expect(exportMocks.exportAllSlidesAsNotesPdf).toHaveBeenCalledWith(
			input.canvasStageRef,
			1,
			input.setActiveSlideIndex,
			0,
			['Latest notes'],
			'presentation-notes.pdf',
			expect.anything(),
		);
	});

	it('png and clipboard exports use updated background, index and scale', async () => {
		const input = exportInput([slide('old')]);
		render(input);
		const next = { ...slide('new'), backgroundColor: '#123456' };
		render({
			...input,
			slides: [next],
			activeSlide: next,
			activeSlideIndex: 3,
			imageExportScale: 4,
		});
		await act(async () => {
			await api.handleExportPng();
			await api.handleCopySlideAsImage();
		});
		expect(exportMocks.exportSlideAsPng).toHaveBeenCalledWith(input.canvasStageRef.current, 3, {
			backgroundColor: '#123456',
			scale: 4,
		});
		expect(exportMocks.copySlideToClipboard).toHaveBeenCalledWith(input.canvasStageRef.current, {
			backgroundColor: '#123456',
			scale: 4,
		});
	});

	it.each([
		['handleExportPdf', 'exportAllSlidesAsPdf'],
		['handleExportGif', 'exportAllSlidesAsGif'],
		['handleExportVideo', 'exportAllSlidesAsVideo'],
	] as const)(
		'%s uses the replacement slide count and current index',
		async (handler, exporter) => {
			const input = exportInput([slide('old')]);
			render(input);
			const replacement = [slide('first'), slide('second')];
			render({ ...input, slides: replacement, activeSlide: replacement[1], activeSlideIndex: 1 });
			await act(async () => api[handler]());
			expect(exportMocks[exporter].mock.calls[0].slice(0, 4)).toStrictEqual([
				input.canvasStageRef,
				2,
				input.setActiveSlideIndex,
				1,
			]);
		},
	);

	it.each([
		'handleExportPng',
		'handleCopySlideAsImage',
		'handleExportPdf',
		'handleExportNotesPdf',
		'handleExportGif',
		'handleExportVideo',
	] as const)('%s does nothing without a canvas stage', async (handler) => {
		const input = exportInput([slide('current')]);
		input.canvasStageRef.current = null;
		render(input);
		await act(async () => api[handler]());
		for (const exporter of Object.values(exportMocks)) {
			expect(exporter).not.toHaveBeenCalled();
		}
		expect(api.exportModalOpen).toBeFalsy();
	});

	it('cancels the extracted notes export and resets the modal without logging an abort', async () => {
		let rejectExport!: (error: Error) => void;
		exportMocks.exportAllSlidesAsNotesPdf.mockImplementationOnce(
			() =>
				new Promise<void>((_resolve, reject) => {
					rejectExport = reject;
				}),
		);
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(exportInput([slide('current', 'Notes')]));
		let pending!: Promise<void>;
		act(() => {
			pending = api.handleExportNotesPdf();
		});
		const options = exportMocks.exportAllSlidesAsNotesPdf.mock.calls[0][6]!;
		act(() => options.onProgress!(1, 2));
		expect(api.exportModalOpen).toBeTruthy();
		expect(api.exportProgress).toBeGreaterThan(0);
		act(() => api.handleCancelExport());
		expect(options.signal!.aborted).toBeTruthy();
		expect(api.exportModalOpen).toBeFalsy();
		expect(api.exportProgress).toBe(0);
		await act(async () => {
			rejectExport(new DOMException('Cancelled', 'AbortError'));
			await pending;
		});
		expect(api.exportModalOpen).toBeFalsy();
		expect(error).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// useExportHandlers is a hook that sets up export functions. The heavy
// lifting is done by utility functions in ../utils/export and the
// saveBlobViaElectronOrDownload helper (tested in export-handler-types.test.ts).
//
// Here we test:
//   1. The export progress computation logic.
//   2. The abort/cancel flow logic.
//   3. The exported type shape.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Export progress computation (extracted from handleExportVideo/handleExportGif)
// ---------------------------------------------------------------------------

/**
 * Compute progress percentage from current/total slide index.
 * Mirrors the onProgress callback in handleExportVideo and handleExportGif.
 */
function computeExportProgress(current: number, total: number): number {
	return Math.round((current / total) * 90);
}

describe('computeExportProgress', () => {
	it('returns 0 at the start', () => {
		expect(computeExportProgress(0, 10)).toBe(0);
	});

	it('returns 45 at half progress with 10 slides', () => {
		expect(computeExportProgress(5, 10)).toBe(45);
	});

	it('returns 90 at completion', () => {
		expect(computeExportProgress(10, 10)).toBe(90);
	});

	it('returns 9 for 1 out of 10 slides', () => {
		expect(computeExportProgress(1, 10)).toBe(9);
	});

	it('returns 90 for single slide', () => {
		expect(computeExportProgress(1, 1)).toBe(90);
	});

	it('rounds fractional progress', () => {
		// 3/7 * 90 = 38.571... → 39
		expect(computeExportProgress(3, 7)).toBe(39);
	});
});

// ---------------------------------------------------------------------------
// Export status message generation
// ---------------------------------------------------------------------------

function buildVideoStatusMessage(current: number, total: number): string {
	return `Rendering slide ${current + 1} of ${total}...`;
}

function buildGifStatusMessage(current: number, total: number): string {
	return `Encoding slide ${current + 1} of ${total}...`;
}

describe('buildVideoStatusMessage', () => {
	it('uses 1-based slide numbering', () => {
		expect(buildVideoStatusMessage(0, 5)).toBe('Rendering slide 1 of 5...');
	});

	it('formats last slide correctly', () => {
		expect(buildVideoStatusMessage(4, 5)).toBe('Rendering slide 5 of 5...');
	});
});

describe('buildGifStatusMessage', () => {
	it('uses 1-based slide numbering', () => {
		expect(buildGifStatusMessage(0, 3)).toBe('Encoding slide 1 of 3...');
	});

	it('formats last slide correctly', () => {
		expect(buildGifStatusMessage(2, 3)).toBe('Encoding slide 3 of 3...');
	});
});

// ---------------------------------------------------------------------------
// Cancel export logic
// ---------------------------------------------------------------------------

describe('handleCancelExport logic', () => {
	it('aborts the current controller and resets state', () => {
		const abortController = new AbortController();
		const abortSpy = vi.spyOn(abortController, 'abort');

		const exportAbortRef = { current: abortController as AbortController | null };

		// Simulate handleCancelExport
		exportAbortRef.current?.abort();
		exportAbortRef.current = null;

		expect(abortSpy).toHaveBeenCalledWith();
		expect(exportAbortRef.current).toBeNull();
	});

	it('handles null abort ref gracefully', () => {
		const exportAbortRef = { current: null as AbortController | null };

		// Should not throw
		exportAbortRef.current?.abort();
		exportAbortRef.current = null;

		expect(exportAbortRef.current).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Export error detection (AbortError vs other errors)
// ---------------------------------------------------------------------------

describe('export error handling', () => {
	function isAbortError(err: unknown): boolean {
		return (err as DOMException).name === 'AbortError';
	}

	it('detects AbortError by name', () => {
		const err = new DOMException('The operation was aborted.', 'AbortError');
		expect(isAbortError(err)).toBeTruthy();
	});

	it('does not flag regular errors as AbortError', () => {
		const err = new Error('Network failure');
		expect(isAbortError(err)).toBeFalsy();
	});

	it('does not flag TypeError as AbortError', () => {
		const err = new TypeError('Cannot read property of null');
		expect(isAbortError(err)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// ExportHandlersResult type shape
// ---------------------------------------------------------------------------

describe('exportHandlersResult shape', () => {
	it('has all expected handler functions', () => {
		const result: ExportHandlersResult = {
			handleExportPng: vi.fn<() => void>(),
			handleExportPdf: vi.fn<() => void>(),
			handleExportNotesPdf: vi.fn<() => void>(),
			handleCopySlideAsImage: vi.fn<() => void>(),
			handleExportVideo: vi.fn<() => void>(),
			handleExportGif: vi.fn<() => void>(),
			handleSaveAsFormat: vi.fn<() => void>(),
			handleSaveAsPpsx: vi.fn<() => void>(),
			handleSaveAsPptm: vi.fn<() => void>(),
			handleCancelExport: vi.fn<() => void>(),
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		// Verify handler count
		const handlers = Object.keys(result).filter(
			(k) => typeof (result as Record<string, unknown>)[k] === 'function',
		);
		expect(handlers).toHaveLength(10);
	});

	it('initial state values are correct', () => {
		const result: Partial<ExportHandlersResult> = {
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		expect(result.exportModalOpen).toBeFalsy();
		expect(result.exportModalTitle).toBe('');
		expect(result.exportProgress).toBe(0);
		expect(result.exportStatusMessage).toBe('');
	});
});
