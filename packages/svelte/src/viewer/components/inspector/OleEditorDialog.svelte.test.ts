import JSZip from 'jszip';
import type { OlePptxElement } from 'pptx-viewer-core';
import { oleBytesToDataUrl, PptxHandler } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../../editor/editor-state.svelte';
import OleEditorDialog from './OleEditorDialog.svelte';

/**
 * OleEditorDialog: the "Edit content" dialog for embedded OLE objects
 * (spreadsheet grid / document paragraphs / nested-deck slide titles, plus
 * Replace File), porting React's `OleEditorDialog.test.tsx` scenarios. Builds
 * real minimal xlsx/docx payloads via JSZip (the same way `packages/core`'s
 * own OLE editor tests and React's dialog test do) instead of mocking
 * `pptx-viewer-core`, so this exercises the real async load -> edit -> commit
 * path a user's blur actually runs.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function createEditor(): EditorState & { applyElementPatch: ReturnType<typeof vi.fn> } {
	return {
		editable: true,
		applyElementPatch: vi.fn(),
	} as unknown as EditorState & { applyElementPatch: ReturnType<typeof vi.fn> };
}

function mountDialog(
	editor: EditorState,
	el: OlePptxElement,
	open: boolean,
	onclose: () => void,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(OleEditorDialog, { target, props: { editor, el, open, onclose } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

/** Flush pending micro/macrotasks so the dialog's async load/commit effects settle before assertions. */
async function flush(rounds = 20): Promise<void> {
	for (let i = 0; i < rounds; i++) {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
		flushSync();
	}
}

/** Poll `check` until it returns true or the deadline passes (a nested-deck load runs the full save/load pipeline, slower than a plain xlsx/docx parse). */
async function waitUntil(check: () => boolean, maxWaitMs = 10000): Promise<void> {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > maxWaitMs) {
			return;
		}
		await flush(1);
	}
}

async function makeXlsxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file(
		'xl/workbook.xml',
		'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>',
	);
	zip.file(
		'xl/worksheets/sheet1.xml',
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c></row></sheetData></worksheet>',
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole1',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'excel',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		),
	};
}

async function makeDocxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file(
		'word/document.xml',
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>',
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole2',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'word',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		),
	};
}

async function makeDeckElement(): Promise<OlePptxElement> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ initialSlideCount: 0 });
	data.slides.push(
		createSlide('Blank')
			.addText('Nested Title', { fontSize: 32, x: 0, y: 0, width: 400, height: 60 })
			.addText('Nested Body', { fontSize: 18, x: 0, y: 80, width: 400, height: 60 })
			.build(),
	);
	const bytes = await handler.save(data.slides);
	return {
		id: 'ole3',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'powerpoint',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		),
	};
}

describe('oleEditorDialog', () => {
	it('renders nothing when closed', () => {
		const target = mountDialog(
			createEditor(),
			{ id: 'x', type: 'ole', x: 0, y: 0, width: 1, height: 1 },
			false,
			() => {},
		);
		expect(target.querySelector('[role="dialog"]')).toBeNull();
	});

	it('loads and edits a spreadsheet cell, committing an oleContentDirty patch', async () => {
		const element = await makeXlsxElement();
		const editor = createEditor();
		const target = mountDialog(editor, element, true, () => {});
		await flush();

		const cellInput = target.querySelector<HTMLInputElement>('table input');
		expect(cellInput).toBeInstanceOf(HTMLInputElement);
		expect(cellInput?.value).toBe('10');

		if (cellInput) {
			cellInput.value = '250';
			cellInput.dispatchEvent(new Event('blur', { bubbles: true }));
		}
		await flush();

		expect(editor.applyElementPatch).toHaveBeenCalledWith(
			'ole1',
			expect.objectContaining({
				oleContentDirty: true,
				oleEmbeddedData: expect.stringMatching(/^data:/) as unknown as string,
			}),
		);
	});

	it('loads document paragraphs into editable textareas', async () => {
		const element = await makeDocxElement();
		const target = mountDialog(createEditor(), element, true, () => {});
		await flush();

		const textarea = target.querySelector('textarea');
		expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
		expect((textarea as HTMLTextAreaElement).value).toBe('Hello');
	});

	it('lists every text-bearing shape on every nested-deck slide, and edits one specifically', async () => {
		const element = await makeDeckElement();
		const editor = createEditor();
		const target = mountDialog(editor, element, true, () => {});
		await waitUntil(() => target.querySelectorAll('input[type="text"]').length === 2);

		const inputs = Array.from(target.querySelectorAll<HTMLInputElement>('input[type="text"]'));
		expect(inputs.map((i) => i.value)).toStrictEqual(['Nested Title', 'Nested Body']);

		const bodyInput = inputs[1]!;
		bodyInput.value = 'Edited Body';
		bodyInput.dispatchEvent(new Event('blur', { bubbles: true }));
		await waitUntil(
			() => (editor.applyElementPatch as ReturnType<typeof vi.fn>).mock.calls.length > 0,
		);

		expect(editor.applyElementPatch).toHaveBeenCalledWith(
			'ole3',
			expect.objectContaining({ oleContentDirty: true }),
		);

		const refreshedInputs = Array.from(
			target.querySelectorAll<HTMLInputElement>('input[type="text"]'),
		);
		expect(refreshedInputs.map((i) => i.value)).toStrictEqual(['Nested Title', 'Edited Body']);
	});

	it('shows the unsupported message for a plain (non-editable) payload kind', async () => {
		const element: OlePptxElement = {
			id: 'ole4',
			type: 'ole',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			oleObjectType: 'pdf',
			oleEmbeddedData: oleBytesToDataUrl(new Uint8Array([1, 2, 3]), 'application/pdf'),
		};
		const target = mountDialog(createEditor(), element, true, () => {});
		await flush();
		expect(target.textContent).toContain(
			"This object's content can't be edited directly here. Use Replace File to update it.",
		);
	});

	it('always offers the Replace File action, even for an unsupported kind', async () => {
		const element: OlePptxElement = {
			id: 'ole5',
			type: 'ole',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			oleObjectType: 'pdf',
		};
		const target = mountDialog(createEditor(), element, true, () => {});
		await flush();
		const button = Array.from(target.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Replace File...',
		);
		expect(button).toBeDefined();
	});
});
