/**
 * Pure, framework-agnostic helpers for table rendering.
 *
 * Ported from:
 *   - packages/react/src/viewer/utils/table-render-helpers.ts  (cellStyleToCss,
 *     ooxmlDashToCssBorderStyle)
 *   - packages/react/src/viewer/utils/table-render-data.tsx     (row / cell
 *     view-model projection)
 *
 * All functions are pure (no Angular dependencies) so they can be unit-tested
 * with plain vitest without TestBed or the Angular compiler.
 */
import type {
	PptxElement,
	PptxTableCell,
	PptxTableCellStyle,
	PptxTableRow,
	TablePptxElement,
} from 'pptx-viewer-core';

import type { StyleMap } from './element-style';

// ==========================================================================
// Border dash mapping
// ==========================================================================

/**
 * Map an OOXML border-dash preset to a CSS border-style keyword.
 *
 * Mirrors `ooxmlDashToCssBorderStyle` in table-render-helpers.ts.
 */
export function ooxmlDashToCssBorderStyle(dashVal: string | undefined): string {
	if (!dashVal) {
		return 'solid';
	}
	switch (dashVal) {
		case 'dot':
		case 'sysDot':
			return 'dotted';
		case 'dash':
		case 'sysDash':
		case 'lgDash':
		case 'dashDot':
		case 'lgDashDot':
		case 'sysDashDot':
		case 'lgDashDotDot':
		case 'sysDashDotDot':
			return 'dashed';
		default:
			return 'solid';
	}
}

// ==========================================================================
// Cell style → StyleMap
// ==========================================================================

/**
 * Convert a `PptxTableCellStyle` object to an `[ngStyle]`-compatible map.
 *
 * Viewer-first subset: fill (solid + gradient via prebuilt CSS string),
 * text styling, per-edge borders, cell margins, vertical alignment, and
 * vertical text direction. Pattern fills and complex structured gradient
 * builders remain TODOs (see PORTING.md).
 *
 * Mirrors `cellStyleToCss` in table-render-helpers.ts.
 */
export function cellStyleToStyleMap(style: PptxTableCellStyle | undefined): StyleMap {
	if (!style) {
		return {};
	}
	const map: StyleMap = {};

	// --- Text formatting ---
	if (style.fontSize) {
		map['font-size'] = `${style.fontSize}px`;
	}
	if (style.bold) {
		map['font-weight'] = 'bold';
	}
	if (style.italic) {
		map['font-style'] = 'italic';
	}
	if (style.underline) {
		map['text-decoration'] = 'underline';
	}
	if (style.color) {
		map['color'] = style.color;
	}

	// --- Background fill ---
	// Priority: gradient (prebuilt CSS string) → solid backgroundColor.
	// Pattern fills (SVG-based) require color-core extraction from shared;
	// deferred — see PORTING.md "Strong remaining extraction candidates".
	if (style.gradientFillCss) {
		map['background'] = style.gradientFillCss;
	} else if (style.backgroundColor) {
		map['background-color'] = style.backgroundColor;
	}

	// --- Text alignment ---
	if (style.align) {
		map['text-align'] = style.align;
	}
	if (style.vAlign) {
		// CSS vertical-align on <td> maps directly to top/middle/bottom.
		map['vertical-align'] = style.vAlign;
	}

	// --- Vertical text direction (a:tcPr/@vert) ---
	// Mirrors the switch in table-render-helpers.ts cellStyleToCss.
	if (style.textDirection) {
		switch (style.textDirection) {
			case 'vert':
			case 'eaVert':
			case 'wordArtVert':
			case 'wordArtVertRtl':
				map['writing-mode'] = 'vertical-rl';
				break;
			case 'vert270':
			case 'mongolianVert':
				map['writing-mode'] = 'vertical-lr';
				break;
		}
		if (map['writing-mode']) {
			map['text-orientation'] = style.textDirection === 'wordArtVert' ? 'upright' : 'mixed';
		}
		if (style.textDirection === 'wordArtVertRtl') {
			map['direction'] = 'rtl';
		}
	}

	// --- Per-edge borders ---
	// React source: table-render-helpers.ts, borderEdges loop.
	type EdgeKey = 'border-top' | 'border-bottom' | 'border-left' | 'border-right';
	const borderEdges: ReadonlyArray<{
		cssProp: EdgeKey;
		width: number | undefined;
		color: string | undefined;
		dash: string | undefined;
	}> = [
		{
			cssProp: 'border-top',
			width: style.borderTopWidth,
			color: style.borderTopColor,
			dash: style.borderTopDash,
		},
		{
			cssProp: 'border-bottom',
			width: style.borderBottomWidth,
			color: style.borderBottomColor,
			dash: style.borderBottomDash,
		},
		{
			cssProp: 'border-left',
			width: style.borderLeftWidth,
			color: style.borderLeftColor,
			dash: style.borderLeftDash,
		},
		{
			cssProp: 'border-right',
			width: style.borderRightWidth,
			color: style.borderRightColor,
			dash: style.borderRightDash,
		},
	];
	for (const edge of borderEdges) {
		if (edge.width !== undefined || edge.color !== undefined) {
			const w = edge.width ?? 1;
			const c = edge.color ?? style.borderColor ?? '#000000';
			const s = ooxmlDashToCssBorderStyle(edge.dash);
			map[edge.cssProp] = `${w}px ${s} ${c}`;
		}
	}

	// --- Cell margins (mapped to padding on the <td>) ---
	if (style.marginLeft !== undefined) {
		map['padding-left'] = `${style.marginLeft}px`;
	}
	if (style.marginRight !== undefined) {
		map['padding-right'] = `${style.marginRight}px`;
	}
	if (style.marginTop !== undefined) {
		map['padding-top'] = `${style.marginTop}px`;
	}
	if (style.marginBottom !== undefined) {
		map['padding-bottom'] = `${style.marginBottom}px`;
	}

	// --- Text shadow / glow ---
	// React source: table-render-helpers.ts, text-shadow composition.
	const shadowParts: string[] = [];
	if (style.textShadowColor) {
		const offX = style.textShadowOffsetX ?? 1;
		const offY = style.textShadowOffsetY ?? 1;
		const blur = style.textShadowBlur ?? 0;
		shadowParts.push(`${offX}px ${offY}px ${blur}px ${style.textShadowColor}`);
	}
	if (style.textGlowColor) {
		const radius = style.textGlowRadius ?? 2;
		shadowParts.push(`0px 0px ${radius}px ${style.textGlowColor}`);
	}
	if (shadowParts.length > 0) {
		map['text-shadow'] = shadowParts.join(', ');
	}

	return map;
}

