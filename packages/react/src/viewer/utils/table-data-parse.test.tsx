import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import {
	getGraphicDataFromElement,
	getTableXmlFromElement,
	parseTableElementData,
} from './table-data-parse';
import { renderTableElement } from './table-render';

function loadedTable(columnWidths?: number[]): TablePptxElement {
	return {
		id: 'width-table',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 80,
		...(columnWidths
			? { tableData: { columnWidths, rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }] } }
			: {}),
		rawXml: {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': { 'a:gridCol': [{ '@_w': '3000' }, { '@_w': '7000' }] },
						'a:tr': {
							'a:tc': [
								{ 'a:txBody': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'A' } } } },
								{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'B' } } } },
							],
						},
					},
				},
			},
		},
	} as TablePptxElement;
}

describe('loaded-table width edits', () => {
	it.each([
		[0.25, 0.75],
		[0, 1],
		[1 / 3, 2 / 3],
	])('prefers valid model widths %s', (...widths) => {
		const element = loadedTable(widths);
		const original = structuredClone(element);
		const before = parseTableElementData(loadedTable(), {})!;
		const parsed = parseTableElementData(element, {})!;
		expect(parsed.columnPercentages).toStrictEqual(widths.map((width) => width * 100));
		expect(parsed.cells).toStrictEqual(before.cells);
		expect(parsed.rows).toStrictEqual(before.rows);
		expect(element).toStrictEqual(original);
	});

	it('repaints column widths and resize handles from each current history snapshot', () => {
		const original = loadedTable([0.3, 0.7]);
		const edited = { ...original, tableData: { ...original.tableData!, columnWidths: [0.4, 0.6] } };
		for (const [element, width] of [
			[original, 30],
			[edited, 40],
			[original, 30],
			[edited, 40],
		] as const) {
			const markup = renderToStaticMarkup(renderTableElement(element, {}, { editable: true }));
			expect(markup).toContain(`<col style="width:${width.toFixed(2)}%"`);
			expect(markup).toContain(`<col style="width:${(100 - width).toFixed(2)}%"`);
			expect(markup).toContain(`left:calc(${width}% - 3px)`);
		}
		expect(edited.rawXml).toBe(original.rawXml);
		expect(parseTableElementData(loadedTable(), {})!.columnPercentages).toStrictEqual([30, 70]);
	});

	it.each([[], [1], [0.2, 0.3, 0.5], [NaN, 0.5], [Infinity, 0], [-0.2, 1.2], [0, 0], [1, 3]])(
		'falls back to authored widths for invalid model widths %s',
		(...widths) => {
			expect(parseTableElementData(loadedTable(widths), {})!.columnPercentages).toStrictEqual([
				30, 70,
			]);
		},
	);

	it('retains the data-only renderer for tables without raw XML', () => {
		const element = loadedTable([0.4, 0.6]);
		delete element.rawXml;
		expect(parseTableElementData(element, {})).toBeNull();
		const markup = renderToStaticMarkup(renderTableElement(element, {}, { editable: true }));
		expect(markup).toContain('width:40.00%');
		expect(markup).toContain('left:calc(40% - 3px)');
	});
});

// ── getGraphicDataFromElement ─────────────────────────────────────────

describe('getGraphicDataFromElement', () => {
	it('returns undefined when rawXml is absent', () => {
		const el = { id: 'e1', type: 'table' } as PptxElement;
		expect(getGraphicDataFromElement(el)).toBeUndefined();
	});

	it('returns undefined when a:graphic is absent', () => {
		const el = { id: 'e1', type: 'table', rawXml: {} } as unknown as PptxElement;
		expect(getGraphicDataFromElement(el)).toBeUndefined();
	});

	it('returns graphicData when present', () => {
		const graphicData = { '@_uri': 'test' };
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: { 'a:graphic': { 'a:graphicData': graphicData } },
		} as unknown as PptxElement;
		expect(getGraphicDataFromElement(el)).toBe(graphicData);
	});
});

// ── getTableXmlFromElement ────────────────────────────────────────────

describe('getTableXmlFromElement', () => {
	it('returns undefined when no table XML exists', () => {
		const el = { id: 'e1', type: 'table' } as PptxElement;
		expect(getTableXmlFromElement(el)).toBeUndefined();
	});

	it('returns the a:tbl node when present', () => {
		const tbl = { 'a:tr': [] };
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': { 'a:tbl': tbl },
				},
			},
		} as unknown as PptxElement;
		expect(getTableXmlFromElement(el)).toBe(tbl);
	});
});

