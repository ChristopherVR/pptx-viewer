/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per function, several separated by
   comments or guard clauses); merging them isn't a style choice here. */
/**
 * Pure, framework-agnostic helpers for table rendering (view-model projection).
 *
 * Cell/run style projection lives in `table-cell-style.ts`; it is re-exported
 * here so the public surface (and colocated tests) keep importing the style
 * helpers from `table-renderer-helpers` unchanged.
 *
 * Ported from:
 *   - packages/react/src/viewer/utils/table-render-data.tsx  (row / cell
 *     view-model projection)
 *   - packages/react/src/viewer/utils/table-band-style.tsx   (banding)
 *   - packages/react/src/viewer/utils/table-diagonal-borders.tsx (diagonals)
 */
import type { PptxElement, PptxTableCell, TablePptxElement } from 'pptx-viewer-core';

import type { DiagonalBorderInfo, TableStyleContext } from '../internal/shared';
import { getCellDiagonalBorders, tableCellCss } from '../internal/shared';
import type { StyleMap } from './element-style';
import type { CellParagraph } from './table-cell-style';
import {
	buildCellParagraphs,
	columnWidthStyle,
	cssObjectToStyleMap,
	rowStyle,
} from './table-cell-style';

// Re-export the extracted style helpers so existing importers/tests are stable.
// `cssObjectToStyleMap` now lives beside `cellStyleToStyleMap` (which is built
// on it) so this module can keep importing from that one and not the reverse.
export {
	buildCellParagraphs,
	cellRunStyle,
	cellStyleToStyleMap,
	cellTdStyle,
	columnWidthStyle,
	cssObjectToStyleMap,
	ooxmlDashToCssBorderStyle,
	rowStyle,
} from './table-cell-style';
export type { CellParagraph, CellTextRun } from './table-cell-style';
export type { DiagonalBorderInfo };

// ==========================================================================
// View-model types
// ==========================================================================

/** A flattened cell descriptor ready for template iteration. */
export interface TableCellViewModel {
	cell: PptxTableCell;
	rowIndex: number;
	colIndex: number;
	colSpan: number | undefined;
	rowSpan: number | undefined;
	tdStyle: StyleMap;
	displayText: string;
	paragraphs: CellParagraph[];
	/** Diagonal border overlay info, or null when the cell has none. */
	diagonal: DiagonalBorderInfo | null;
}

export interface TableRowViewModel {
	rowStyle: StyleMap;
	cells: TableCellViewModel[];
}

// ==========================================================================
// View-model projection
// ==========================================================================

/**
 * Project a `TablePptxElement` into view-model rows, skipping merged-away cells,
 * resolving spans, applying banding (lowest priority) beneath the explicit cell
 * style, and extracting diagonal-border info. Returns an empty array when
 * `tableData` is absent.
 *
 * `styleCtx` (parsed table-style map + theme colour/font scheme) is threaded
 * into both the banding resolver and the diagonal-border resolver so
 * table-style-inherited banding, fonts, and section diagonals apply; per-cell
 * explicit styles still win. When omitted, both fall back to the hardcoded
 * defaults (unchanged from before).
 */
export function buildTableViewModel(
	el: PptxElement,
	styleCtx?: TableStyleContext,
): TableRowViewModel[] {
	if (el.type !== 'table') {
		return [];
	}
	const tableData = (el as TablePptxElement).tableData;
	if (!tableData || tableData.rows.length === 0) {
		return [];
	}

	const rowCount = tableData.rows.length;
	const columnCount = tableData.columnWidths.length;

	return tableData.rows.map((row, rowIndex) => {
		const cells: TableCellViewModel[] = row.cells
			.map((cell, colIndex) => ({ cell, colIndex }))
			.filter(({ cell }) => !cell.hMerge && !cell.vMerge)
			.map(({ cell, colIndex }) => {
				const colSpan =
					cell.gridSpan !== undefined && cell.gridSpan > 1 ? cell.gridSpan : undefined;
				const rowSpan = cell.rowSpan !== undefined && cell.rowSpan > 1 ? cell.rowSpan : undefined;

				// Band beneath the explicit cell style, then the text-colour floor.
				// The floor is why this goes through shared rather than composing the
				// two layers here: Angular was the one binding without it, so a cell
				// with no authored colour inherited the viewer chrome's `foreground`
				// (#f0efec on the dark preset) and painted near-white on a light cell.
				const tdStyle: StyleMap = {
					'padding-left': '4px',
					'padding-right': '4px',
					'padding-top': '2px',
					'padding-bottom': '2px',
					'vertical-align': 'top',
					...cssObjectToStyleMap(
						tableCellCss(
							tableData,
							cell,
							{ rowIndex, cellIndex: colIndex, rowCount, columnCount },
							styleCtx,
						),
					),
				};

				return {
					cell,
					rowIndex,
					colIndex,
					colSpan,
					rowSpan,
					tdStyle,
					// Non-breaking space (U+00A0) keeps an empty cell from collapsing;
					// mirrors React's `cell.text || '\u00a0'` in table-render-data.tsx.
					displayText: cell.text || '\u00a0',
					paragraphs: buildCellParagraphs(cell),
					// Combine per-cell explicit diagonals with any inherited from the
					// applicable table-style sections (per-cell still takes precedence).
					diagonal: getCellDiagonalBorders(
						cell.style,
						tableData,
						{ rowIndex, cellIndex: colIndex, rowCount, columnCount },
						styleCtx,
					),
				};
			});
		return { rowStyle: rowStyle(row), cells };
	});
}

/** Compute `<col>` width styles from the column-widths array (0-1 fractions). */
export function buildColStyles(el: PptxElement): StyleMap[] {
	if (el.type !== 'table') {
		return [];
	}
	const widths = (el as TablePptxElement).tableData?.columnWidths ?? [];
	return widths.map((w) => columnWidthStyle(w));
}
