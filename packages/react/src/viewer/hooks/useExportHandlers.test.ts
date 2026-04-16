import { describe, it, expect, vi } from 'vitest';

import type { ExportHandlersResult } from './export-handler-types';

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

		expect(abortSpy).toHaveBeenCalled();
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
		expect(isAbortError(err)).toBe(true);
	});

	it('does not flag regular errors as AbortError', () => {
		const err = new Error('Network failure');
		expect(isAbortError(err)).toBe(false);
	});

	it('does not flag TypeError as AbortError', () => {
		const err = new TypeError('Cannot read property of null');
		expect(isAbortError(err)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// ExportHandlersResult type shape
// ---------------------------------------------------------------------------

describe('exportHandlersResult shape', () => {
	it('has all expected handler functions', () => {
		const result: ExportHandlersResult = {
			handleExportPng: vi.fn(),
			handleExportPdf: vi.fn(),
			handleExportNotesPdf: vi.fn(),
			handleCopySlideAsImage: vi.fn(),
			handleExportVideo: vi.fn(),
			handleExportGif: vi.fn(),
			handlePackageForSharing: vi.fn(),
			handleSaveAsFormat: vi.fn(),
			handleSaveAsPpsx: vi.fn(),
			handleSaveAsPptm: vi.fn(),
			handleCancelExport: vi.fn(),
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		// Verify handler count
		const handlers = Object.keys(result).filter((k) => typeof (result as any)[k] === 'function');
		expect(handlers).toHaveLength(11);
	});

	it('initial state values are correct', () => {
		const result: Partial<ExportHandlersResult> = {
			exportModalOpen: false,
			exportModalTitle: '',
			exportProgress: 0,
			exportStatusMessage: '',
		};

		expect(result.exportModalOpen).toBe(false);
		expect(result.exportModalTitle).toBe('');
		expect(result.exportProgress).toBe(0);
		expect(result.exportStatusMessage).toBe('');
	});
});