// ── parseTableElementData ─────────────────────────────────────────────

describe('parseTableElementData', () => {
	it('returns null when no table XML exists', () => {
		const el = { id: 'e1', type: 'table' } as PptxElement;
		expect(parseTableElementData(el, {})).toBeNull();
	});

	it('returns null when a:tr is empty', () => {
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {},
					},
				},
			},
		} as unknown as PptxElement;
		expect(parseTableElementData(el, {})).toBeNull();
	});

	it('parses a simple 2x2 table', () => {
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tblGrid': {
								'a:gridCol': [{ '@_w': '5000' }, { '@_w': '5000' }],
							},
							'a:tr': [
								{
									'a:tc': [
										{
											'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'A1' } } },
										},
										{
											'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'B1' } } },
										},
									],
								},
								{
									'a:tc': [
										{
											'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'A2' } } },
										},
										{
											'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'B2' } } },
										},
									],
								},
							],
						},
					},
				},
			},
		} as unknown as PptxElement;

		const result = parseTableElementData(el, {});
		expect(result).not.toBeNull();
		expect(result!.rowCount).toBe(2);
		expect(result!.columnCount).toBe(2);
		expect(result!.cells).toHaveLength(4);
		expect(result!.cells[0].text).toBe('A1');
		expect(result!.cells[1].text).toBe('B1');
		expect(result!.cells[2].text).toBe('A2');
		expect(result!.cells[3].text).toBe('B2');
	});

	it('computes column percentages from grid widths', () => {
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tblGrid': {
								'a:gridCol': [{ '@_w': '3000' }, { '@_w': '7000' }],
							},
							'a:tr': [
								{
									'a:tc': [
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'X' } } } },
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'Y' } } } },
									],
								},
							],
						},
					},
				},
			},
		} as unknown as PptxElement;

		const result = parseTableElementData(el, {});
		expect(result).not.toBeNull();
		expect(result!.columnPercentages).toHaveLength(2);
		expect(result!.columnPercentages[0]).toBeCloseTo(30, 0);
		expect(result!.columnPercentages[1]).toBeCloseTo(70, 0);
	});

	it('handles single-row single-cell table', () => {
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tr': {
								'a:tc': {
									'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'Only' } } },
								},
							},
						},
					},
				},
			},
		} as unknown as PptxElement;

		const result = parseTableElementData(el, {});
		expect(result).not.toBeNull();
		expect(result!.rowCount).toBe(1);
		expect(result!.columnCount).toBe(1);
		expect(result!.cells).toHaveLength(1);
		expect(result!.cells[0].text).toBe('Only');
	});

	it('sets rowIndex and columnIndex correctly on cells', () => {
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tr': [
								{
									'a:tc': [
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'R0C0' } } } },
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'R0C1' } } } },
									],
								},
								{
									'a:tc': [
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'R1C0' } } } },
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'R1C1' } } } },
									],
								},
							],
						},
					},
				},
			},
		} as unknown as PptxElement;

		const result = parseTableElementData(el, {});
		expect(result).not.toBeNull();
		expect(result!.cells[0].rowIndex).toBe(0);
		expect(result!.cells[0].columnIndex).toBe(0);
		expect(result!.cells[1].rowIndex).toBe(0);
		expect(result!.cells[1].columnIndex).toBe(1);
		expect(result!.cells[2].rowIndex).toBe(1);
		expect(result!.cells[2].columnIndex).toBe(0);
		expect(result!.cells[3].rowIndex).toBe(1);
		expect(result!.cells[3].columnIndex).toBe(1);
	});

	it('uses max of grid columns and actual cell count for columnCount', () => {
		// Grid says 3 columns, but rows only have 2 cells
		const el = {
			id: 'e1',
			type: 'table',
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tblGrid': {
								'a:gridCol': [{ '@_w': '1000' }, { '@_w': '1000' }, { '@_w': '1000' }],
							},
							'a:tr': [
								{
									'a:tc': [
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'A' } } } },
										{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'B' } } } },
									],
								},
							],
						},
					},
				},
			},
		} as unknown as PptxElement;

		const result = parseTableElementData(el, {});
		expect(result).not.toBeNull();
		expect(result!.columnCount).toBe(3);
	});
});
