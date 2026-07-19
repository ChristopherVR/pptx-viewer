/**
 * table-style-borders.ts — resolve table-style borders for one cell.
 *
 * Issue #71: tables that get their gridlines from the table style
 * (`a:tcStyle/a:tcBdr`) rendered borderless because the band-style helper
 * emitted only backgrounds/text. This module maps the parsed
 * {@link ParsedTableStyleBorders} of the applicable sections onto a cell's
 * four CSS edges, honouring table-style precedence:
 *
 *   whole-table  <  banding  <  first/last row/col
 *
 * Per-cell explicit `a:lnX` borders are parsed elsewhere (into
 * {@link PptxTableCellStyle}) and applied on top of this lower layer, so they
 * naturally win.
 */
import type {
	ParsedTableStyleBorder,
	ParsedTableStyleBorders,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	PptxTableData,
} from 'pptx-viewer-core';

import { ooxmlDashToCssBorderStyle } from './table-style';

/** CSS shorthand for a cell's four edges (any subset may be present). */
export interface CellBorderCss {
	borderTop?: string;
	borderBottom?: string;
	borderLeft?: string;
	borderRight?: string;
}

/** Resolve a scheme-colour style fill to a concrete CSS colour string. */
export type ResolveBorderColor = (fill: ParsedTableStyleFill | undefined) => string | undefined;

/** One resolved edge candidate per side, sourced from a section's borders. */
interface EdgeCandidates {
	top?: ParsedTableStyleBorder;
	bottom?: ParsedTableStyleBorder;
	left?: ParsedTableStyleBorder;
	right?: ParsedTableStyleBorder;
}

/**
 * Map a section's border set onto a cell's four edges given the cell's
 * position relative to that section's region. Outer region edges use the
 * `top/bottom/left/right` sides; interior edges use `insideH`/`insideV`.
 */
function edgesFromSection(
	borders: ParsedTableStyleBorders | undefined,
	regionTop: boolean,
	regionBottom: boolean,
	regionLeft: boolean,
	regionRight: boolean,
): EdgeCandidates | undefined {
	if (!borders) {
		return undefined;
	}
	return {
		top: regionTop ? (borders.top ?? borders.insideH) : borders.insideH,
		bottom: regionBottom ? (borders.bottom ?? borders.insideH) : borders.insideH,
		left: regionLeft ? (borders.left ?? borders.insideV) : borders.insideV,
		right: regionRight ? (borders.right ?? borders.insideV) : borders.insideV,
	};
}

/** Convert a resolved border side to a CSS `border-*` shorthand value. */
function borderToCss(
	border: ParsedTableStyleBorder | undefined,
	resolve: ResolveBorderColor,
): string | undefined {
	if (!border) {
		return undefined;
	}
	if (border.noFill) {
		return 'none';
	}
	const width = border.width ?? 1;
	const dash = ooxmlDashToCssBorderStyle(border.dash);
	const color = border.color ?? resolve(border.fill) ?? '#000000';
	return `${width}px ${dash} ${color}`;
}

/** Coordinates + banding context needed to select the applicable sections. */
export interface CellBorderPosition {
	rowIndex: number;
	cellIndex: number;
	rowCount: number;
	columnCount: number;
}

/**
 * Build the ordered (low -> high precedence) list of edge candidates from the
 * sections that apply to this cell.
 */
function collectLayers(
	entry: ParsedTableStyleEntry,
	tableData: PptxTableData,
	pos: CellBorderPosition,
): EdgeCandidates[] {
	const { rowIndex, cellIndex, rowCount, columnCount } = pos;
	const isTop = rowIndex === 0;
	const isBottom = rowIndex === rowCount - 1;
	const isLeft = cellIndex === 0;
	const isRight = cellIndex === columnCount - 1;

	const layers: (EdgeCandidates | undefined)[] = [];

	// Whole table: region spans the entire table.
	layers.push(edgesFromSection(entry.wholeTblBorders, isTop, isBottom, isLeft, isRight));

	// Banded rows: treat each banded row as its own single-row region.
	if (tableData.bandedRows) {
		const bandStartRow = tableData.firstRowHeader ? 1 : 0;
		const bandEndRow = tableData.lastRow ? rowCount - 1 : rowCount;
		if (rowIndex >= bandStartRow && rowIndex < bandEndRow) {
			const rowCycle = Math.max(tableData.bandRowCycle ?? 1, 1);
			const bandGroup = Math.floor((rowIndex - bandStartRow) / rowCycle) % 2;
			const bands = bandGroup === 0 ? entry.band1HBorders : entry.band2HBorders;
			layers.push(edgesFromSection(bands, true, true, isLeft, isRight));
		}
	}

	// Banded columns: treat each banded column as its own single-column region.
	if (tableData.bandedColumns) {
		const colStart = tableData.firstCol ? 1 : 0;
		const colEnd = tableData.lastCol ? columnCount - 1 : columnCount;
		if (cellIndex >= colStart && cellIndex < colEnd) {
			const colCycle = Math.max(tableData.bandColCycle ?? 1, 1);
			const colGroup = Math.floor((cellIndex - colStart) / colCycle) % 2;
			const bands = colGroup === 0 ? entry.band1VBorders : entry.band2VBorders;
			layers.push(edgesFromSection(bands, isTop, isBottom, true, true));
		}
	}

	// First/last row: single-row region spanning all columns.
	if (tableData.firstRowHeader && isTop) {
		layers.push(edgesFromSection(entry.firstRowBorders, true, true, isLeft, isRight));
	}
	if (tableData.lastRow && isBottom) {
		layers.push(edgesFromSection(entry.lastRowBorders, true, true, isLeft, isRight));
	}
	// First/last column: single-column region spanning all rows.
	if (tableData.firstCol && isLeft) {
		layers.push(edgesFromSection(entry.firstColBorders, isTop, isBottom, true, true));
	}
	if (tableData.lastCol && isRight) {
		layers.push(edgesFromSection(entry.lastColBorders, isTop, isBottom, true, true));
	}

	return layers.filter((layer): layer is EdgeCandidates => layer !== undefined);
}

/**
 * Resolve the CSS borders a cell inherits from its table style. Returns
 * `undefined` when the style defines no applicable borders (so the caller can
 * keep its own fallback border, e.g. the hardcoded total-row line).
 */
export function resolveCellBorderCss(
	entry: ParsedTableStyleEntry | undefined,
	tableData: PptxTableData,
	pos: CellBorderPosition,
	resolve: ResolveBorderColor,
): CellBorderCss | undefined {
	if (!entry) {
		return undefined;
	}
	const layers = collectLayers(entry, tableData, pos);
	if (layers.length === 0) {
		return undefined;
	}

	const pick = (edge: keyof EdgeCandidates): ParsedTableStyleBorder | undefined => {
		let winner: ParsedTableStyleBorder | undefined;
		for (const layer of layers) {
			if (layer[edge]) {
				winner = layer[edge];
			}
		}
		return winner;
	};

	const css: CellBorderCss = {};
	let applied = false;
	const edges = ['top', 'bottom', 'left', 'right'] as const;
	for (const edge of edges) {
		const value = borderToCss(pick(edge), resolve);
		if (value) {
			const key = `border${edge[0].toUpperCase()}${edge.slice(1)}` as keyof CellBorderCss;
			css[key] = value;
			applied = true;
		}
	}
	return applied ? css : undefined;
}
