/**
 * Table-cell raw-XML edits against markup a real deck actually contains.
 *
 * The fixtures go through `XMLParser` deliberately: `<a:pPr/>`, `<a:rPr/>` and
 * `<a:p/>` are all legal, all common, and all materialise as the empty STRING.
 * Object literals cannot express that, so a test written from literals proves
 * nothing about the paths that broke here.
 */
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { PptxElement, PptxTableData, TablePptxElement, XmlObject } from '../../types';
import {
	rebuildTableStructureInRawXml,
	updateCellTextInRawXml,
	updateCellTextStyleInRawXml,
	updateMergeAttrsInRawXml,
} from './table-cell-rawxml-ops';
import { ensureArray } from './table-structural-helpers';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: false,
});
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Wrap cell markup in the graphic-frame envelope `getTblFromRawXml` walks. */
function tableElement(cellsXml: string, columnCount = 1): PptxElement {
	const parsed = parser.parse(
		`<f><a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid>${'<a:gridCol w="100"/>'.repeat(columnCount)}</a:tblGrid>` +
			`<a:tr h="100">${cellsXml}</a:tr></a:tbl></a:graphicData></a:graphic></f>`,
	) as Record<string, XmlObject>;
	return {
		id: 'e1',
		type: 'table',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rawXml: parsed['f'],
	} as unknown as PptxElement;
}

function cellOf(rawXml: XmlObject): XmlObject {
	return cellsOf(rawXml)[0];
}

function cellsOf(rawXml: XmlObject, rowIndex = 0): XmlObject[] {
	return rawCellsOf(rawRowsOf(rawXml)[rowIndex]);
}

function paragraphsOf(rawXml: XmlObject): XmlObject[] {
	const txBody = cellOf(rawXml)['a:txBody'] as XmlObject;
	return ensureArray(txBody['a:p'] as XmlObject | XmlObject[] | undefined);
}

function rawTableOf(rawXml: XmlObject): XmlObject {
	const graphic = rawXml['a:graphic'] as XmlObject;
	const data = graphic['a:graphicData'] as XmlObject;
	return data['a:tbl'] as XmlObject;
}

function rawRowsOf(rawXml: XmlObject): XmlObject[] {
	return ensureArray(rawTableOf(rawXml)['a:tr'] as XmlObject | XmlObject[] | undefined);
}

function rawGridColumnsOf(rawXml: XmlObject): XmlObject[] {
	const grid = rawTableOf(rawXml)['a:tblGrid'] as XmlObject;
	return ensureArray(grid['a:gridCol'] as XmlObject | XmlObject[] | undefined);
}

function rawCellsOf(row: XmlObject): XmlObject[] {
	return ensureArray(row['a:tc'] as XmlObject | XmlObject[] | undefined);
}

function richStructureCellXml(id: string, text = id): XmlObject {
	return {
		'@_id': id,
		'a:txBody': {
			'a:bodyPr': { '@_anchor': 'ctr' },
			'a:p': {
				'a:r': [
					{ 'a:rPr': { '@_b': '1', '@_lang': 'en-US' }, 'a:t': text.slice(0, 1) },
					{ 'a:rPr': { '@_i': '1', '@_lang': 'en-US' }, 'a:t': text.slice(1) },
				],
			},
		},
		'a:tcPr': {
			'@_marL': '91440',
			'a:extLst': { 'a:ext': { '@_uri': `urn:${id}`, 'x:opaque': { '@_id': id } } },
		},
	};
}

