import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { readOleSheetGrid, writeOleSheetCellEdit } from './ole-sheet-xlsx-editor';

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>
</workbook>`;

const SHARED_STRINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">
  <si><t>Revenue</t></si>
</sst>`;

const SHEET1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row>
  </sheetData>
</worksheet>`;

async function buildMinimalXlsx(): Promise<Uint8Array> {
	const zip = new JSZip();
	zip.file('xl/workbook.xml', WORKBOOK_XML);
	zip.file('xl/sharedStrings.xml', SHARED_STRINGS_XML);
	zip.file('xl/worksheets/sheet1.xml', SHEET1_XML);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('ole-sheet-xlsx-editor', () => {
	it('reads the first worksheet into a bounded grid, resolving shared strings', async () => {
		const xlsx = await buildMinimalXlsx();
		const grid = await readOleSheetGrid(xlsx);
		expect(grid).toBeDefined();
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
		expect(grid!.rows[0]!.cells[0]!.isNumeric).toBeFalsy();
		expect(grid!.rows[0]!.cells[1]!.value).toBe('42');
		expect(grid!.rows[0]!.cells[1]!.isNumeric).toBeTruthy();
	});

	it('returns undefined for a payload with no readable worksheet', async () => {
		const zip = new JSZip();
		zip.file('readme.txt', 'not a workbook');
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		await expect(readOleSheetGrid(bytes)).resolves.toBeUndefined();
	});

	it('writes a numeric cell edit and marks the workbook for full recalculation', async () => {
		const xlsx = await buildMinimalXlsx();
		const updated = await writeOleSheetCellEdit(xlsx, { row: 0, col: 1, value: '99' });
		const grid = await readOleSheetGrid(updated);
		expect(grid!.rows[0]!.cells[1]!.value).toBe('99');

		const zip = await JSZip.loadAsync(updated);
		const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
		expect(workbookXml).toContain('fullCalcOnLoad="1"');
	});

	it('writes a text cell edit as a self-contained inlineStr, leaving the shared string table untouched', async () => {
		const xlsx = await buildMinimalXlsx();
		const updated = await writeOleSheetCellEdit(xlsx, {
			row: 0,
			col: 0,
			value: 'Costs',
			forceText: true,
		});
		const grid = await readOleSheetGrid(updated);
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Costs');

		const zip = await JSZip.loadAsync(updated);
		const sharedStrings = await zip.file('xl/sharedStrings.xml')!.async('string');
		expect(sharedStrings).toContain('Revenue');
		expect(sharedStrings).not.toContain('Costs');
	});

	it('leaves cells unrelated to the edit byte-identical', async () => {
		const xlsx = await buildMinimalXlsx();
		const updated = await writeOleSheetCellEdit(xlsx, { row: 0, col: 1, value: '99' });
		const zip = await JSZip.loadAsync(updated);
		const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
		expect(sheetXml).toContain('t="s"');
		expect(sheetXml).toContain('<v>0</v>');
	});
});
