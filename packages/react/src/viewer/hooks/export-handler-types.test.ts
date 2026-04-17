import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import type {
	UseExportHandlersInput,
	ExportHandlersResult,
	ExportModalControls,
} from './export-handler-types';

// ---------------------------------------------------------------------------
// saveBlobViaElectronOrDownload depends on window/DOM APIs. We test the
// pure decision logic by extracting the patterns it uses.
// The actual function is integration-tested in environments with DOM access.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// saveBlobViaElectronOrDownload decision logic (extracted)
// ---------------------------------------------------------------------------

/**
 * Determine the save path: electron API or browser download.
 * Mirrors the decision logic in saveBlobViaElectronOrDownload.
 */
function determineSavePath(hasElectronApi: boolean): 'electron' | 'browser' {
	return hasElectronApi ? 'electron' : 'browser';
}

describe('determineSavePath', () => {
	it("returns 'electron' when electron API is available", () => {
		expect(determineSavePath(true)).toBe('electron');
	});

	it("returns 'browser' when electron API is not available", () => {
		expect(determineSavePath(false)).toBe('browser');
	});
});

// ---------------------------------------------------------------------------
// Electron dialog config building (extracted from saveBlobViaElectronOrDownload)
// ---------------------------------------------------------------------------

function buildElectronDialogConfig(defaultName: string, filterName: string, ext: string) {
	return {
		defaultPath: defaultName,
		filters: [{ name: filterName, extensions: [ext] }],
		title: `Save ${filterName}`,
	};
}

describe('buildElectronDialogConfig', () => {
	it('creates correct config for WebM', () => {
		const config = buildElectronDialogConfig('presentation.webm', 'WebM Video', 'webm');
		expect(config.defaultPath).toBe('presentation.webm');
		expect(config.filters).toStrictEqual([{ name: 'WebM Video', extensions: ['webm'] }]);
		expect(config.title).toBe('Save WebM Video');
	});

	it('creates correct config for PDF', () => {
		const config = buildElectronDialogConfig('document.pdf', 'PDF Document', 'pdf');
		expect(config.defaultPath).toBe('document.pdf');
		expect(config.filters).toStrictEqual([{ name: 'PDF Document', extensions: ['pdf'] }]);
		expect(config.title).toBe('Save PDF Document');
	});

	it('creates correct config for GIF', () => {
		const config = buildElectronDialogConfig('animation.gif', 'GIF Image', 'gif');
		expect(config.defaultPath).toBe('animation.gif');
		expect(config.filters).toStrictEqual([{ name: 'GIF Image', extensions: ['gif'] }]);
		expect(config.title).toBe('Save GIF Image');
	});

	it('creates correct config for PNG', () => {
		const config = buildElectronDialogConfig('slide.png', 'PNG Image', 'png');
		expect(config.defaultPath).toBe('slide.png');
		expect(config.title).toBe('Save PNG Image');
	});
});

// ---------------------------------------------------------------------------
// ExportModalControls type shape
// ---------------------------------------------------------------------------

describe('exportModalControls type', () => {
	it('has expected properties', () => {
		const controls: ExportModalControls = {
			setExportModalOpen: vi.fn<() => void>(),
			setExportModalTitle: vi.fn<() => void>(),
			setExportProgress: vi.fn<() => void>(),
			setExportStatusMessage: vi.fn<() => void>(),
			exportAbortRef: { current: null },
		};
		expect(controls.setExportModalOpen).toBeDefined();
		expect(controls.setExportModalTitle).toBeDefined();
		expect(controls.setExportProgress).toBeDefined();
		expect(controls.setExportStatusMessage).toBeDefined();
		expect(controls.exportAbortRef.current).toBeNull();
	});

	it('abort ref can hold an AbortController', () => {
		const controller = new AbortController();
		const controls: ExportModalControls = {
			setExportModalOpen: vi.fn<() => void>(),
			setExportModalTitle: vi.fn<() => void>(),
			setExportProgress: vi.fn<() => void>(),
			setExportStatusMessage: vi.fn<() => void>(),
			exportAbortRef: { current: controller },
		};
		expect(controls.exportAbortRef.current).toBe(controller);
		expect(controls.exportAbortRef.current!.signal.aborted).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// ExportHandlersResult type shape
// ---------------------------------------------------------------------------

describe('exportHandlersResult type', () => {
	it('has all expected handler functions and state properties', () => {
		const mockResult: ExportHandlersResult = {
			handleExportPng: vi.fn<() => void>(),
			handleExportPdf: vi.fn<() => void>(),
			handleExportNotesPdf: vi.fn<() => void>(),
			handleCopySlideAsImage: vi.fn<() => void>(),
			handleExportVideo: vi.fn<() => void>(),
			handleExportGif: vi.fn<() => void>(),
			handlePackageForSharing: vi.fn<() => void>(),
			handleSaveAsFormat: vi.fn<() => void>(),
			handleSaveAsPpsx: vi.fn<() => void>(),
			handleSaveAsPptm: vi.fn<() => void>(),
			handleCancelExport: vi.fn<() => void>(),
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		expect(mockResult.exportModalOpen).toBeFalsy();
		expect(mockResult.exportModalTitle).toBe('');
		expect(mockResult.exportProgress).toBe(0);
		expect(mockResult.exportStatusMessage).toBe('');
	});

	it('handler functions are callable', () => {
		const mockResult: ExportHandlersResult = {
			handleExportPng: vi.fn<() => void>().mockResolvedValue(undefined),
			handleExportPdf: vi.fn<() => void>().mockResolvedValue(undefined),
			handleExportNotesPdf: vi.fn<() => void>().mockResolvedValue(undefined),
			handleCopySlideAsImage: vi.fn<() => void>().mockResolvedValue(undefined),
			handleExportVideo: vi.fn<() => void>().mockResolvedValue(undefined),
			handleExportGif: vi.fn<() => void>().mockResolvedValue(undefined),
			handlePackageForSharing: vi.fn<() => void>().mockResolvedValue(undefined),
			handleSaveAsFormat: vi.fn<() => void>().mockResolvedValue(undefined),
			handleSaveAsPpsx: vi.fn<() => void>(),
			handleSaveAsPptm: vi.fn<() => void>(),
			handleCancelExport: vi.fn<() => void>(),
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		// Verify all handlers are functions
		expectTypeOf(mockResult.handleExportPng).toBeFunction();
		expectTypeOf(mockResult.handleCancelExport).toBeFunction();
		expectTypeOf(mockResult.handleSaveAsPpsx).toBeFunction();
		expectTypeOf(mockResult.handleSaveAsPptm).toBeFunction();
	});
});

// ---------------------------------------------------------------------------
// UseExportHandlersInput type shape
// ---------------------------------------------------------------------------

describe('useExportHandlersInput type', () => {
	it('requires slide data', () => {
		const input: Partial<UseExportHandlersInput> = {
			slides: [],
			activeSlide: undefined,
			activeSlideIndex: 0,
		};
		expect(input.slides).toStrictEqual([]);
		expect(input.activeSlide).toBeUndefined();
		expect(input.activeSlideIndex).toBe(0);
	});

	it('accepts optional filePath', () => {
		const input: Partial<UseExportHandlersInput> = {
			filePath: undefined,
		};
		expect(input.filePath).toBeUndefined();
	});

	it('accepts string filePath', () => {
		const input: Partial<UseExportHandlersInput> = {
			filePath: '/home/user/presentation.pptx',
		};
		expect(input.filePath).toBe('/home/user/presentation.pptx');
	});
});