function structureTableElement(): TablePptxElement {
	const rows = Array.from({ length: 3 }, (_, row) => ({
		height: (row + 1) * 10,
		cells: Array.from({ length: 3 }, (_cell, column) => ({
			text: `r${row}c${column}`,
		})),
	}));
	return {
		id: 'structure-table',
		type: 'table',
		x: 0,
		y: 0,
		width: 300,
		height: 60,
		tableData: {
			columnWidths: [0.2, 0.3, 0.5],
			rows,
		},
		rawXml: {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': {
							'a:gridCol': [
								{ '@_w': '200', '@_id': 'g0', 'x:opaque': { '@_id': 'grid-0' } },
								{ '@_w': '300', '@_id': 'g1', 'x:opaque': { '@_id': 'grid-1' } },
								{ '@_w': '500', '@_id': 'g2', 'x:opaque': { '@_id': 'grid-2' } },
							],
						},
						'a:tr': rows.map((row, rowIndex) => ({
							'@_h': String(row.height! * 9525),
							'@_id': `r${rowIndex}`,
							'x:opaque': { '@_id': `row-${rowIndex}` },
							'a:tc': row.cells.map((_, columnIndex) =>
								richStructureCellXml(`r${rowIndex}c${columnIndex}`),
							),
						})),
					},
				},
			},
		},
	} as TablePptxElement;
}

function insertDataRow(data: PptxTableData, index: number): PptxTableData {
	const rows = [...data.rows];
	rows.splice(index, 0, {
		height: 40,
		cells: data.columnWidths.map(() => ({ text: '', style: {} })),
	});
	return { ...data, rows };
}

function deleteDataRow(data: PptxTableData, index: number): PptxTableData {
	return { ...data, rows: data.rows.filter((_, rowIndex) => rowIndex !== index) };
}

function insertDataColumn(data: PptxTableData, index: number): PptxTableData {
	const columnWidths = [...data.columnWidths];
	const sourceIndex = index < columnWidths.length ? index : columnWidths.length - 1;
	const halfWidth = (columnWidths[sourceIndex] ?? 0) / 2;
	columnWidths[sourceIndex] = halfWidth;
	columnWidths.splice(index, 0, halfWidth);
	return {
		...data,
		columnWidths,
		rows: data.rows.map((row) => {
			const cells = [...row.cells];
			cells.splice(index, 0, { text: '', style: {} });
			return { ...row, cells };
		}),
	};
}

function deleteDataColumn(data: PptxTableData, index: number): PptxTableData {
	const remainingWidths = data.columnWidths.filter((_, columnIndex) => columnIndex !== index);
	const total = remainingWidths.reduce((sum, width) => sum + width, 0);
	return {
		...data,
		columnWidths: remainingWidths.map((width) => width / total),
		rows: data.rows.map((row) => ({
			...row,
			cells: row.cells.filter((_, columnIndex) => columnIndex !== index),
		})),
	};
}

function rebuild(
	element: TablePptxElement,
	next: PptxTableData,
	edit: Parameters<typeof rebuildTableStructureInRawXml>[2],
): XmlObject {
	const rawXml = rebuildTableStructureInRawXml(element, next, edit);
	expect(rawXml).toBeDefined();
	return rawXml!;
}

type MergeAxis = 'row' | 'column';

function mergedTableElement(
	axis: MergeAxis,
	anchorText = 'Anchor',
	targetText = 'Target',
): TablePptxElement {
	const anchor = {
		text: anchorText,
		textRuns: [{ text: anchorText, bold: true }],
		style: { fontFamily: 'Anchor Font' },
		...(axis === 'row' ? { rowSpan: 2 } : { gridSpan: 2 }),
	};
	const target = {
		text: targetText,
		textRuns: [{ text: targetText, italic: true }],
		style: { fontFamily: 'Target Font' },
		...(axis === 'row' ? { vMerge: true } : { hMerge: true }),
	};
	const anchorXml = richStructureCellXml('anchor', anchorText);
	const targetXml = richStructureCellXml('target', targetText);
	anchorXml[axis === 'row' ? '@_rowSpan' : '@_gridSpan'] = '2';
	targetXml[axis === 'row' ? '@_vMerge' : '@_hMerge'] = '1';

	const tableData: PptxTableData =
		axis === 'row'
			? {
					columnWidths: [1],
					rows: [
						{ height: 10, cells: [anchor] },
						{ height: 20, cells: [target] },
					],
				}
			: {
					columnWidths: [0.5, 0.5],
					rows: [{ height: 10, cells: [anchor, target] }],
				};
	const rawRows: XmlObject[] =
		axis === 'row'
			? [
					{ '@_h': '95250', '@_id': 'anchor-row', 'a:tc': anchorXml },
					{ '@_h': '190500', '@_id': 'target-row', 'a:tc': targetXml },
				]
			: [{ '@_h': '95250', '@_id': 'merge-row', 'a:tc': [anchorXml, targetXml] }];

	return {
		id: `merged-${axis}`,
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		tableData,
		rawXml: {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': {
							'a:gridCol': Array.from({ length: axis === 'row' ? 1 : 2 }, (_, index) => ({
								'@_w': axis === 'row' ? '1000' : '500',
								'@_id': `g${index}`,
							})),
						},
						'a:tr': rawRows.length === 1 ? rawRows[0] : rawRows,
					},
				},
			},
		},
	} as TablePptxElement;
}

