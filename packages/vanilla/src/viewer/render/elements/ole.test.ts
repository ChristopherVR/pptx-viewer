import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderOleElement } from './ole';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PDF_DATA_URL = 'data:application/pdf;base64,AAAA';

function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function oleElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'ole',
		id: 'ole-1',
		x: 30,
		y: 50,
		width: 400,
		height: 300,
		...overrides,
	} as PptxElement;
}

describe('renderOleElement', () => {
	it('returns null for non-ole elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderOleElement(el, 0, makeContext())).toBeNull();
	});

	it('renders the preview image with a type badge overlay', () => {
		const node = renderOleElement(
			oleElement({
				oleObjectType: 'excel',
				fileName: 'budget.xlsx',
				previewImageData: PNG_DATA_URL,
			}),
			4,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('ole-1');
		expect(node.style.zIndex).toBe('4');
		expect(node.getAttribute('role')).toBe('group');
		expect(node.getAttribute('aria-label')).toBe('Excel Spreadsheet: budget.xlsx');
		expect(node.title).toContain('Excel Spreadsheet');
		expect(node.title).toContain('budget.xlsx');

		const img = node.querySelector<HTMLImageElement>('.pptxv-ole-preview img');
		expect(img?.getAttribute('src')).toBe(PNG_DATA_URL);

		const badge = node.querySelector('svg.pptxv-ole-badge');
		expect(badge?.textContent).toBe('EXCEL');
		expect(badge?.querySelector('rect')?.getAttribute('fill')).toBe('#217346');
		expect(node.querySelector('.pptxv-ole-placeholder')).toBeNull();
	});

	it('renders a typed placeholder box with icon and labels when no preview exists', () => {
		const node = renderOleElement(
			oleElement({ oleObjectType: 'pdf', fileName: 'report.pdf' }),
			0,
			makeContext(),
		) as HTMLElement;
		const box = node.querySelector<HTMLElement>('.pptxv-ole-placeholder');
		expect(box).toBeTruthy();
		expect(box?.querySelector('svg')).toBeTruthy();
		expect(box?.querySelector('.pptxv-ole-name')?.textContent).toBe('report.pdf');
		expect(box?.querySelector('.pptxv-ole-sublabel')?.textContent).toBe('PDF Document');
	});

	it('resolves the application type from progId when oleObjectType is missing', () => {
		const node = renderOleElement(
			oleElement({ oleProgId: 'Excel.Sheet.12' }),
			0,
			makeContext(),
		) as HTMLElement;
		// No fileName: the display name falls back to the type label, no sublabel.
		expect(node.querySelector('.pptxv-ole-name')?.textContent).toBe('Excel Spreadsheet');
		expect(node.querySelector('.pptxv-ole-sublabel')).toBeNull();
	});

	it('exposes download and open actions for a recovered embedded payload', () => {
		const node = renderOleElement(
			oleElement({
				oleObjectType: 'pdf',
				oleEmbeddedData: PDF_DATA_URL,
				oleEmbeddedMimeType: 'application/pdf',
				oleEmbeddedFileName: 'report.pdf',
				oleEmbeddedByteSize: 2048,
			}),
			0,
			makeContext(),
		) as HTMLElement;
		const bar = node.querySelector('.pptxv-ole-actions');
		expect(bar).toBeTruthy();
		expect(bar?.querySelector('.pptxv-ole-meta')?.textContent).toBe('2 KB');

		const download = bar?.querySelector<HTMLAnchorElement>('a.pptxv-ole-action');
		expect(download?.getAttribute('href')).toBe(PDF_DATA_URL);
		expect(download?.getAttribute('download')).toBe('report.pdf');
		expect(download?.textContent).toBe('Download');
		expect(download?.getAttribute('aria-label')).toBe('Download report.pdf');

		const open = bar?.querySelector<HTMLButtonElement>('button.pptxv-ole-action');
		expect(open?.textContent).toBe('Open');
		expect(open?.getAttribute('aria-label')).toBe('Open report.pdf');
	});

	it('offers download only (no open) for non-browser-openable payloads', () => {
		const node = renderOleElement(
			oleElement({
				oleObjectType: 'excel',
				oleEmbeddedData: 'data:application/vnd.ms-excel;base64,AAAA',
				oleEmbeddedMimeType: 'application/vnd.ms-excel',
				oleEmbeddedFileName: 'budget.xls',
			}),
			0,
			makeContext(),
		) as HTMLElement;
		const bar = node.querySelector('.pptxv-ole-actions');
		expect(bar?.querySelector('a.pptxv-ole-action')).toBeTruthy();
		expect(bar?.querySelector('button.pptxv-ole-action')).toBeNull();
	});

	it('renders no action bar without an embedded payload', () => {
		const node = renderOleElement(
			oleElement({ oleObjectType: 'word' }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('.pptxv-ole-actions')).toBeNull();
	});
});
