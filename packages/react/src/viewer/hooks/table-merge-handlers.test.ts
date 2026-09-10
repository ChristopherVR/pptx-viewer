import type { PptxElement, PptxTableData, TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { updateMergeAttrsInRawXml as updateMergeAttrsInRawXmlActual } from 'pptx-viewer-core';
import { mergeCells as mergeCellsActual, splitCell as splitCellActual } from 'pptx-viewer-shared';
import { describe, it, expect, vi } from 'vitest';

import { mergeCells, splitCell } from '../utils/table-merge-utils';
import { updateMergeAttrsInRawXml } from '../utils/table-parse';
import { createTableMergeHandlers } from './table-merge-handlers';
import type { UseTableOperationsInput } from './table-operation-types';

// Mock the external utilities
vi.mock<typeof import('../utils/table-parse')>(import('../utils/table-parse'), () => ({
	updateMergeAttrsInRawXml: vi.fn(() => '<merged-xml/>'),
}));

vi.mock<typeof import('../utils/table-merge-utils')>(import('../utils/table-merge-utils'), () => ({
	mergeCells: vi.fn((cells, td) => {
		// Simple mock: return tableData with anchor cell marked with gridSpan/rowSpan
		const newRows = td.rows.map((row: PptxTableData['rows'][0], ri: number) => ({
			...row,
			cells: row.cells.map((cell: PptxTableData['rows'][0]['cells'][0], ci: number) => {
				if (ri === cells[0].row && ci === cells[0].col) {
					return { ...cell, gridSpan: 2, text: 'merged' };
				}
				return cell;
			}),
		}));
		return { ...td, rows: newRows };
	}),
	splitCell: vi.fn((row, col, td) => {
		const newRows = td.rows.map((r: PptxTableData['rows'][0], ri: number) => ({
			...r,
			cells: r.cells.map((c: PptxTableData['rows'][0]['cells'][0], ci: number) => {
				if (ri === row && ci === col) {
					return {
						...c,
						gridSpan: undefined,
						rowSpan: undefined,
						text: 'split',
					};
				}
				return c;
			}),
		}));
		return { ...td, rows: newRows };
	}),
}));

function createTableData(rows: number, cols: number): PptxTableData {
	return {
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
		rows: Array.from({ length: rows }, () => ({
			cells: Array.from({ length: cols }, () => ({ text: '', style: {} })),
			height: 40,
		})),
	};
}

function createTableElement(tableData: PptxTableData, id = 'table-1'): TablePptxElement {
	return {
		id,
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData,
	} as TablePptxElement;
}

function rawTextCell(runs: XmlObject[], marker?: string): XmlObject {
	return {
		'a:txBody': { 'a:p': { 'a:r': runs } },
		'a:tcPr': marker ? { 'x:opaque': { '@_marker': marker } } : {},
	};
}

function createRichTableElement(): TablePptxElement {
	const tableData: PptxTableData = {
		columnWidths: [0.5, 0.5],
		rows: [
			{
				height: 40,
				cells: [
					{ text: 'A', textRuns: [{ text: 'A', bold: true }] },
					{ text: 'B', textRuns: [{ text: 'B', italic: true }] },
				],
			},
			{
				height: 40,
				cells: [
					{
						text: 'Rich text',
						textRuns: [
							{ text: 'Rich ', bold: true },
							{ text: 'text', italic: true },
						],
					},
					{ text: 'D' },
				],
			},
		],
	};
	return {
		...createTableElement(tableData),
		rawXml: {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tr': [
							{
								'a:tc': [
									rawTextCell([{ 'a:rPr': { '@_b': '1' }, 'a:t': 'A' }]),
									rawTextCell([{ 'a:rPr': { '@_i': '1' }, 'a:t': 'B' }]),
								],
							},
							{
								'a:tc': [
									rawTextCell(
										[
											{ 'a:rPr': { '@_b': '1' }, 'a:t': 'Rich ' },
											{ 'a:rPr': { '@_i': '1' }, 'a:t': 'text' },
										],
										'unrelated',
									),
									rawTextCell([{ 'a:t': 'D' }]),
								],
							},
						],
					},
				},
			},
		},
	};
}

function rawCell(rawXml: XmlObject, row: number, column: number): XmlObject {
	const graphic = rawXml['a:graphic'] as XmlObject;
	const graphicData = graphic['a:graphicData'] as XmlObject;
	const table = graphicData['a:tbl'] as XmlObject;
	const rows = table['a:tr'] as XmlObject[];
	return (rows[row]['a:tc'] as XmlObject[])[column];
}

