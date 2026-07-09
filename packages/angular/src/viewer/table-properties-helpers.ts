/**
 * table-properties-helpers.ts: pure helpers for the table properties inspector.
 *
 * The small immutable transforms behind the Angular port of the React
 * `TablePropertiesPanel` / `TableCellAdvancedFill`: applying a quick-style
 * preset, redistributing a single column's width across its neighbours,
 * even-distributing column widths / row heights, and building a CSS gradient
 * string from structured stops so the renderer shows edited gradients live.
 *
 * No Angular imports, so they are unit-testable with plain vitest.
 */
import type { PptxTableCellStyle, PptxTableData, PptxTableRow } from 'pptx-viewer-core';

import type { TableStylePreset } from '../internal/shared';

/** Default row height (px) used when a row has no explicit height. */
export const DEFAULT_TABLE_ROW_HEIGHT = 32;

/** The boolean structure/style flags on `PptxTableData` the toggles can flip. */
export type TableBooleanFlag =
	| 'bandedRows'
	| 'firstRowHeader'
	| 'bandedColumns'
	| 'firstCol'
	| 'lastCol'
	| 'lastRow';

/** The structure / style toggle flags shown as checkboxes, with i18n dictionary keys. */
export const TABLE_STRUCTURE_TOGGLES: ReadonlyArray<{
	key: TableBooleanFlag;
	labelKey: string;
}> = [
	{ key: 'bandedRows', labelKey: 'pptx.table.bandedRows' },
	{ key: 'firstRowHeader', labelKey: 'pptx.table.headerRow' },
	{ key: 'bandedColumns', labelKey: 'pptx.table.bandedColumns' },
	{ key: 'firstCol', labelKey: 'pptx.table.firstColumn' },
	{ key: 'lastCol', labelKey: 'pptx.table.lastColumn' },
	{ key: 'lastRow', labelKey: 'pptx.table.lastRow' },
];

/**
 * Apply a table quick-style preset to every cell's style, mirroring the React
 * `TablePropertiesPanel` preset `onClick`. Header cells get the header fill /
 * foreground + bold; banded body rows get the band background; every cell gets
 * the preset border colour. Returns a new rows array.
 */
export function applyTableStylePreset(td: PptxTableData, preset: TableStylePreset): PptxTableRow[] {
	return td.rows.map((row, ri) => ({
		...row,
		cells: row.cells.map((cell) => {
			const isHeader = ri === 0 && Boolean(td.firstRowHeader);
			const isBand = Boolean(td.bandedRows) && (ri - (td.firstRowHeader ? 1 : 0)) % 2 === 0;
			const style: PptxTableCellStyle = {
				...cell.style,
				backgroundColor: isHeader ? preset.headerBg : isBand ? preset.bandBg : undefined,
				color: isHeader ? preset.headerFg : cell.style?.color,
				bold: isHeader ? true : cell.style?.bold,
				borderColor: preset.borderColor,
			};
			return { ...cell, style };
		}),
	}));
}

/**
 * Redistribute column widths when a single column is set to `newFraction`,
 * scaling the other columns proportionally so the array still sums to 1.
 * Mirrors the React column-width slider `onChange`.
 */
export function redistributeColumnWidth(
	widths: number[],
	index: number,
	newFraction: number,
): number[] {
	const oldFraction = widths[index];
	if (oldFraction === undefined) {
		return widths;
	}
	const diff = newFraction - oldFraction;
	const next = [...widths];
	next[index] = newFraction;
	const othersTotal = 1 - oldFraction;
	if (othersTotal > 0) {
		for (let j = 0; j < next.length; j++) {
			if (j !== index) {
				next[j] = Math.max(0.05, widths[j] - diff * (widths[j] / othersTotal));
			}
		}
	}
	const sum = next.reduce((a, b) => a + b, 0);
	return sum > 0 ? next.map((w) => w / sum) : next;
}

/** An equal-width column array for `count` columns. */
export function evenColumnWidths(count: number): number[] {
	if (count <= 0) {
		return [];
	}
	return Array.from({ length: count }, () => 1 / count);
}

/** Rows with a uniform (average) height applied. */
export function evenRowHeights(td: PptxTableData): PptxTableRow[] {
	const count = td.rows.length;
	if (count === 0) {
		return td.rows;
	}
	const avg = Math.round(
		td.rows.reduce((s, r) => s + (r.height ?? DEFAULT_TABLE_ROW_HEIGHT), 0) / count,
	);
	return td.rows.map((r) => ({ ...r, height: avg }));
}

/**
 * Build a CSS gradient string from structured cell-style gradient fields, so
 * the renderer (which reads `gradientFillCss`) shows an edited gradient live.
 */
export function buildGradientFillCss(
	stops: Array<{ color: string; position: number }>,
	type: 'linear' | 'radial',
	angle: number,
): string {
	const ordered = [...stops].sort((a, b) => a.position - b.position);
	const parts = ordered.map((s) => `${s.color} ${Math.round(s.position)}%`).join(', ');
	if (type === 'radial') {
		return `radial-gradient(circle, ${parts})`;
	}
	return `linear-gradient(${Math.round(angle)}deg, ${parts})`;
}