function dataAfterDeletingMergeAnchor(element: TablePptxElement, axis: MergeAxis): PptxTableData {
	const source = element.tableData!;
	const anchor = source.rows[0].cells[0];
	const target = axis === 'row' ? source.rows[1].cells[0] : source.rows[0].cells[1];
	const promoted = {
		...target,
		text: anchor.text || target.text,
		textRuns: anchor.text ? anchor.textRuns : target.textRuns,
		style: target.style || anchor.style,
		...(axis === 'row'
			? { rowSpan: undefined, vMerge: undefined, gridSpan: anchor.gridSpan }
			: { gridSpan: undefined, hMerge: undefined, rowSpan: anchor.rowSpan }),
	};
	return axis === 'row'
		? { ...source, rows: [{ ...source.rows[1], cells: [promoted] }] }
		: { ...source, columnWidths: [1], rows: [{ ...source.rows[0], cells: [promoted] }] };
}

function dataAfterDeletingMergeContinuation(
	element: TablePptxElement,
	axis: MergeAxis,
): PptxTableData {
	const source = element.tableData!;
	const anchor = source.rows[0].cells[0];
	const unmergedAnchor = {
		...anchor,
		...(axis === 'row' ? { rowSpan: undefined } : { gridSpan: undefined }),
	};
	return axis === 'row'
		? { ...source, rows: [{ ...source.rows[0], cells: [unmergedAnchor] }] }
		: { ...source, columnWidths: [1], rows: [{ ...source.rows[0], cells: [unmergedAnchor] }] };
}

describe('updateCellTextStyleInRawXml with bare properties elements', () => {
	const bareProps =
		'<a:tc><a:txBody><a:bodyPr/><a:p><a:pPr/><a:r><a:rPr/><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>';

	it('aligns a cell whose <a:pPr/> is bare instead of throwing', () => {
		const element = tableElement(bareProps);
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'center' });
		}).not.toThrow();
		const pPr = paragraphsOf(result as XmlObject)[0]['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('ctr');
	});

	it('bolds a run whose <a:rPr/> is bare instead of throwing', () => {
		const element = tableElement(bareProps);
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { bold: true });
		}).not.toThrow();
		const run = paragraphsOf(result as XmlObject)[0]['a:r'] as XmlObject;
		expect((run['a:rPr'] as XmlObject)['@_b']).toBe('1');
	});

	it('leaves the run text intact while healing its properties', () => {
		const result = updateCellTextStyleInRawXml(tableElement(bareProps), 0, 0, {
			bold: true,
		}) as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(run['a:t']).toBe('hi');
	});

	it('creates a missing <a:rPr> ahead of <a:t>, as CT_RegularTextRun requires', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { italic: true }) as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
	});

	it('creates a missing <a:pPr> ahead of the runs, as CT_TextParagraph requires', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'right' }) as XmlObject;
		expect(Object.keys(paragraphsOf(result)[0])).toStrictEqual(['a:pPr', 'a:r']);
	});

	it('styles an empty paragraph through its bare <a:endParaRPr/>', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:endParaRPr/></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { bold: true }) as XmlObject;
		const endParaRPr = paragraphsOf(result)[0]['a:endParaRPr'] as XmlObject;
		expect(endParaRPr['@_b']).toBe('1');
	});

	it('aligns a cell holding nothing but a lone <a:p/>', () => {
		const element = tableElement('<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody></a:tc>');
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'justify' });
		}).not.toThrow();
		const paragraphs = paragraphsOf(result as XmlObject);
		expect(paragraphs).toHaveLength(1);
		expect((paragraphs[0]['a:pPr'] as XmlObject)['@_algn']).toBe('just');
	});
});

