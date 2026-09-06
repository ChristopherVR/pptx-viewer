/**
 * OleEditorDialog: the "Edit content" dialog for embedded OLE objects
 * (spreadsheet grid / document paragraphs / nested-deck slide titles, plus
 * Replace File). Vue port of the React `OleEditorDialog.test.tsx` scenarios.
 * Builds real minimal xlsx/docx payloads via JSZip the same way core's own
 * OLE tests do, rather than mocking `pptx-viewer-core`, so this exercises the
 * real async load -> edit -> commit path a user's click actually runs.
 */
import { mount } from '@vue/test-utils';
import JSZip from 'jszip';
import type { OlePptxElement } from 'pptx-viewer-core';
import { oleBytesToDataUrl, PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import OleEditorDialog from './OleEditorDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

/** Flush pending microtasks/macrotasks so the dialog's async watcher settles before assertions. */
async function flush(iterations = 10): Promise<void> {
	for (let i = 0; i < iterations; i++) {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	}
}

/**
 * Poll `check` until it returns true or the deadline passes. The commit path
 * runs an async edit plus a PNG preview re-render, which can take longer than
 * a fixed tick count under parallel test load, so this is more robust than a
 * fixed `flush()` for asserting on its result.
 */
async function waitUntil(check: () => boolean, maxWaitMs = 5000): Promise<void> {
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
		mount(OleEditorDialog, {
			props: {
				open: false,
				element: { id: 'x', type: 'ole', x: 0, y: 0, width: 1, height: 1 },
			},
			attachTo: document.body,
		});
		expect(document.body.querySelector('[role="dialog"]')).toBeNull();
	});

	it('loads and edits a spreadsheet cell, committing an oleContentDirty patch', async () => {
		const element = await makeXlsxElement();
		const wrapper = mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await flush();

		const cellInput = document.body.querySelector<HTMLInputElement>('table input');
		expect(cellInput).toBeInstanceOf(HTMLInputElement);
		const input = cellInput as HTMLInputElement;
		expect(input.value).toBe('10');

		input.value = '250';
		input.dispatchEvent(new FocusEvent('blur'));
		await waitUntil(() => Boolean(wrapper.emitted('update')));

		const updates = wrapper.emitted('update');
		expect(updates).toBeTruthy();
		const patch = updates?.[updates.length - 1]?.[0] as Partial<OlePptxElement>;
		expect(patch.oleContentDirty).toBeTruthy();
		expect(patch.oleEmbeddedData).toMatch(/^data:/);
	});

	it('loads document paragraphs into editable textareas', async () => {
		const element = await makeDocxElement();
		mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await flush();

		const textarea = document.body.querySelector('textarea');
		expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
		expect((textarea as HTMLTextAreaElement).value).toBe('Hello');
	});

	it('lists every text-bearing shape on every nested-deck slide, and edits one specifically', async () => {
		const element = await makeDeckElement();
		const wrapper = mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await waitUntil(() => document.body.querySelectorAll('input[type="text"]').length === 2, 10000);

		const inputs = Array.from(
			document.body.querySelectorAll<HTMLInputElement>('input[type="text"]'),
		);
		expect(inputs.map((i) => i.value)).toStrictEqual(['Nested Title', 'Nested Body']);

		const bodyInput = inputs[1]!;
		bodyInput.value = 'Edited Body';
		bodyInput.dispatchEvent(new FocusEvent('blur'));
		await waitUntil(() => Boolean(wrapper.emitted('update')), 10000);

		const updates = wrapper.emitted('update');
		const patch = updates?.[updates.length - 1]?.[0] as Partial<OlePptxElement>;
		expect(patch.oleContentDirty).toBeTruthy();

		const refreshedInputs = Array.from(
			document.body.querySelectorAll<HTMLInputElement>('input[type="text"]'),
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
		mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await flush();
		expect(document.body.textContent).toContain(
			"This object's content can't be edited directly here",
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
		mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await flush();
		const button = Array.from(document.body.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Replace File...',
		);
		expect(button).toBeDefined();
	});

	it('does not emit update when a blur leaves the value unchanged', async () => {
		const element = await makeXlsxElement();
		const wrapper = mount(OleEditorDialog, {
			props: { open: true, element },
			attachTo: document.body,
		});
		await flush();

		const cellInput = document.body.querySelector<HTMLInputElement>('table input');
		expect(cellInput).toBeInstanceOf(HTMLInputElement);
		(cellInput as HTMLInputElement).dispatchEvent(new FocusEvent('blur'));
		await flush();
		expect(wrapper.emitted('update')).toBeUndefined();
	});
});
