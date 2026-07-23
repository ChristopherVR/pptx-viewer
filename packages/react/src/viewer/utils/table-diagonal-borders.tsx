import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
// `getCellDiagonalBorders` combines a cell's explicit diagonals with any
// inherited from the applicable table-style sections; shared so the resolution
// stays in sync with the other bindings.
import { getCellDiagonalBorders as resolveCellDiagonalBorders } from 'pptx-viewer-shared';
import React from 'react';

import type { TableStyleContext } from './table-band-style';

/**
 * Diagonal border data for a table cell.
 * "DiagDown" = top-left to bottom-right (a:lnTlToBr).
 * "DiagUp" = bottom-left to top-right (a:lnBlToTr).
 */
export interface DiagonalBorderInfo {
	diagDownColor?: string;
	diagDownWidth?: number;
	diagUpColor?: string;
	diagUpWidth?: number;
}

/** Cell coordinates + table dimensions used to select table-style sections. */
export interface CellDiagonalPosition {
	rowIndex: number;
	cellIndex: number;
	rowCount: number;
	columnCount: number;
}

/**
 * Resolve a cell's diagonal borders, combining its explicit per-cell diagonals
 * with any inherited from the applicable table-style sections (`a:tl2br` /
 * `a:bl2tr`). Per-cell diagonals take precedence on each axis. Returns `null`
 * when neither the cell nor the style defines a diagonal.
 */
export function getCellDiagonalBorders(
	style: PptxTableCellStyle | undefined,
	tableData: PptxTableData | undefined,
	pos: CellDiagonalPosition,
	styleCtx?: TableStyleContext,
): DiagonalBorderInfo | null {
	return resolveCellDiagonalBorders(style, tableData, pos, {
		tableStyleMap: styleCtx?.tableStyleMap,
		colorScheme: styleCtx?.theme?.colorScheme,
		fontScheme: styleCtx?.theme?.fontScheme,
	});
}

/**
 * Renders SVG diagonal border lines inside a table cell.
 * The parent `<td>` must have `position: relative` for this overlay
 * to be positioned correctly.
 */
export function TableCellDiagonalBorders({
	diag,
}: {
	diag: DiagonalBorderInfo;
}): React.ReactElement | null {
	const hasDown = Boolean(diag.diagDownColor && diag.diagDownWidth);
	const hasUp = Boolean(diag.diagUpColor && diag.diagUpWidth);
	if (!hasDown && !hasUp) {
		return null;
	}

	return (
		<svg
			aria-hidden='true'
			style={{
				position: 'absolute',
				inset: 0,
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
				overflow: 'visible',
			}}
		>
			{hasDown && (
				<line
					x1='0'
					y1='0'
					x2='100%'
					y2='100%'
					stroke={diag.diagDownColor}
					strokeWidth={diag.diagDownWidth}
				/>
			)}
			{hasUp && (
				<line
					x1='0'
					y1='100%'
					x2='100%'
					y2='0'
					stroke={diag.diagUpColor}
					strokeWidth={diag.diagUpWidth}
				/>
			)}
		</svg>
	);
}
