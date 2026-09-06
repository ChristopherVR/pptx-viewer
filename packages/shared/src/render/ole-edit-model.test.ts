import type { OlePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildOleContentUpdatePatch,
	buildOleEditDialogDescriptor,
	resolveOleEditorKind,
} from './ole-edit-model';

describe('resolveOleEditorKind', () => {
	it('maps excel to sheet, word to document, powerpoint to deck', () => {
		expect(resolveOleEditorKind({ oleObjectType: 'excel' })).toBe('sheet');
		expect(resolveOleEditorKind({ oleObjectType: 'word' })).toBe('document');
		expect(resolveOleEditorKind({ oleObjectType: 'powerpoint' })).toBe('deck');
	});

	it('falls back to file for pdf/visio/mathtype/package/unknown', () => {
		expect(resolveOleEditorKind({ oleObjectType: 'pdf' })).toBe('file');
		expect(resolveOleEditorKind({ oleObjectType: 'visio' })).toBe('file');
		expect(resolveOleEditorKind({ oleObjectType: 'mathtype' })).toBe('file');
		expect(resolveOleEditorKind({ oleObjectType: 'package' })).toBe('file');
		expect(resolveOleEditorKind({ oleObjectType: 'unknown' })).toBe('file');
	});

	it('falls back to the file extension when oleObjectType is absent', () => {
		expect(resolveOleEditorKind({ oleFileExtension: 'xlsx' })).toBe('sheet');
		expect(resolveOleEditorKind({ oleFileExtension: 'xls' })).toBe('sheet');
		expect(resolveOleEditorKind({ oleFileExtension: 'DOCX' })).toBe('document');
		expect(resolveOleEditorKind({ oleFileExtension: 'ppt' })).toBe('deck');
		expect(resolveOleEditorKind({ oleFileExtension: 'txt' })).toBe('file');
		expect(resolveOleEditorKind({})).toBe('file');
	});

	it('prefers oleObjectType over the file extension', () => {
		expect(resolveOleEditorKind({ oleObjectType: 'excel', oleFileExtension: 'doc' })).toBe('sheet');
	});
});

describe('buildOleEditDialogDescriptor', () => {
	it('includes a content tab for an editable kind', () => {
		const descriptor = buildOleEditDialogDescriptor({ oleObjectType: 'excel' });
		expect(descriptor.contentTab).toStrictEqual({
			kind: 'sheet',
			labelKey: 'pptx.ole.editDialog.tabSheet',
		});
		expect(descriptor.showReplaceFile).toBeTruthy();
		expect(descriptor.showObjectName).toBeTruthy();
	});

	it('omits the content tab for a plain file (Replace File only)', () => {
		const descriptor = buildOleEditDialogDescriptor({ oleObjectType: 'pdf' });
		expect(descriptor.contentTab).toBeUndefined();
		expect(descriptor.showReplaceFile).toBeTruthy();
	});
});

describe('buildOleContentUpdatePatch', () => {
	it('extracts every field a content edit can change', () => {
		const updated: OlePptxElement = {
			id: 'ole1',
			type: 'ole',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			oleName: 'Budget',
			oleEmbeddedData: 'data:application/octet-stream;base64,AA',
			oleEmbeddedByteSize: 2,
			oleEmbeddedFileName: 'budget.xlsx',
			oleEmbeddedMimeType: 'application/octet-stream',
			fileName: 'budget.xlsx',
			previewImageData: 'data:image/png;base64,AA',
			oleContentDirty: true,
		};
		expect(buildOleContentUpdatePatch(updated)).toStrictEqual({
			oleName: 'Budget',
			oleEmbeddedData: 'data:application/octet-stream;base64,AA',
			oleEmbeddedByteSize: 2,
			oleEmbeddedFileName: 'budget.xlsx',
			oleEmbeddedMimeType: 'application/octet-stream',
			fileName: 'budget.xlsx',
			previewImageData: 'data:image/png;base64,AA',
			oleContentDirty: true,
		});
	});
});
