import type { PptxSaveFormat } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEditingApi } from './editing-api';
import type { EditorState } from './editor-state.svelte';

/** A stub `EditorState` whose `save` just echoes back the requested format. */
function stubEditor(): EditorState {
	return {
		save: (_format?: PptxSaveFormat) => Promise.resolve(new Uint8Array([1, 2, 3])),
	} as unknown as EditorState;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createEditingApi.downloadAs', () => {
	it('downloads a .ppt save as application/vnd.ms-powerpoint, not the OOXML MIME type', async () => {
		const createObjectURL = vi.fn(() => 'blob:x');
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
		try {
			await createEditingApi(stubEditor()).downloadAs('ppt', 'deck.pptx');
			expect(createObjectURL).toHaveBeenCalledOnce();
			const blob = createObjectURL.mock.calls[0][0] as Blob;
			expect(blob.type).toBe('application/vnd.ms-powerpoint');
		} finally {
			clickSpy.mockRestore();
		}
	});

	it('still downloads .pptx/.pptm/.ppsx with their own OOXML-family MIME types', async () => {
		const createObjectURL = vi.fn(() => 'blob:x');
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
		const expected: Record<Exclude<PptxSaveFormat, 'ppt'>, string> = {
			pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
			pptm: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
		};
		try {
			for (const [format, mime] of Object.entries(expected) as [
				Exclude<PptxSaveFormat, 'ppt'>,
				string,
			][]) {
				createObjectURL.mockClear();
				await createEditingApi(stubEditor()).downloadAs(format, 'deck.pptx');
				const blob = createObjectURL.mock.calls[0][0] as Blob;
				expect(blob.type).toBe(mime);
			}
		} finally {
			clickSpy.mockRestore();
		}
	});
});
