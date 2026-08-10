import type { ParsedTableStyleMap, PptxElement, PptxTheme } from 'pptx-viewer-core';
import { getTableCellBandStyle as resolveTableCellBandStyle } from 'pptx-viewer-shared';
import type React from 'react';

/**
 * Table band / header / emphasis styling for the React table renderer.
 *
 * The resolution itself (`ppt/tableStyles.xml` lookup, whole-table and banded
 * fills, header / total / first / last emphasis, `a:fontRef@idx` font resolution,
 * gradient and pattern fills) lives in `pptx-viewer-shared`, so every binding
 * paints a table the same way. This module is the React adapter: it narrows the
 * element, maps the theme onto the shared context, and hands back a
 * `CSSProperties` object.
 *
 * @module viewer/utils/table-band-style
 */

/** Context for resolving table style colours from the theme. */
export interface TableStyleContext {
	tableStyleMap?: ParsedTableStyleMap;
	theme?: PptxTheme;
}

/**
 * Resolve the CSS a table cell inherits from its table style, given its
 * position in the table.
 *
 * @param element - The table element (anything else yields `undefined`).
 * @param rowIndex - Zero-based row index of the cell.
 * @param cellIndex - Zero-based column index of the cell.
 * @param rowCount - Total rows, needed for the last-row emphasis.
 * @param columnCount - Total columns, needed for the last-column emphasis.
 * @param styleCtx - Parsed table styles + the active theme.
 * @returns The cell's style, or `undefined` when nothing applies.
 */
export function getTableCellBandStyle(
	element: PptxElement,
	rowIndex: number,
	cellIndex: number,
	rowCount: number,
	columnCount: number,
	styleCtx?: TableStyleContext,
): React.CSSProperties | undefined {
	if (element.type !== 'table') {
		return undefined;
	}
	return resolveTableCellBandStyle(element.tableData, rowIndex, cellIndex, rowCount, columnCount, {
		tableStyleMap: styleCtx?.tableStyleMap,
		colorScheme: styleCtx?.theme?.colorScheme,
		fontScheme: styleCtx?.theme?.fontScheme,
	}) as React.CSSProperties | undefined;
}
