import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import type {
	CellTextRun,
	CssStyleMap,
	DiagonalBorderInfo,
	TableCellCss,
	TableStyleContext,
} from 'pptx-viewer-shared';
import {
	cellPatternFillCss,
	cellRunStyle,
	cellStyleToCss,
	DEFAULT_TEXT_COLOR,
	getDiagonalBorders,
	getTableCellBandStyle,
} from 'pptx-viewer-shared';

import { styleToString } from '../style';

/**
 * View-model builder for `table` elements (port of the vanilla binding's
 * `renderTableElement` cell/row assembly). All pure style logic comes from
 * `pptx-viewer-shared` (band styles, cell CSS, pattern fills, diagonal
 * borders, per-run styles); this module only projects it into plain view
 * objects the `TableView` SFC template can iterate.
 */

/** Base `<td>` style (kept inline so the SFC needs no scoped cell CSS). */
const CELL_BASE_STYLE: CssStyleMap = {
	position: 'relative',
	padding: '1px 4px',
	verticalAlign: 'top',
	border: '1px solid rgba(255, 255, 255, 0.3)',
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
	overflowWrap: 'break-word',
};

/** One rendered rich-text run (or break marker) inside a cell. */
export interface TableRunView {
	key: string;
	isParagraphBreak: boolean;
	isLineBreak: boolean;
	text: string;
	/** Inline `style` string for the run `<span>`. */
	style: string;
}

/** One rendered `<td>`. */
export interface TableCellView {
	key: string;
	/** `undefined` when the cell spans a single column/row (attr omitted). */
	colSpan: number | undefined;
	rowSpan: number | undefined;
	/** Full inline `style` string (base + band + explicit cell style). */
	style: string;
	diagonals: DiagonalBorderInfo | null;
	/** Rich per-run content, or `null` to fall back to {@link text}. */
	runs: TableRunView[] | null;
	/** Plain cell text fallback (space-padded so empty cells keep height). */
	text: string;
}

/** One rendered `<tr>`. */
export interface TableRowView {
	key: string;
	/** Inline `style` string carrying the row height, when one is set. */
	style: string | undefined;
	cells: TableCellView[];
}

/** Proportional `<col>` width strings for the table's `<colgroup>`. */
export function columnWidthStyles(tableData: PptxTableData): string[] {
	return tableData.columnWidths.map((width) => `width: ${(width * 100).toFixed(2)}%`);
}

/** Project `PptxTableData` into renderable row/cell view models. */
export function buildTableRows(
	tableData: PptxTableData,
	context?: TableStyleContext,
): TableRowView[] {
	const rowCount = tableData.rows.length;
	const columnCount = tableData.columnWidths.length;
	return tableData.rows.map((row, rowIndex) => ({
		key: `r${rowIndex}`,
		style: row.height && row.height > 0 ? `height: ${row.height}px` : undefined,
		cells: row.cells
			.map((cell, cellIndex) => ({ cell, cellIndex }))
			// Cells absorbed by a horizontal or vertical merge are not rendered;
			// the originating cell carries the span.
			.filter(({ cell }) => !cell.hMerge && !cell.vMerge)
			.map(({ cell, cellIndex }) =>
				buildCellView(tableData, cell, rowIndex, cellIndex, rowCount, columnCount, context),
			),
	}));
}

/** Build one cell view: spans, band + explicit style, pattern fill, text. */
function buildCellView(
	tableData: PptxTableData,
	cell: PptxTableCell,
	rowIndex: number,
	cellIndex: number,
	rowCount: number,
	columnCount: number,
	context?: TableStyleContext,
): TableCellView {
	// Band/header emphasis is the lower-priority layer beneath the explicit
	// cell style (mirrors the React/Vue/vanilla layering).
	const bandStyle = getTableCellBandStyle(
		tableData,
		rowIndex,
		cellIndex,
		rowCount,
		columnCount,
		context,
	);
	const style: TableCellCss = { ...bandStyle, ...cellStyleToCss(cell.style) };
	// Default body-cell text to the dark slide-text colour when nothing (cell
	// style, band/header emphasis, or per-run colour) sets one, so cells stay
	// legible on light tables regardless of the host page's inherited colour.
	if (style.color === undefined) {
		style.color = DEFAULT_TEXT_COLOR;
	}

	// Pattern fill replaces the flat backgroundColor with a tiled SVG image
	// plus the solid background colour behind it.
	const patternFill = cell.style ? cellPatternFillCss(cell.style) : null;
	if (patternFill) {
		delete style['backgroundColor'];
		delete style['background'];
		if (patternFill.backgroundImage) {
			style['backgroundImage'] = patternFill.backgroundImage;
		}
		if (patternFill.backgroundColor) {
			style['backgroundColor'] = patternFill.backgroundColor;
		}
	}

	return {
		key: `c${rowIndex}-${cellIndex}`,
		colSpan: cell.gridSpan && cell.gridSpan > 1 ? cell.gridSpan : undefined,
		rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
		style: styleToString({ ...CELL_BASE_STYLE, ...style }),
		diagonals: getDiagonalBorders(cell.style),
		runs: buildRunViews(cell),
		text: cell.text || ' ',
	};
}

/**
 * Rich per-run cell content when the cell carries `CellTextRun[]` (duck-typed
 * extension, matching the other bindings); `null` for plain-text cells.
 */
function buildRunViews(cell: PptxTableCell): TableRunView[] | null {
	const richCell = cell as PptxTableCell & { textRuns?: CellTextRun[] };
	const textRuns = richCell.textRuns;
	if (!textRuns || textRuns.length === 0) {
		return null;
	}
	return textRuns.map((run, i) => ({
		key: `run${i}`,
		isParagraphBreak: run.isParagraphBreak === true,
		isLineBreak: run.isLineBreak === true,
		text: run.text,
		style: styleToString({ position: 'relative', ...cellRunStyle(run) }),
	}));
}
