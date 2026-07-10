import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * OleView tests: preview image + type badge, the typed placeholder box
 * (icon / name / sublabel), progId type resolution, and the download / open
 * action bar affordances, mirroring the vanilla OLE renderer tests.
 */

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PDF_DATA_URL = 'data:application/pdf;base64,AAAA';

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 4 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

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

describe('oleView', () => {
	it('renders the preview image with a type badge overlay', () => {
		const target = mountEl(
			oleElement({
				oleObjectType: 'excel',
				fileName: 'budget.xlsx',
				previewImageData: PNG_DATA_URL,
			}),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="ole-1"]');
		expect(node?.getAttribute('style')).toContain('z-index: 4');
		expect(node?.getAttribute('role')).toBe('group');
		expect(node?.getAttribute('aria-label')).toBe('Excel Spreadsheet: budget.xlsx');
		expect(node?.title).toContain('Excel Spreadsheet');
		expect(node?.title).toContain('budget.xlsx');

		const img = node?.querySelector<HTMLImageElement>('.pptx-svelte-ole-preview img');
		expect(img?.getAttribute('src')).toBe(PNG_DATA_URL);

		const badge = node?.querySelector('svg.pptx-svelte-ole-badge');
		expect(badge?.textContent?.trim()).toBe('EXCEL');
		expect(badge?.querySelector('rect')?.getAttribute('fill')).toBe('#217346');
		expect(node?.querySelector('.pptx-svelte-ole-placeholder')).toBeNull();
	});

	it('renders a typed placeholder box with icon and labels when no preview exists', () => {
		const target = mountEl(oleElement({ oleObjectType: 'pdf', fileName: 'report.pdf' }));
		const box = target.querySelector<HTMLElement>('.pptx-svelte-ole-placeholder');
		expect(box).toBeTruthy();
		expect(box?.querySelector('svg')).toBeTruthy();
		expect(box?.querySelector('.pptx-svelte-ole-name')?.textContent).toBe('report.pdf');
		expect(box?.querySelector('.pptx-svelte-ole-sublabel')?.textContent).toBe('PDF Document');
	});

	it('resolves the application type from progId when oleObjectType is missing', () => {
		const target = mountEl(oleElement({ oleProgId: 'Excel.Sheet.12' }));
		// No fileName: the display name falls back to the type label, no sublabel.
		expect(target.querySelector('.pptx-svelte-ole-name')?.textContent).toBe('Excel Spreadsheet');
		expect(target.querySelector('.pptx-svelte-ole-sublabel')).toBeNull();
	});

	it('exposes download and open actions for a recovered embedded payload', () => {
		const target = mountEl(
			oleElement({
				oleObjectType: 'pdf',
				oleEmbeddedData: PDF_DATA_URL,
				oleEmbeddedMimeType: 'application/pdf',
				oleEmbeddedFileName: 'report.pdf',
				oleEmbeddedByteSize: 2048,
			}),
		);
		const bar = target.querySelector('.pptx-svelte-ole-actions');
		expect(bar).toBeTruthy();
		expect(bar?.querySelector('.pptx-svelte-ole-meta')?.textContent).toBe('2 KB');

		const download = bar?.querySelector<HTMLAnchorElement>('a.pptx-svelte-ole-action');
		expect(download?.getAttribute('href')).toBe(PDF_DATA_URL);
		expect(download?.getAttribute('download')).toBe('report.pdf');
		expect(download?.textContent).toBe('Download');
		expect(download?.getAttribute('aria-label')).toBe('Download report.pdf');

		const open = bar?.querySelector<HTMLButtonElement>('button.pptx-svelte-ole-action');
		expect(open?.textContent).toBe('Open');
		expect(open?.getAttribute('aria-label')).toBe('Open report.pdf');
	});

	it('offers download only (no open) for non-browser-openable payloads', () => {
		const target = mountEl(
			oleElement({
				oleObjectType: 'excel',
				oleEmbeddedData: 'data:application/vnd.ms-excel;base64,AAAA',
				oleEmbeddedMimeType: 'application/vnd.ms-excel',
				oleEmbeddedFileName: 'budget.xls',
			}),
		);
		const bar = target.querySelector('.pptx-svelte-ole-actions');
		expect(bar?.querySelector('a.pptx-svelte-ole-action')).toBeTruthy();
		expect(bar?.querySelector('button.pptx-svelte-ole-action')).toBeNull();
	});

	it('renders no action bar without an embedded payload', () => {
		const target = mountEl(oleElement({ oleObjectType: 'word' }));
		expect(target.querySelector('.pptx-svelte-ole-actions')).toBeNull();
	});
});
