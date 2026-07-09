import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { TableElementProcessor } from './TableElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {} as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeTableElement(
	tableData: Record<string, unknown> | undefined,
	overrides: Record<string, unknown> = {},
): PptxElement {
	return {
		type: 'table',
		id: 'tbl_1',
		x: 50,
		y: 200,
		width: 860,
		height: 300,
		tableData,
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tableElementProcessor', () => {
	const processor = new TableElementProcessor();

	it('reports supported types as table', () => {
		expect(processor.supportedTypes).toStrictEqual(['table']);
	});

	it('returns null for non-table element', async () => {
		const el = {
			type: 'text',
			id: 'txt_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('returns null when tableData is undefined', async () => {
		const result = await processor.process(makeTableElement(undefined), makeCtx());
		expect(result).toBeNull();
	});

	it('returns null when table has no rows', async () => {
		const result = await processor.process(makeTableElement({ rows: [] }), makeCtx());
		expect(result).toBeNull();
	});

	it('renders a simple two-row table as HTML', async () => {
		const tableData = {
			rows: [
				{ cells: [{ text: 'Name' }, { text: 'Score' }] },
				{ cells: [{ text: 'Alice' }, { text: '95' }] },
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('<table>');
		expect(result).toContain('</table>');
		expect(result).toContain('<th');
		expect(result).toContain('Name');
		expect(result).toContain('<td');
		expect(result).toContain('Alice');
	});

	it('uses th for header row and td for data rows', async () => {
		const tableData = {
			rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'Data' }] }],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('<th');
		expect(result).toContain('Header');
		expect(result).toContain('<td');
		expect(result).toContain('Data');
	});

	it('uses td for first row when firstRowHeader is false', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [{ cells: [{ text: 'Not a header' }] }],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).not.toContain('<th');
		expect(result).toContain('<td');
	});

	it('handles colspan from gridSpan', async () => {
		const tableData = {
			rows: [
				{ cells: [{ text: 'Merged', gridSpan: 2 }] },
				{ cells: [{ text: 'A' }, { text: 'B' }] },
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('colspan="2"');
	});

	it('handles rowspan', async () => {
		const tableData = {
			rows: [
				{ cells: [{ text: 'Spanning', rowSpan: 2 }, { text: 'B' }] },
				{ cells: [{ text: 'B2', vMerge: true }, { text: 'C' }] },
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('rowspan="2"');
	});

	it('skips vMerge cells', async () => {
		const tableData = {
			rows: [{ cells: [{ text: 'A' }] }, { cells: [{ text: '', vMerge: true }] }],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		// The vMerge cell should not appear as a separate <td>
		const tdCount = (result!.match(/<td/g) ?? []).length;
		expect(tdCount).toBe(0); // only the header <th> for first row
	});

	it('skips hMerge cells', async () => {
		const tableData = {
			rows: [{ cells: [{ text: 'A' }, { text: '', hMerge: true }] }],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		// hMerge cell should be skipped
		expect(result).toContain('A');
	});

	it('applies cell background color style', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Colored',
							style: { backgroundColor: '#FF0000' },
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('background:#FF0000');
	});

	it('applies cell text alignment style', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Centered',
							style: { align: 'center' },
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('text-align:center');
	});

	it('applies cell border styles', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Bordered',
							style: {
								borderTopWidth: 1,
								borderTopColor: '#000',
							},
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('border-top:1px solid #000');
	});

	it('applies fallback border from borderColor', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Bordered',
							style: { borderColor: '#CCC' },
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('border:1px solid #CCC');
	});

	it('applies cell padding from margins', async () => {
		const tableData = {
			firstRowHeader: false,
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
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('padding:5px 10px 5px 10px');
	});

	it('renders cell text segments with per-run styling', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Bold text',
							textSegments: [{ text: 'Bold text', style: { bold: true } }],
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('font-weight:bold');
	});

	it('renders paragraph breaks in cells as <br>', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [
				{
					cells: [
						{
							text: 'Line1\nLine2',
							textSegments: [
								{ text: 'Line1', style: {} },
								{ isParagraphBreak: true, text: '', style: {} },
								{ text: 'Line2', style: {} },
							],
						},
					],
				},
			],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('<br>');
	});

	it('escapes HTML in cell text', async () => {
		const tableData = {
			firstRowHeader: false,
			rows: [{ cells: [{ text: '<script>alert("xss")</script>' }] }],
		};
		const result = await processor.process(makeTableElement(tableData), makeCtx());
		expect(result).toContain('&lt;script&gt;');
		expect(result).not.toContain('<script>');
	});

	describe('semantic mode (markdown tables)', () => {
		it('renders a simple table as markdown', async () => {
			const tableData = {
				rows: [
					{ cells: [{ text: 'Name' }, { text: 'Score' }] },
					{ cells: [{ text: 'Alice' }, { text: '95' }] },
				],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			expect(result).toContain('| Name');
			expect(result).toContain('| ---');
			expect(result).toContain('| Alice');
			expect(result).not.toContain('<table>');
		});

		it('falls back to HTML for tables with merged cells', async () => {
			const tableData = {
				rows: [
					{ cells: [{ text: 'Merged', gridSpan: 2 }] },
					{ cells: [{ text: 'A' }, { text: 'B' }] },
				],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			expect(result).toContain('<table>');
		});

		it('falls back to HTML for tables with vMerge', async () => {
			const tableData = {
				rows: [{ cells: [{ text: 'A' }] }, { cells: [{ text: '', vMerge: true }] }],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			expect(result).toContain('<table>');
		});

		it('applies markdown formatting in semantic mode', async () => {
			const tableData = {
				rows: [
					{ cells: [{ text: 'Header' }] },
					{
						cells: [
							{
								text: 'Bold',
								textSegments: [{ text: 'Bold', style: { bold: true } }],
							},
						],
					},
				],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			expect(result).toContain('**Bold**');
		});

		it('escapes pipe characters in markdown table cells', async () => {
			const tableData = {
				rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'A | B' }] }],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			expect(result).toContain('A \\| B');
		});

		it('escapes backslashes before pipes so a literal backslash cannot neutralize the pipe escape', async () => {
			const tableData = {
				rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'foo\\|bar' }] }],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			const dataRow = result!.split('\n').find((line) => line.includes('foo'));
			// The literal backslash (\) must itself be escaped (-> \\) before the
			// pipe is escaped (-> \|); otherwise the backslash would combine with
			// the inserted escape and leave the pipe unescaped, corrupting the
			// single-column row's two delimiter pipes (leading + trailing).
			expect(dataRow).toBe('| foo\\\\\\|bar |');
		});

		it('prepends empty header when firstRowHeader is false', async () => {
			const tableData = {
				firstRowHeader: false,
				rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }],
			};
			const ctx = makeCtx({ semanticMode: true });
			const result = await processor.process(makeTableElement(tableData), ctx);
			const lines = result!.split('\n');
			// First line should be the empty header, second should be divider
			expect(lines[0]).toContain('|  |');
			expect(lines[1]).toContain('| ---');
		});
	});
});