describe('updateCellTextInRawXml emits CT_TextBody in schema order', () => {
	it('puts a:bodyPr and a:lstStyle before a:p', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const txBody = cellOf(result)['a:txBody'] as XmlObject;
		expect(Object.keys(txBody)).toStrictEqual(['a:bodyPr', 'a:lstStyle', 'a:p']);
		expect(builder.build({ 'a:txBody': txBody })).toContain(
			'<a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle><a:p>',
		);
	});

	it('keeps a preserved bare <a:pPr/> and puts it ahead of the run', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:pPr/><a:r><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const paragraph = paragraphsOf(result)[0];
		expect(Object.keys(paragraph)).toStrictEqual(['a:pPr', 'a:r']);
		expect((paragraph['a:r'] as XmlObject)['a:t']).toBe('new');
	});

	it('puts run properties ahead of the text', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en"/><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
	});
});

describe('rebuildTableStructureInRawXml structural edit descriptors', () => {
	it('inserts one blank row while retaining every surviving row and cell node', () => {
		const source = structureTableElement();
		const originalRawXml = structuredClone(source.rawXml);
		const next = insertDataRow(source.tableData!, 1);
		const result = rebuild(source, next, { axis: 'row', action: 'insert', index: 1 });
		const rows = rawRowsOf(result);

		expect(rows.map((row) => row['@_id'])).toStrictEqual(['r0', undefined, 'r1', 'r2']);
		expect(rows.map((row) => row['@_h'])).toStrictEqual(['95250', '381000', '190500', '285750']);
		expect(rows[0]['x:opaque']).toStrictEqual({ '@_id': 'row-0' });
		expect(rows[2]['x:opaque']).toStrictEqual({ '@_id': 'row-1' });
		expect(rows[3]['x:opaque']).toStrictEqual({ '@_id': 'row-2' });
		expect(rawCellsOf(rows[1]).map((cell) => cell['@_id'])).toStrictEqual([
			undefined,
			undefined,
			undefined,
		]);
		rawCellsOf(rows[1]).forEach((cell) => {
			expect(cell['a:tcPr']).toStrictEqual({});
			expect(cell['a:txBody']).toStrictEqual({
				'a:bodyPr': {},
				'a:lstStyle': {},
				'a:p': { 'a:endParaRPr': { '@_lang': 'en-US', '@_dirty': '0' } },
			});
		});
		expect(rawCellsOf(rows[2])[0]).toStrictEqual(rawCellsOf(rawRowsOf(originalRawXml!)[1])[0]);
		expect(rawGridColumnsOf(result)).toStrictEqual(rawGridColumnsOf(originalRawXml!));
		expect(source.rawXml).toStrictEqual(originalRawXml);
	});

	it('inserts one blank cell per row while retaining grid, row, and cell provenance', () => {
		const source = structureTableElement();
		const originalRows = rawRowsOf(source.rawXml!);
		const next = insertDataColumn(source.tableData!, 1);
		const result = rebuild(source, next, { axis: 'column', action: 'insert', index: 1 });
		const rows = rawRowsOf(result);
		const columns = rawGridColumnsOf(result);

		expect(columns.map((column) => column['@_id'])).toStrictEqual(['g0', undefined, 'g1', 'g2']);
		expect(columns.map((column) => column['@_w'])).toStrictEqual(['200', '150', '150', '500']);
		expect(columns.reduce((sum, column) => sum + Number(column['@_w']), 0)).toBe(1000);
		expect(columns[0]['x:opaque']).toStrictEqual({ '@_id': 'grid-0' });
		expect(columns[2]['x:opaque']).toStrictEqual({ '@_id': 'grid-1' });
		expect(columns[3]['x:opaque']).toStrictEqual({ '@_id': 'grid-2' });
		expect(rows.map((row) => row['@_id'])).toStrictEqual(['r0', 'r1', 'r2']);
		expect(rows.map((row) => row['@_h'])).toStrictEqual(['95250', '190500', '285750']);
		rows.forEach((row, rowIndex) => {
			const cells = rawCellsOf(row);
			expect(cells.map((cell) => cell['@_id'])).toStrictEqual([
				`r${rowIndex}c0`,
				undefined,
				`r${rowIndex}c1`,
				`r${rowIndex}c2`,
			]);
			expect(cells[1]['a:tcPr']).toStrictEqual({});
			expect(cells[2]['a:tcPr']).toStrictEqual(rawCellsOf(originalRows[rowIndex])[1]['a:tcPr']);
		});
	});

	it('deletes only the described row and keeps surviving metadata aligned', () => {
		const source = structureTableElement();
		const next = deleteDataRow(source.tableData!, 1);
		const result = rebuild(source, next, { axis: 'row', action: 'delete', index: 1 });
		const rows = rawRowsOf(result);

		expect(rows.map((row) => row['@_id'])).toStrictEqual(['r0', 'r2']);
		expect(rows.map((row) => row['@_h'])).toStrictEqual(['95250', '285750']);
		expect(rows[1]['x:opaque']).toStrictEqual({ '@_id': 'row-2' });
		expect(rawCellsOf(rows[1]).map((cell) => cell['@_id'])).toStrictEqual(['r2c0', 'r2c1', 'r2c2']);
		expect(rawGridColumnsOf(result).map((column) => column['@_id'])).toStrictEqual([
			'g0',
			'g1',
			'g2',
		]);
	});

	it('deletes only the described column and redistributes its width without losing metadata', () => {
		const source = structureTableElement();
		const next = deleteDataColumn(source.tableData!, 1);
		const result = rebuild(source, next, { axis: 'column', action: 'delete', index: 1 });
		const rows = rawRowsOf(result);
		const columns = rawGridColumnsOf(result);

		expect(columns.map((column) => column['@_id'])).toStrictEqual(['g0', 'g2']);
		expect(columns.map((column) => column['@_w'])).toStrictEqual(['286', '714']);
		expect(columns.reduce((sum, column) => sum + Number(column['@_w']), 0)).toBe(1000);
		expect(columns[1]['x:opaque']).toStrictEqual({ '@_id': 'grid-2' });
		rows.forEach((row, rowIndex) => {
			expect(row['x:opaque']).toStrictEqual({ '@_id': `row-${rowIndex}` });
			expect(rawCellsOf(row).map((cell) => cell['@_id'])).toStrictEqual([
				`r${rowIndex}c0`,
				`r${rowIndex}c2`,
			]);
			expect(rawCellsOf(row)[1]['a:tcPr']).toStrictEqual({
				'@_marL': '91440',
				'a:extLst': {
					'a:ext': {
						'@_uri': `urn:r${rowIndex}c2`,
						'x:opaque': { '@_id': `r${rowIndex}c2` },
					},
				},
			});
		});
	});

	it('uses the current XML as provenance across repeated row and column insertions', () => {
		let element = structureTableElement();
		let data = insertDataRow(element.tableData!, 1);
		let rawXml = rebuild(element, data, { axis: 'row', action: 'insert', index: 1 });
		element = { ...element, tableData: data, rawXml };
		data = insertDataRow(data, 3);
		rawXml = rebuild(element, data, { axis: 'row', action: 'insert', index: 3 });

		expect(rawRowsOf(rawXml).map((row) => row['@_id'])).toStrictEqual([
			'r0',
			undefined,
			'r1',
			undefined,
			'r2',
		]);

		element = { ...element, tableData: data, rawXml };
		data = insertDataColumn(data, 1);
		rawXml = rebuild(element, data, { axis: 'column', action: 'insert', index: 1 });
		element = { ...element, tableData: data, rawXml };
		data = insertDataColumn(data, 3);
		rawXml = rebuild(element, data, { axis: 'column', action: 'insert', index: 3 });

		const columns = rawGridColumnsOf(rawXml);
		expect(columns.map((column) => column['@_id'])).toStrictEqual([
			'g0',
			undefined,
			'g1',
			undefined,
			'g2',
		]);
		expect(columns.reduce((sum, column) => sum + Number(column['@_w']), 0)).toBe(1000);
		expect(rawCellsOf(rawRowsOf(rawXml)[0]).map((cell) => cell['@_id'])).toStrictEqual([
			'r0c0',
			undefined,
			'r0c1',
			undefined,
			'r0c2',
		]);
	});

	it.each([
		{
			name: 'an out-of-range insertion index',
			edit: { axis: 'row', action: 'insert', index: 99 } as const,
		},
		{
			name: 'a descriptor whose axis does not match the new dimensions',
			edit: { axis: 'column', action: 'insert', index: 1 } as const,
		},
	])('falls back without a partial splice for $name', ({ edit }) => {
		const source = structureTableElement();
		const next = insertDataRow(source.tableData!, 3);
		const result = rebuild(source, next, edit);
		const rows = rawRowsOf(result);

		// A rejected descriptor deliberately takes the legacy arbitrary-model
		// rebuild. It must not leave behind part of the requested splice.
		expect(rows.map((row) => row['@_id'])).toStrictEqual([
			undefined,
			undefined,
			undefined,
			undefined,
		]);
		expect(rawGridColumnsOf(result).map((column) => column['@_id'])).toStrictEqual([
			undefined,
			undefined,
			undefined,
		]);
		expect(rawCellsOf(rows[0]).map((cell) => cell['@_id'])).toStrictEqual(['r0c0', 'r0c1', 'r0c2']);
		expect(rawCellsOf(rows[3]).map((cell) => cell['@_id'])).toStrictEqual([
			undefined,
			undefined,
			undefined,
		]);
	});
});

