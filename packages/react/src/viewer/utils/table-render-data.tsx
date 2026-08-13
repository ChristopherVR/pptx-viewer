import type { TablePptxElement, PptxTableCell } from 'pptx-viewer-core';
import { DEFAULT_FONT_FAMILY, tableContainerCss } from 'pptx-viewer-shared';
import React from 'react';

import { cn } from '../../utils';
import type { TableCellEditorState } from '../types';
import type { TableStyleContext } from './table-band-style';
import { renderTableCellContent } from './table-cell-runs';
import { getCellDiagonalBorders, TableCellDiagonalBorders } from './table-diagonal-borders';
import { computeSelectionRect, isCellInRect, rectToCells } from './table-merge-utils';
import type { CellRect } from './table-merge-utils';
import { TableCellInput } from './table-render-cell-input';
import { cellStyleToCss } from './table-render-helpers';
import { TableResizeOverlay } from './table-render-resize';

/* ------------------------------------------------------------------ */
/*  Rendering from PptxTableData (programmatic tables)                 */
/* ------------------------------------------------------------------ */

export function renderTableFromTableData(
	element: TablePptxElement,
	textStyle: React.CSSProperties,
	options?: {
		editable?: boolean;
		selectedCell?: TableCellEditorState | null;
		onSelectCell?: (cell: TableCellEditorState) => void;
		onCommitCellEdit?: (rowIndex: number, colIndex: number, text: string) => void;
		onResizeColumns?: (newWidths: number[]) => void;
		onResizeRow?: (rowIndex: number, newHeight: number) => void;
		styleCtx?: TableStyleContext;
	},
): React.ReactNode {
	const tableData = element.tableData!;
	const rowCount = tableData.rows.length;
	const columnCount = tableData.columnWidths.length;
	const selectedCell = options?.selectedCell || null;
	const isEditable = Boolean(options?.editable);
	const hasCellSelectionHandler = typeof options?.onSelectCell === 'function';

	// Compute multi-selection highlight rectangle
	const selectionRect: CellRect | undefined = (() => {
		if (!selectedCell?.selectedCells || selectedCell.selectedCells.length < 2) {
			return undefined;
		}
		const first = selectedCell.selectedCells[0];
		const last = selectedCell.selectedCells[selectedCell.selectedCells.length - 1];
		return computeSelectionRect(first.row, first.col, last.row, last.col, tableData);
	})();

	return (
		<TableResizeOverlay
			columnWidths={tableData.columnWidths}
			editable={isEditable}
			onResizeColumns={options?.onResizeColumns}
			onResizeRow={options?.onResizeRow}
		>
			<div
				className={cn(
					'w-full h-full overflow-hidden',
					isEditable && hasCellSelectionHandler ? 'pointer-events-auto' : 'pointer-events-none',
				)}
			>
				{/* The explicit family is load-bearing: an unstyled cell otherwise
				    inherits the HOST chrome's font, so the same table measured a
				    different stack (and different metrics) in every binding. All
				    five declare the same shared default on the table root;
				    authored cell/run/table-style fonts still win below it. */}
				<table
					className='w-full h-full border-collapse table-fixed'
					style={
						{
							fontFamily: DEFAULT_FONT_FAMILY,
							// `a:tblPr@rtl` mirrors the column order for RTL decks.
							...tableContainerCss(tableData),
						} as React.CSSProperties
					}
				>
					{tableData.columnWidths.length > 0 && (
						<colgroup>
							{tableData.columnWidths.map((w, ci) => (
								<col
									key={`${element.id}-col-${ci}`}
									style={{ width: `${(w * 100).toFixed(2)}%` }}
								/>
							))}
						</colgroup>
					)}
					<tbody>
						{tableData.rows.map((row, rowIndex) => (
							<tr
								key={`${element.id}-row-${rowIndex}`}
								style={row.height ? { height: row.height } : undefined}
							>
								{row.cells.map((cell: PptxTableCell, cellIndex: number) => {
									if (cell.hMerge || cell.vMerge) {
										return null;
									}
									const isCellSelected =
										selectedCell?.rowIndex === rowIndex && selectedCell?.columnIndex === cellIndex;
									const isInMultiSelection = isCellInRect(rowIndex, cellIndex, selectionRect);
									const isCellEditing = isCellSelected && selectedCell?.isEditing;
									const diag = getCellDiagonalBorders(
										cell.style,
										tableData,
										{ rowIndex, cellIndex, rowCount, columnCount },
										options?.styleCtx,
									);
									return (
										<td
											key={`${element.id}-cell-${rowIndex}-${cellIndex}`}
											className={cn(
												'border px-1 py-0.5 align-top',
												isEditable && hasCellSelectionHandler
													? 'border-blue-200/70 cursor-cell'
													: 'border-gray-400/50',
												isCellSelected ? 'ring-1 ring-inset ring-blue-500' : null,
												isInMultiSelection && !isCellSelected
													? 'bg-blue-500/15 ring-1 ring-inset ring-blue-400/50'
													: null,
											)}
											colSpan={cell.gridSpan && cell.gridSpan > 1 ? cell.gridSpan : undefined}
											rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
											style={{
												...textStyle,
												...cellStyleToCss(cell.style),
												...(diag ? { position: 'relative' } : undefined),
											}}
											onClick={(event) => {
												if (!isEditable || !hasCellSelectionHandler) {
													return;
												}
												event.stopPropagation();
												if (event.shiftKey && selectedCell) {
													const rect = computeSelectionRect(
														selectedCell.rowIndex,
														selectedCell.columnIndex,
														rowIndex,
														cellIndex,
														tableData,
													);
													options?.onSelectCell?.({
														rowIndex: selectedCell.rowIndex,
														columnIndex: selectedCell.columnIndex,
														selectedCells: rectToCells(rect),
													});
												} else {
													options?.onSelectCell?.({
														rowIndex,
														columnIndex: cellIndex,
													});
												}
											}}
											onDoubleClick={(event) => {
												if (!isEditable || !hasCellSelectionHandler) {
													return;
												}
												event.stopPropagation();
												options?.onSelectCell?.({
													rowIndex,
													columnIndex: cellIndex,
													isEditing: true,
												});
											}}
										>
											{diag ? <TableCellDiagonalBorders diag={diag} /> : null}
											{isCellEditing ? (
												<TableCellInput
													initialText={cell.text ?? ''}
													style={{
														...textStyle,
														...cellStyleToCss(cell.style),
													}}
													onCommit={(text) => {
														options?.onCommitCellEdit?.(rowIndex, cellIndex, text);
													}}
													onCancel={() => {
														options?.onSelectCell?.({
															rowIndex,
															columnIndex: cellIndex,
														});
													}}
												/>
											) : (
												renderTableCellContent(cell, cell.text || '\u00a0')
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</TableResizeOverlay>
	);
}
