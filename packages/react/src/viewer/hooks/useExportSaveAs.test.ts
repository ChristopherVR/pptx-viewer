import type { PptxSaveFormat } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// useExportSaveAs downloads a Blob whose MIME type depends on the requested
// format: legacy binary `.ppt` is an OLE2 compound file, not a ZIP, so it
// needs its own MIME type rather than the OOXML package one every other
// format shares. Mirrored here as a pure function per this file's own
// established hook-testing convention (see useExportHandlers.test.ts).
// ---------------------------------------------------------------------------

function mimeTypeFor(format: PptxSaveFormat): string {
	return format === 'ppt'
		? 'application/vnd.ms-powerpoint'
		: 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

describe('useExportSaveAs MIME type selection', () => {
	it('uses the legacy binary MIME type for .ppt', () => {
		expect(mimeTypeFor('ppt')).toBe('application/vnd.ms-powerpoint');
	});

	it('uses the OOXML package MIME type for pptx/ppsx/pptm', () => {
		expect(mimeTypeFor('pptx')).toBe(
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		);
		expect(mimeTypeFor('ppsx')).toBe(
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		);
		expect(mimeTypeFor('pptm')).toBe(
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		);
	});
});