describe('rebuildTableStructureInRawXml merged-anchor promotion', () => {
	it.each<MergeAxis>(['row', 'column'])(
		'promotes a non-empty %s anchor body but keeps the surviving cell identity and properties',
		(axis) => {
			const source = mergedTableElement(axis);
			const sourceRows = rawRowsOf(source.rawXml!);
			const anchorXml = rawCellsOf(sourceRows[0])[0];
			const targetXml =
				axis === 'row' ? rawCellsOf(sourceRows[1])[0] : rawCellsOf(sourceRows[0])[1];
			const next = dataAfterDeletingMergeAnchor(source, axis);
			const result = rebuild(source, next, { axis, action: 'delete', index: 0 });
			const survivor = rawCellsOf(rawRowsOf(result)[0])[0];

			expect(survivor['@_id']).toBe('target');
			expect(survivor['a:txBody']).toStrictEqual(anchorXml['a:txBody']);
			expect(survivor['a:tcPr']).toStrictEqual(targetXml['a:tcPr']);
			expect(survivor[axis === 'row' ? '@_vMerge' : '@_hMerge']).toBeUndefined();
			expect(survivor[axis === 'row' ? '@_rowSpan' : '@_gridSpan']).toBeUndefined();
		},
	);

	it.each<MergeAxis>(['row', 'column'])(
		'does not replace the %s anchor body when deleting a continuation',
		(axis) => {
			const source = mergedTableElement(axis);
			const anchorXml = rawCellsOf(rawRowsOf(source.rawXml!)[0])[0];
			const next = dataAfterDeletingMergeContinuation(source, axis);
			const result = rebuild(source, next, { axis, action: 'delete', index: 1 });
			const survivor = rawCellsOf(rawRowsOf(result)[0])[0];

			expect(survivor['@_id']).toBe('anchor');
			expect(survivor['a:txBody']).toStrictEqual(anchorXml['a:txBody']);
			expect(survivor['a:tcPr']).toStrictEqual(anchorXml['a:tcPr']);
			expect(survivor[axis === 'row' ? '@_rowSpan' : '@_gridSpan']).toBeUndefined();
		},
	);

	it.each<MergeAxis>(['row', 'column'])(
		'keeps the target rich body and properties when the removed %s anchor is empty',
		(axis) => {
			const source = mergedTableElement(axis, '', 'Target');
			const sourceRows = rawRowsOf(source.rawXml!);
			const targetXml =
				axis === 'row' ? rawCellsOf(sourceRows[1])[0] : rawCellsOf(sourceRows[0])[1];
			const next = dataAfterDeletingMergeAnchor(source, axis);
			const result = rebuild(source, next, { axis, action: 'delete', index: 0 });
			const survivor = rawCellsOf(rawRowsOf(result)[0])[0];

			expect(survivor['@_id']).toBe('target');
			expect(survivor['a:txBody']).toStrictEqual(targetXml['a:txBody']);
			expect(survivor['a:tcPr']).toStrictEqual(targetXml['a:tcPr']);
		},
	);
});

