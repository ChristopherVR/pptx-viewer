import type { OlePptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { OleRenderer } from './OleRenderer';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function makeOle(overrides: Partial<OlePptxElement> = {}): OlePptxElement {
	return {
		id: 'ole_test',
		type: 'ole',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		...overrides,
	};
}

const render = (el: OlePptxElement): string => renderToStaticMarkup(<OleRenderer element={el} />);

describe('oleRenderer download/open actions', () => {
	it('renders a download anchor with the embedded data-URL and file name', () => {
		const data = 'data:application/vnd.ms-excel;base64,AAAA';
		const html = render(
			makeOle({
				oleObjectType: 'excel',
				oleEmbeddedData: data,
				oleEmbeddedFileName: 'budget.xlsx',
				oleEmbeddedMimeType: 'application/vnd.ms-excel',
				oleEmbeddedByteSize: 2048,
			}),
		);
		expect(html).toContain('Download');
		expect(html).toContain(`href="${data}"`);
		expect(html).toContain('download="budget.xlsx"');
	});

	it('does not offer Open for a non-browser-openable (binary office) MIME', () => {
		const html = render(
			makeOle({
				oleObjectType: 'excel',
				oleEmbeddedData: 'data:application/vnd.ms-excel;base64,AAAA',
				oleEmbeddedFileName: 'budget.xlsx',
				oleEmbeddedMimeType: 'application/vnd.ms-excel',
			}),
		);
		expect(html).toContain('Download');
		expect(html).not.toContain('>Open<');
	});

	it('offers an Open action button for a browser-openable PDF', () => {
		const data = 'data:application/pdf;base64,JVBER';
		const html = render(
			makeOle({
				oleObjectType: 'pdf',
				oleEmbeddedData: data,
				oleEmbeddedFileName: 'report.pdf',
				oleEmbeddedMimeType: 'application/pdf',
			}),
		);
		expect(html).toContain('>Open<');
		// Open is a real <button> (the click routes the data URL through an
		// object URL); it must not navigate a raw data: URL via an anchor.
		expect(html).toContain('<button');
		expect(html).not.toContain('target="_blank"');
	});

	it('falls back to a generic download name when no file name is known', () => {
		const html = render(
			makeOle({
				oleEmbeddedData: 'data:application/octet-stream;base64,AAAA',
				oleEmbeddedMimeType: 'application/octet-stream',
			}),
		);
		expect(html).toContain('download="embedded-object"');
	});

	it('renders no actions when there is no embedded payload', () => {
		const html = render(makeOle({ oleObjectType: 'word', fileName: 'doc.docx' }));
		expect(html).not.toContain('download=');
		expect(html).not.toContain('>Open<');
	});
});

describe('oleRenderer info display', () => {
	it('shows a human-readable size in the placeholder caption', () => {
		const html = render(
			makeOle({
				oleObjectType: 'excel',
				oleEmbeddedByteSize: 12_582_912, // 12 MB
			}),
		);
		expect(html).toContain('12 MB');
		expect(html).toContain('Excel Spreadsheet');
	});

	it('uses the embedded file name in the caption when present', () => {
		const html = render(
			makeOle({
				oleObjectType: 'word',
				oleEmbeddedFileName: 'memo.docx',
			}),
		);
		expect(html).toContain('memo.docx');
	});

	it('falls back to the OLE file name in the caption when no embedded name', () => {
		const html = render(
			makeOle({
				oleObjectType: 'word',
				fileName: 'doc.docx',
			}),
		);
		expect(html).toContain('doc.docx');
	});

	it('uses the preview image as the visual when present and keeps the badge', () => {
		const html = render(
			makeOle({
				oleObjectType: 'pdf',
				previewImageData: 'data:image/png;base64,iVBOR',
			}),
		);
		expect(html).toContain('<img');
		expect(html).toContain('data:image/png;base64,iVBOR');
		// Type badge short label for PDF.
		expect(html).toContain('PDF');
	});

	it('exposes an accessible label and a descriptive title tooltip', () => {
		const html = render(
			makeOle({
				oleObjectType: 'excel',
				fileName: 'budget.xlsx',
				oleProgId: 'Excel.Sheet.12',
				oleEmbeddedByteSize: 2048,
			}),
		);
		expect(html).toContain('aria-label="Excel Spreadsheet: budget.xlsx"');
		// progId surfaces in the descriptive tooltip.
		expect(html).toContain('Excel.Sheet.12');
		expect(html).toContain('title=');
	});

	it('renders gracefully when no fields are present', () => {
		const html = render(makeOle({}));
		expect(html).toContain('Embedded Object');
		expect(html).not.toContain('download=');
	});
});