function createMockInput(
	overrides: Partial<UseTableOperationsInput> = {},
): UseTableOperationsInput {
	const tableData = createTableData(3, 3);
	const tableEl = createTableElement(tableData);
	const lookup = new Map<string, PptxElement>();
	lookup.set(tableEl.id, tableEl);

	return {
		selectedElement: tableEl,
		tableEditorState: { rowIndex: 0, columnIndex: 0 },
		elementLookup: lookup,
		setTableEditorState: vi.fn<() => void>(),
		ops: {
			updateElementById: vi.fn<() => void>(),
			updateSelectedElement: vi.fn<() => void>(),
		} as unknown as UseTableOperationsInput['ops'],
		history: {
			markDirty: vi.fn<() => void>(),
		} as unknown as UseTableOperationsInput['history'],
		...overrides,
	};
}

describe('createTableMergeHandlers', () => {
	// ── handleMergeCellRight ──────────────────────────────────────────────

	describe('handleMergeCellRight', () => {
		it('should merge the current cell with the cell to the right', () => {
			const input = createMockInput();
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).toHaveBeenCalledWith(
				expect.objectContaining({ rawXml: '<merged-xml/>' }),
			);
			expect(input.history.markDirty).toHaveBeenCalledWith();
		});

		it('should do nothing if no selected element', () => {
			const input = createMockInput({ selectedElement: null });
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if element is not a table', () => {
			const input = createMockInput({
				selectedElement: {
					id: 's1',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
				} as PptxElement,
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if table editor state is null', () => {
			const input = createMockInput({ tableEditorState: null });
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if next cell is hMerge continuation', () => {
			const tableData = createTableData(3, 3);
			tableData.rows[0].cells[1] = { text: '', hMerge: true };
			const tableEl = createTableElement(tableData);
			const input = createMockInput({ selectedElement: tableEl });
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if next cell is vMerge continuation', () => {
			const tableData = createTableData(3, 3);
			tableData.rows[0].cells[1] = { text: '', vMerge: true };
			const tableEl = createTableElement(tableData);
			const input = createMockInput({ selectedElement: tableEl });
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellRight();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('preserves an unrelated rich raw cell through merge-right and split commits', () => {
			const element = createRichTableElement();
			const originalRichBody = structuredClone(rawCell(element.rawXml!, 1, 0)['a:txBody']);
			vi.mocked(mergeCells).mockImplementationOnce(mergeCellsActual);
			vi.mocked(updateMergeAttrsInRawXml).mockImplementationOnce(updateMergeAttrsInRawXmlActual);
			const mergeInput = createMockInput({ selectedElement: element });

			createTableMergeHandlers(mergeInput).handleMergeCellRight();

			const mergePatch = vi.mocked(mergeInput.ops.updateSelectedElement).mock
				.calls[0][0] as Partial<TablePptxElement>;
			expect(mergePatch.tableData?.rows[0].cells[0].gridSpan).toBe(2);
			expect(mergePatch.tableData?.rows[0].cells[0].textRuns).toBeUndefined();
			expect(rawCell(mergePatch.rawXml!, 1, 0)['a:txBody']).toStrictEqual(originalRichBody);

			const mergedElement: TablePptxElement = { ...element, ...mergePatch };
			vi.mocked(splitCell).mockImplementationOnce(splitCellActual);
			vi.mocked(updateMergeAttrsInRawXml).mockImplementationOnce(updateMergeAttrsInRawXmlActual);
			const splitInput = createMockInput({ selectedElement: mergedElement });

			createTableMergeHandlers(splitInput).handleSplitCell();

			const splitPatch = vi.mocked(splitInput.ops.updateSelectedElement).mock
				.calls[0][0] as Partial<TablePptxElement>;
			expect(splitPatch.tableData?.rows[0].cells[0].gridSpan).toBeUndefined();
			expect(rawCell(splitPatch.rawXml!, 1, 0)['a:txBody']).toStrictEqual(originalRichBody);
			expect(rawCell(element.rawXml!, 1, 0)['a:txBody']).toStrictEqual(originalRichBody);
		});

		it('keeps a rich anchor when an empty neighbour leaves its text unchanged', () => {
			const element = createRichTableElement();
			const richCell = structuredClone(element.tableData!.rows[1].cells[0]);
			const richBody = structuredClone(rawCell(element.rawXml!, 1, 0)['a:txBody']);
			element.tableData!.rows[0].cells = [richCell, { text: '', textRuns: [{ text: 'stale' }] }];
			rawCell(element.rawXml!, 0, 0)['a:txBody'] = structuredClone(richBody);
			rawCell(element.rawXml!, 0, 1)['a:txBody'] = rawTextCell([{ 'a:t': '' }])['a:txBody'];
			vi.mocked(mergeCells).mockImplementationOnce(mergeCellsActual);
			vi.mocked(updateMergeAttrsInRawXml).mockImplementationOnce(updateMergeAttrsInRawXmlActual);
			const input = createMockInput({ selectedElement: element });

			createTableMergeHandlers(input).handleMergeCellRight();

			const patch = vi.mocked(input.ops.updateSelectedElement).mock
				.calls[0][0] as Partial<TablePptxElement>;
			expect(patch.tableData?.rows[0].cells[0]).toMatchObject({ text: 'Rich text', gridSpan: 2 });
			expect(patch.tableData?.rows[0].cells[0].textRuns).toStrictEqual(richCell.textRuns);
			expect(patch.tableData?.rows[0].cells[1].textRuns).toBeUndefined();
			expect(rawCell(patch.rawXml!, 0, 0)['a:txBody']).toStrictEqual(richBody);
		});
	});

	// ── handleMergeCellDown ───────────────────────────────────────────────

	describe('handleMergeCellDown', () => {
		it('should merge the current cell with the cell below', () => {
			const input = createMockInput();
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellDown();
			expect(input.ops.updateSelectedElement).toHaveBeenCalledWith(
				expect.objectContaining({ rawXml: '<merged-xml/>' }),
			);
			expect(input.history.markDirty).toHaveBeenCalledWith();
		});

		it('should do nothing if at the last row', () => {
			const input = createMockInput({
				tableEditorState: { rowIndex: 2, columnIndex: 0 },
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellDown();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if target cell is an hMerge continuation', () => {
			const tableData = createTableData(3, 3);
			tableData.rows[1].cells[0] = { text: '', hMerge: true };
			const tableEl = createTableElement(tableData);
			const input = createMockInput({ selectedElement: tableEl });
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeCellDown();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});
	});

	// ── handleMergeSelectedCells ──────────────────────────────────────────

	describe('handleMergeSelectedCells', () => {
		it('should merge multiple selected cells', () => {
			const input = createMockInput({
				tableEditorState: {
					rowIndex: 0,
					columnIndex: 0,
					selectedCells: [
						{ row: 0, col: 0 },
						{ row: 0, col: 1 },
					],
				},
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeSelectedCells();
			expect(input.ops.updateSelectedElement).toHaveBeenCalledWith(
				expect.objectContaining({ rawXml: '<merged-xml/>' }),
			);
			expect(input.history.markDirty).toHaveBeenCalledWith();
		});

		it('should do nothing if less than 2 cells selected', () => {
			const input = createMockInput({
				tableEditorState: {
					rowIndex: 0,
					columnIndex: 0,
					selectedCells: [{ row: 0, col: 0 }],
				},
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeSelectedCells();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing when no selectedCells array', () => {
			const input = createMockInput({
				tableEditorState: { rowIndex: 0, columnIndex: 0 },
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeSelectedCells();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should update table editor state after merge', () => {
			const input = createMockInput({
				tableEditorState: {
					rowIndex: 1,
					columnIndex: 1,
					selectedCells: [
						{ row: 1, col: 1 },
						{ row: 1, col: 2 },
					],
				},
			});
			const handlers = createTableMergeHandlers(input);
			handlers.handleMergeSelectedCells();
			expect(input.setTableEditorState).toHaveBeenCalledWith(
				expect.objectContaining({
					rowIndex: 1,
					columnIndex: 1,
				}),
			);
		});
	});

	// ── handleSplitCell ───────────────────────────────────────────────────

	describe('handleSplitCell', () => {
		it('should split a merged cell', () => {
			const input = createMockInput();
			const handlers = createTableMergeHandlers(input);
			handlers.handleSplitCell();
			expect(input.ops.updateSelectedElement).toHaveBeenCalledWith(
				expect.objectContaining({ rawXml: '<merged-xml/>' }),
			);
			expect(input.history.markDirty).toHaveBeenCalledWith();
		});

		it('should do nothing if no table editor state', () => {
			const input = createMockInput({ tableEditorState: null });
			const handlers = createTableMergeHandlers(input);
			handlers.handleSplitCell();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});

		it('should do nothing if selected element is null', () => {
			const input = createMockInput({ selectedElement: null });
			const handlers = createTableMergeHandlers(input);
			handlers.handleSplitCell();
			expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
		});
	});
});