describe('ensureArray', () => {
	it('reports one paragraph for a lone <a:p/>, not zero', () => {
		const body = (parser.parse('<t><a:bodyPr/><a:p/></t>') as Record<string, XmlObject>)['t'];
		expect(ensureArray(body['a:p'] as XmlObject | XmlObject[] | undefined)).toHaveLength(1);
	});

	it('still treats undefined and null as absent', () => {
		expect(ensureArray(undefined)).toStrictEqual([]);
		expect(ensureArray(null)).toStrictEqual([]);
	});
});

describe('updateMergeAttrsInRawXml preserves unchanged text bodies', () => {
	const richCell =
		'<a:tc><a:txBody><a:bodyPr wrap="square"/><a:lstStyle/>' +
		'<a:p><a:pPr marL="91440"><a:spcBef><a:spcPts val="600"/></a:spcBef></a:pPr>' +
		'<a:r><a:rPr b="1"><a:hlinkClick r:id="rIdLink"/></a:rPr><a:t>Rich </a:t></a:r>' +
		'<a:br/><a:r><a:rPr i="1"/><a:t>text</a:t></a:r>' +
		'<a:fld id="field-1" type="slidenum"><a:rPr/><a:t>7</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p>' +
		'<a:p><a:pPr algn="r"/><a:r><a:t>tail</a:t></a:r><a:endParaRPr sz="1800"/></a:p>' +
		'</a:txBody><a:tcPr marL="91440"/></a:tc>';
	// Match the existing load/save comparison: runs, then fields per paragraph.
	const richText = 'Rich text7\ntail';
	const plainCell = (text: string, attrs = '') =>
		`<a:tc${attrs}><a:txBody><a:bodyPr/><a:p><a:r><a:rPr/><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
	const data = (texts: string[]): PptxTableData => ({
		columnWidths: texts.map(() => 1 / texts.length),
		rows: [{ cells: texts.map((text) => ({ text })) }],
	});

	it('keeps unrelated runs, fields, breaks, hyperlinks and paragraph properties during merge', () => {
		const element = tableElement(plainCell('A') + plainCell('B') + richCell, 3);
		const original = structuredClone(element.rawXml);
		const next = data(['A B', '', richText]);
		next.rows[0].cells[0].gridSpan = 2;
		next.rows[0].cells[1].hMerge = true;
		const result = updateMergeAttrsInRawXml(element, next)!;
		const cells = cellsOf(result);
		expect(cells[2]).toStrictEqual(cellsOf(original!)[2]);
		expect(cells[0]['@_gridSpan']).toBe('2');
		expect(cells[1]['@_hMerge']).toBe('1');
		expect(cells[0]['a:txBody']['a:p']['a:r']['a:t']).toBe('A B');
		expect(cells[1]['a:txBody']['a:p']['a:r']['a:t']).toBe('');
		expect(element.rawXml).toStrictEqual(original);
	});

	it('removes merge flags without rewriting text bodies during split', () => {
		const element = tableElement(
			plainCell('Combined', ' gridSpan="2"') + plainCell('', ' hMerge="1"') + richCell,
			3,
		);
		const original = structuredClone(element.rawXml);
		const result = updateMergeAttrsInRawXml(element, data(['Combined', '', richText]))!;
		const cells = cellsOf(result);
		expect(cells[0]['@_gridSpan']).toBeUndefined();
		expect(cells[1]['@_hMerge']).toBeUndefined();
		expect(cells.map((cell) => cell['a:txBody'])).toStrictEqual(
			cellsOf(original!).map((cell) => cell['a:txBody']),
		);
		expect(element.rawXml).toStrictEqual(original);
	});

	it('still rebuilds text that actually changed', () => {
		const element = tableElement(richCell);
		const result = updateMergeAttrsInRawXml(element, data(['Edited']))!;
		expect(paragraphsOf(result)).toHaveLength(1);
		expect(paragraphsOf(result)[0]['a:r']['a:t']).toBe('Edited');
		expect(paragraphsOf(result)[0]['a:r']['a:rPr']['@_b']).toBe('1');
	});

	it('preserves a rich anchor when merging it with an empty neighbor', () => {
		const element = tableElement(richCell + plainCell(''), 2);
		const next = data([richText, '']);
		next.rows[0].cells[0].gridSpan = 2;
		next.rows[0].cells[1].hMerge = true;
		const result = updateMergeAttrsInRawXml(element, next)!;
		expect(cellsOf(result)[0]['a:txBody']).toStrictEqual(cellsOf(element.rawXml!)[0]['a:txBody']);
		expect(cellsOf(result)[0]['@_gridSpan']).toBe('2');
		expect(cellsOf(result)[1]['@_hMerge']).toBe('1');
	});

	it('clears absorbed rich text while retaining unchanged vertical merge anchors', () => {
		const element = tableElement(richCell);
		const table = rawTableOf(element.rawXml!);
		table['a:tr'] = [table['a:tr'], structuredClone(table['a:tr'])];
		const next: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: richText }] }, { cells: [{ text: '' }] }],
		};
		next.rows[0].cells[0].rowSpan = 2;
		next.rows[1].cells[0].vMerge = true;
		const result = updateMergeAttrsInRawXml(element, next)!;
		expect(cellsOf(result)[0]['a:txBody']).toStrictEqual(cellsOf(element.rawXml!)[0]['a:txBody']);
		expect(cellsOf(result)[0]['@_rowSpan']).toBe('2');
		expect(cellsOf(result, 1)[0]['@_vMerge']).toBe('1');
		const clearedBody = cellsOf(result, 1)[0]['a:txBody'] as XmlObject;
		expect(clearedBody['a:p']['a:r']['a:t']).toBe('');
		expect(clearedBody['a:p']['a:fld']).toBeUndefined();
		expect(clearedBody['a:p']['a:br']).toBeUndefined();
	});

	it('retains an unchanged bare empty paragraph', () => {
		const element = tableElement('<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody><a:tcPr/></a:tc>');
		const result = updateMergeAttrsInRawXml(element, data(['']))!;
		expect(cellOf(result)['a:txBody']).toStrictEqual(cellOf(element.rawXml!)['a:txBody']);
	});

	it.each(['<a:tc><a:tcPr/></a:tc>', '<a:tc><a:txBody><a:bodyPr/></a:txBody></a:tc>'])(
		'creates a paragraph when the input text body is missing one: %s',
		(cell) => {
			const result = updateMergeAttrsInRawXml(tableElement(cell), data(['']))!;
			expect(paragraphsOf(result)).toHaveLength(1);
			expect(paragraphsOf(result)[0]['a:r']['a:t']).toBe('');
		},
	);
});