// ==========================================================================
// Row / column style helpers
// ==========================================================================

/**
 * Compute the `[ngStyle]` map for a `<col>` element given its proportion of
 * the total table width (0–1 fraction from `PptxTableData.columnWidths`).
 */
export function columnWidthStyle(widthFraction: number): StyleMap {
	return { width: `${(widthFraction * 100).toFixed(2)}%` };
}

/**
 * Compute the `[ngStyle]` map for a `<tr>` element.
 *
 * Returns an empty map when the row has no explicit height so the browser
 * distributes height naturally.
 */
export function rowStyle(row: PptxTableRow): StyleMap {
	return row.height !== undefined ? { height: `${row.height}px` } : {};
}

/**
 * Build the combined `[ngStyle]` for a `<td>` cell element.
 *
 * Applies default padding (mirrors the React `px-1 py-0.5` Tailwind classes)
 * and merges the per-cell style on top.
 */
export function cellTdStyle(cell: PptxTableCell): StyleMap {
	return {
		'padding-left': '4px',
		'padding-right': '4px',
		'padding-top': '2px',
		'padding-bottom': '2px',
		'vertical-align': 'top',
		...cellStyleToStyleMap(cell.style),
	};
}

// ==========================================================================
// View-model types
// ==========================================================================

/**
 * A flattened cell descriptor ready for template iteration. Cells flagged
 * `hMerge` or `vMerge` are excluded; the template produces no `<td>` for
 * them (the origin cell's colspan/rowspan expands to cover the gap).
 */
export interface TableCellViewModel {
	cell: PptxTableCell;
	/** Resolved colspan from `gridSpan` (≥ 2) or undefined. */
	colSpan: number | undefined;
	/** Resolved rowspan from `rowSpan` (≥ 2) or undefined. */
	rowSpan: number | undefined;
	/** Pre-computed `[ngStyle]` map for this cell's `<td>`. */
	tdStyle: StyleMap;
	/** Display text — non-breaking space when the cell is empty to keep the row height. */
	displayText: string;
}

export interface TableRowViewModel {
	rowStyle: StyleMap;
	cells: TableCellViewModel[];
}

// ==========================================================================
// View-model projection
// ==========================================================================

/**
 * Project a `TablePptxElement` into view-model rows, skipping merged-away
 * cells and resolving spans. Returns an empty array when `tableData` is
 * absent.
 *
 * Exported so tests can drive it directly without a component instance.
 *
 * Mirrors the row/cell mapping in table-render-data.tsx.
 */
export function buildTableViewModel(el: PptxElement): TableRowViewModel[] {
	if (el.type !== 'table') {
		return [];
	}
	const tableEl = el as TablePptxElement;
	const tableData = tableEl.tableData;
	if (!tableData || tableData.rows.length === 0) {
		return [];
	}

	return tableData.rows.map((row) => {
		const cells: TableCellViewModel[] = row.cells
			.filter((cell) => !cell.hMerge && !cell.vMerge)
			.map((cell) => {
				const colSpan =
					cell.gridSpan !== undefined && cell.gridSpan > 1 ? cell.gridSpan : undefined;
				const rowSpan = cell.rowSpan !== undefined && cell.rowSpan > 1 ? cell.rowSpan : undefined;
				return {
					cell,
					colSpan,
					rowSpan,
					tdStyle: cellTdStyle(cell),
					// Non-breaking space keeps the row height when the cell is empty;
					// mirrors `cell.text || ' '` in table-render-data.tsx.
					displayText: cell.text || ' ',
				};
			});
		return { rowStyle: rowStyle(row), cells };
	});
}

/**
 * Compute `<col>` width styles from the column-widths array (0–1 fractions).
 */
export function buildColStyles(el: PptxElement): StyleMap[] {
	if (el.type !== 'table') {
		return [];
	}
	const tableEl = el as TablePptxElement;
	const widths = tableEl.tableData?.columnWidths ?? [];
	return widths.map((w) => columnWidthStyle(w));
}
