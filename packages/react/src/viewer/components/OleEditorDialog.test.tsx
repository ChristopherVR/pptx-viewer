// @vitest-environment happy-dom
/**
 * OleEditorDialog: the "Edit content" dialog for embedded OLE objects
 * (spreadsheet grid / document paragraphs / nested-deck slide titles,
 * plus Replace File). Builds real minimal payloads (xlsx/docx/pptx) the
 * same way `packages/core`'s own OLE editor tests do, rather than mocking
 * `pptx-viewer-core`, so this exercises the real async load -> edit ->
 * commit path a user's click actually runs.
 */
import JSZip from 'jszip';
import type { OlePptxElement } from 'pptx-viewer-core';
import { oleBytesToDataUrl, PptxHandler } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OleEditorDialog } from './OleEditorDialog';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

/** Flush pending microtasks/macrotasks so the dialog's async load effect settles before assertions. */
async function flush(rounds = 10): Promise<void> {
	await act(async () => {
		for (let i = 0; i < rounds; i++) {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			});
		}
	});
}

/** Poll until the dialog's "Loading content..." placeholder disappears (a nested-deck load runs the full save/load pipeline, slower than a plain xlsx/docx parse). */
async function waitForLoadingToFinish(maxRounds = 50): Promise<void> {
	for (let i = 0; i < maxRounds; i++) {
		if (!container.textContent?.includes(translationsEn['pptx.ole.editDialog.loading']!)) {
			return;
		}
		await flush(5);
	}
}

/**
 * Poll `condition` until it is truthy, flushing in between. A nested-deck
 * COMMIT (like its load) runs the full `PptxHandler` save/load pipeline, so a
 * fixed-count flush after the edit is a source of flake under full-suite
 * load; this mirrors {@link waitForLoadingToFinish}'s polling shape.
 */
async function waitUntil(condition: () => boolean, maxRounds = 50): Promise<void> {
	for (let i = 0; i < maxRounds; i++) {
		if (condition()) {
			return;
		}
		await flush(5);
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
		act(() => {
			root.render(
				<OleEditorDialog
					isOpen={false}
					onClose={() => {}}
					element={{ id: 'x', type: 'ole', x: 0, y: 0, width: 1, height: 1 }}
					onUpdateElement={() => {}}
				/>,
			);
		});
		expect(container.innerHTML).toBe('');
	});

	it('loads and edits a spreadsheet cell, committing an oleContentDirty patch', async () => {
		const element = await makeXlsxElement();
		const onUpdateElement = vi.fn();
		act(() => {
			root.render(
				<OleEditorDialog
					isOpen
					onClose={() => {}}
					element={element}
					onUpdateElement={onUpdateElement}
				/>,
			);
		});
		await flush();

		const cellInput = container.querySelector('table input');
		expect(cellInput).toBeInstanceOf(HTMLInputElement);
		const input = cellInput as HTMLInputElement;
		expect(input.value).toBe('10');

		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter?.call(input, '250');
			// React delegates `onBlur` via the bubbling `focusout` event (native
			// `blur` does not bubble), so that is what a real blur triggers.
			input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});
		// The commit re-encodes the workbook asynchronously; a fixed number of
		// flush rounds was not always enough under CI load, so poll like the
		// nested-deck case below does.
		await waitUntil(() => onUpdateElement.mock.calls.length > 0);

		expect(onUpdateElement).toHaveBeenCalledWith(
			expect.objectContaining({
				oleContentDirty: true,
				oleEmbeddedData: expect.stringMatching(/^data:/) as unknown as string,
			}),
		);
	});

	it('loads document paragraphs into editable textareas', async () => {
		const element = await makeDocxElement();
		act(() => {
			root.render(
				<OleEditorDialog isOpen onClose={() => {}} element={element} onUpdateElement={() => {}} />,
			);
		});
		await flush();

		const textarea = container.querySelector('textarea');
		expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
		expect((textarea as HTMLTextAreaElement).value).toBe('Hello');
	});

	it('lists every text-bearing shape on every nested-deck slide, and edits one specifically', async () => {
		const element = await makeDeckElement();
		const onUpdateElement = vi.fn();
		act(() => {
			root.render(
				<OleEditorDialog
					isOpen
					onClose={() => {}}
					element={element}
					onUpdateElement={onUpdateElement}
				/>,
			);
		});
		await waitForLoadingToFinish();

		const inputs = Array.from(
			container.querySelectorAll('input[type="text"]'),
		) as HTMLInputElement[];
		expect(inputs.map((i) => i.value)).toStrictEqual(['Nested Title', 'Nested Body']);

		const bodyInput = inputs[1]!;
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter?.call(bodyInput, 'Edited Body');
			bodyInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});
		await waitUntil(() => onUpdateElement.mock.calls.length > 0);

		expect(onUpdateElement).toHaveBeenCalledWith(
			expect.objectContaining({ oleContentDirty: true }),
		);
		// The untouched title input must still read the original text.
		const refreshedInputs = Array.from(
			container.querySelectorAll('input[type="text"]'),
		) as HTMLInputElement[];
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
		act(() => {
			root.render(
				<OleEditorDialog isOpen onClose={() => {}} element={element} onUpdateElement={() => {}} />,
			);
		});
		await flush();
		expect(container.textContent).toContain(translationsEn['pptx.ole.editDialog.unsupported']);
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
		act(() => {
			root.render(
				<OleEditorDialog isOpen onClose={() => {}} element={element} onUpdateElement={() => {}} />,
			);
		});
		const button = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent === translationsEn['pptx.ole.editDialog.replaceFile'],
		);
		expect(button).toBeDefined();
	});
});
