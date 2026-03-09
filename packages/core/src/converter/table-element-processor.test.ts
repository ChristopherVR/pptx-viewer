import { describe, it, expect } from 'vitest';
import { TableElementProcessor } from './elements/TableElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, PptxTableData, TablePptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: false,
		processElements: async () => [],
		...overrides,
	};
}

function makeTableElement(tableData: PptxTableData): TablePptxElement {
	return {
		type: 'table',
		id: 'tbl_1',
		x: 50,
		y: 200,
		width: 860,
		height: 300,
		tableData,
	} as TablePptxElement;
}

describe('TableElementProcessor', () => {
	const processor = new TableElementProcessor();

	it('should support only the table type', () => {
		expect(processor.supportedTypes).toEqual(['table']);
	});

	it('should render a simple table as HTML table by default', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'Name' }, { text: 'Score' }] },
				{ cells: [{ text: 'Alice' }, { text: '95' }] },
				{ cells: [{ text: 'Bob' }, { text: '87' }] },
			],
			columnWidths: [0.5, 0.5],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<table>');
		expect(result).toContain('</table>');
		expect(result).toContain('<th');
		expect(result).toContain('Name');
		expect(result).toContain('Score');
		expect(result).toContain('<td');
		expect(result).toContain('Alice');
		expect(result).toContain('95');
	});

	it('should render a simple table as markdown table in semantic mode', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'Product' }, { text: 'Revenue' }] },
				{ cells: [{ text: 'Widget A' }, { text: '$3.4M' }] },
			],
			columnWidths: [0.6, 0.4],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('| Product | Revenue |');
		expect(result).toContain('| --- | --- |');
		expect(result).toContain('| Widget A | $3.4M |');
	});

	it('should handle merged cells with colspan in HTML mode', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{ text: 'Header spanning two columns', gridSpan: 2 },
					],
				},
				{
					cells: [
						{ text: 'Left' },
						{ text: 'Right' },
					],
				},
			],
			columnWidths: [0.5, 0.5],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('colspan="2"');
		expect(result).toContain('Header spanning two columns');
	});

	it('should handle row spans in HTML mode', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{ text: 'Spanning', rowSpan: 2 },
						{ text: 'Top right' },
					],
				},
				{
					cells: [
						{ text: '', vMerge: true },
						{ text: 'Bottom right' },
					],
				},
			],
			columnWidths: [0.5, 0.5],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('rowspan="2"');
		expect(result).toContain('Spanning');
		expect(result).toContain('Top right');
		expect(result).toContain('Bottom right');
		// Merged cell should be skipped
		const trMatches = result!.match(/<tr>/g);
		expect(trMatches?.length).toBe(2);
	});

	it('should fall back to HTML table for merged cells in semantic mode', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{ text: 'Merged header', gridSpan: 2 },
					],
				},
				{
					cells: [
						{ text: 'A' },
						{ text: 'B' },
					],
				},
			],
			columnWidths: [0.5, 0.5],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Should use HTML since there are merged cells
		expect(result).toContain('<table>');
		expect(result).toContain('colspan="2"');
	});

	it('should return null for empty table data', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [],
			columnWidths: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should return null for non-table element type', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 'txt_1',
			x: 0, y: 0, width: 100, height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should apply cell styling in HTML mode', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{
							text: 'Styled',
							style: {
								backgroundColor: '#FF0000',
								align: 'center',
								bold: true,
							},
						},
					],
				},
			],
			columnWidths: [1],
			firstRowHeader: false,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('background:#FF0000');
		expect(result).toContain('text-align:center');
	});

	it('should render first row as header by default', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'Header' }] },
				{ cells: [{ text: 'Data' }] },
			],
			columnWidths: [1],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<th');
		expect(result).toContain('Header');
	});

	it('should render all rows as td when firstRowHeader is false', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'Not a header' }] },
				{ cells: [{ text: 'Data' }] },
			],
			columnWidths: [1],
			firstRowHeader: false,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).not.toContain('<th');
		expect(result).toContain('<td');
	});

	it('should render text segments with formatting in cells', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{
							text: 'bold text',
							style: {},
						} as unknown as { text: string; style: unknown; textSegments: unknown[] },
					],
				},
			],
			columnWidths: [1],
			firstRowHeader: false,
		});
		// Add textSegments to the cell manually
		const cell = (element.tableData!.rows[0].cells[0] as unknown as Record<string, unknown>);
		cell.textSegments = [
			{ text: 'bold text', style: { bold: true, fontSize: 14 } },
		];
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('bold text');
		expect(result).toContain('font-weight:bold');
	});

	it('should escape pipe characters in markdown table cells', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'Header' }] },
				{ cells: [{ text: 'value | with pipe' }] },
			],
			columnWidths: [1],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('value \\| with pipe');
	});

	it('should handle markdown table with no header row', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeTableElement({
			rows: [
				{ cells: [{ text: 'A' }, { text: 'B' }] },
				{ cells: [{ text: 'C' }, { text: 'D' }] },
			],
			columnWidths: [0.5, 0.5],
			firstRowHeader: false,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Should have an empty header and divider prepended
		const lines = result!.split('\n');
		expect(lines[0]).toContain('|  |  |');
		expect(lines[1]).toContain('| --- | --- |');
	});

	it('should handle border styling in HTML cells', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{
							text: 'Bordered',
							style: {
								borderTopWidth: 2,
								borderTopColor: '#000000',
								borderBottomWidth: 1,
								borderBottomColor: '#999999',
							},
						},
					],
				},
			],
			columnWidths: [1],
			firstRowHeader: false,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('border-top:2px solid #000000');
		expect(result).toContain('border-bottom:1px solid #999999');
	});

	it('should handle cell margins as padding in HTML', async () => {
		const ctx = makeContext();
		const element = makeTableElement({
			rows: [
				{
					cells: [
						{
							text: 'Padded',
							style: {
								marginTop: 5,
								marginRight: 10,
								marginBottom: 5,
								marginLeft: 10,
							},
						},
					],
				},
			],
			columnWidths: [1],
			firstRowHeader: false,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('padding:5px 10px 5px 10px');
	});
});
