import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getTableCellBandStyle } from '../table-style';
import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import { galleryItemLabel } from './gallery-view';
import { tableStyleLabel } from './table-style-gallery-catalog';

const MEDIUM_2_ACCENT_1 = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';
const NO_STYLE_NO_GRID = '{2D5ABB26-0587-4C30-8999-92F81FD0307C}';

function table(styleId?: string): PptxElement {
	const tableData: PptxTableData = {
		columnWidths: [0.5, 0.5],
		firstRowHeader: true,
		bandedRows: true,
		tableStyleId: styleId,
		rows: [
			{ cells: [{ text: 'A', style: { backgroundColor: '#00FF00', bold: true } }, { text: 'B' }] },
			{
				cells: [
					{ text: 'C', style: { borderTopColor: '#FF0000', borderTopWidth: 3, color: '#0000FF' } },
					{ text: 'D' },
				],
			},
		],
	};
	return { id: 't1', type: 'table', x: 0, y: 0, width: 200, height: 80, tableData } as PptxElement;
}

const interpolate = (key: string, params?: Readonly<Record<string, string | number>>) =>
	key.replace(/^pptx\.gallery\.tableStyles\.(\w+)$/u, (_, k: string) =>
		k === 'mediumAccent' ? `Medium Style ${params?.n} - Accent ${params?.accent}` : key,
	);

describe('table Styles gallery', () => {
	it('offers PowerPoint 74 built-in styles grouped as the gallery does', () => {
		const descriptor = buildRibbonGallery('tableStyles', { element: table(MEDIUM_2_ACCENT_1) });
		expect(descriptor.disabled).toBeFalsy();
		expect(descriptor.sections.map((s) => [s.id, s.items.length])).toStrictEqual([
			['bestMatch', 14],
			['light', 21],
			['medium', 28],
			['dark', 11],
		]);
		const ids = descriptor.sections.flatMap((s) => s.items.map((i) => i.id));
		expect(new Set(ids).size).toBe(74);
		expect(ids[0]).toBe(NO_STYLE_NO_GRID);
		const applied = descriptor.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual([MEDIUM_2_ACCENT_1]);
		expect(applied[0].previewSvg.startsWith('<svg')).toBeTruthy();
		expect(galleryItemLabel(applied[0], interpolate)).toBe('Medium Style 2 - Accent 1');
	});

	it('is disabled without a table and detects the applied style case-insensitively', () => {
		expect(buildRibbonGallery('tableStyles', { element: null }).disabled).toBeTruthy();
		const lower = buildRibbonGallery('tableStyles', {
			element: table(MEDIUM_2_ACCENT_1.toLowerCase().replace(/[{}]/gu, '')),
		});
		expect(lower.sections[2].items.find((i) => i.applied)?.id).toBe(MEDIUM_2_ACCENT_1);
	});

	it('spells every name through a translatable key', () => {
		expect(tableStyleLabel('Dark Style 2 - Accent 3/Accent 4')).toStrictEqual({
			labelKey: 'pptx.gallery.tableStyles.darkAccentPair',
			labelParams: { n: 2, a: 3, b: 4 },
		});
		expect(tableStyleLabel('Light Style 3').labelKey).toBe('pptx.gallery.tableStyles.light');
		expect(tableStyleLabel('No Style, Table Grid').labelKey).toBe(
			'pptx.gallery.tableStyles.noStyleTableGrid',
		);
	});

	it('writes the GUID and clears direct cell fills and borders like PowerPoint', () => {
		const result = applyRibbonGalleryItem('tableStyles', MEDIUM_2_ACCENT_1, { element: table() });
		if (result?.kind !== 'element') {
			throw new Error('expected an element patch');
		}
		const data = (result.patch as { tableData: PptxTableData }).tableData;
		expect(data.tableStyleId).toBe(MEDIUM_2_ACCENT_1);
		expect(data.rows[0].cells[0].style).toStrictEqual({ bold: true });
		expect(data.rows[1].cells[0].style).toStrictEqual({ color: '#0000FF' });
		expect(
			applyRibbonGalleryItem('tableStyles', '{00000000-0000-0000-0000-000000000000}', {
				element: table(),
			}),
		).toBeNull();
	});

	it('renders the neutral and No Style entries without the generic fallback tint', () => {
		const data: PptxTableData = {
			rows: [],
			columnWidths: [],
			firstRowHeader: true,
			bandedRows: true,
		};
		const scheme = { dk1: '#000000', lt1: '#FFFFFF' } as never;
		const noStyle = getTableCellBandStyle({ ...data, tableStyleId: NO_STYLE_NO_GRID }, 0, 0, 3, 2, {
			colorScheme: scheme,
		});
		expect(noStyle?.backgroundColor).toBe('transparent');
		expect(noStyle?.color).toBe('#000000');
		const light1 = getTableCellBandStyle(
			{ ...data, tableStyleId: '{9D7B26C5-4107-4FEC-AEDC-1716B250A1EF}' },
			1,
			0,
			3,
			2,
			{ colorScheme: scheme },
		);
		// Light Style 1's band is tx1 at 20% alpha; tx1 routes to dk1.
		expect(String(light1?.background)).toContain('rgba(0, 0, 0, 0.2)');
	});
});

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/table-styling.pptx', import.meta.url),
);

describe('table Styles gallery round trip', () => {
	it('saves a:tableStyleId and an empty tcPr fill through the core handler', async () => {
		const buf = readFileSync(FIXTURE);
		const handler = new PptxHandler();
		const data = await handler.load(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
		);
		const slide = data.slides[0];
		const element = slide.elements.find((e) => e.type === 'table');
		const result = applyRibbonGalleryItem('tableStyles', NO_STYLE_NO_GRID, {
			element: element ?? null,
		});
		if (!element || result?.kind !== 'element') {
			throw new Error('expected a table');
		}
		const next = { ...element, ...result.patch } as PptxElement;
		const bytes = await handler.save([
			{ ...slide, elements: slide.elements.map((e) => (e.id === element.id ? next : e)) },
			...data.slides.slice(1),
		]);
		const xml = await (await JSZip.loadAsync(bytes)).file('ppt/slides/slide1.xml')!.async('string');
		expect(xml).toContain(`<a:tableStyleId>${NO_STYLE_NO_GRID}</a:tableStyleId>`);
		const reloaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const table2 = reloaded.slides[0].elements.find((e) => e.type === 'table');
		expect(table2?.type === 'table' && table2.tableData?.tableStyleId).toBe(NO_STYLE_NO_GRID);
	});
});
