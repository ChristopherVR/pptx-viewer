/**
 * table-resize.ts - framework-agnostic table drag-resize geometry.
 *
 * The pure math behind the column / row drag handles: cumulative column-boundary
 * positions, redistributing two adjacent column proportions by a drag delta
 * (clamped + renormalised to sum to 1), and clamping a dragged row height.
 * Extracted from the React viewer's `utils/table-render-resize.tsx` overlay so
 * every binding drives its own overlay component from one copy of the maths.
 *
 * Also holds the SEPARATE table-properties-inspector maths: setting a single
 * column to an absolute width (`redistributeColumnWidth`, proportionally
 * rescaling every OTHER column to preserve their relative ratios) and the
 * "distribute evenly" one-liners for column widths / row heights
 * (`evenColumnWidths` / `evenRowHeights`). Contrast `redistributeColumnWidth`
 * with `computeResizedColumnWidths` above: the drag handle redistributes width
 * between two ADJACENT columns by a delta, while the inspector slider sets one
 * column's absolute width and rescales every other column around it.
 *
 * No framework imports (the one type import, `PptxTableRow`, is a pure
 * interface with no runtime code).
 */
/* oxlint-disable eslint/one-var -- each constant below carries its own doc
   comment; merging them into one statement would strip that documentation. */
import type { PptxTableRow } from 'pptx-viewer-core';

/** Minimum proportion a single column may shrink to during a drag. */
export const MIN_COLUMN_PROPORTION = 0.03;

/** Minimum height (px) a row may shrink to during a drag. */
export const MIN_ROW_HEIGHT = 16;

/** Default row height (px) assumed when an actual measurement is unavailable. */
export const DEFAULT_ROW_HEIGHT = 32;

/** Minimum proportion a column may be set to via the properties-panel width control. */
export const MIN_COLUMN_WIDTH_FRACTION = 0.05;

/**
 * Cumulative left-edge positions (as percentages, 0-100) of the internal column
 * boundaries, i.e. one entry between each adjacent pair of columns. The leading
 * edge (0%) and trailing edge (100%) are omitted since they are not draggable.
 *
 * @param columnWidths Column widths as proportions summing to ~1.
 */
export function computeColumnBoundaries(columnWidths: number[]): number[] {
	const result: number[] = [];
	let cumulative = 0;
	for (let i = 0; i < columnWidths.length - 1; i++) {
		cumulative += columnWidths[i];
		result.push(cumulative * 100);
	}
	return result;
}

/**
 * Redistribute width between the column at `index` and the one after it by
 * `deltaProportion` (a signed fraction of the total table width, typically
 * `dragDeltaPx / tableWidthPx`). Both columns are clamped to
 * {@link MIN_COLUMN_PROPORTION}, then the whole array is renormalised so it
 * sums to 1. Returns the original array unchanged when `index` has no
 * right-hand neighbour.
 *
 * @param initialWidths Column widths as proportions summing to ~1.
 */
export function computeResizedColumnWidths(
	initialWidths: number[],
	index: number,
	deltaProportion: number,
): number[] {
	if (index < 0 || index + 1 >= initialWidths.length) {
		return initialWidths;
	}
	const newWidths = [...initialWidths];
	newWidths[index] = Math.max(MIN_COLUMN_PROPORTION, initialWidths[index] + deltaProportion);
	newWidths[index + 1] = Math.max(
		MIN_COLUMN_PROPORTION,
		initialWidths[index + 1] - deltaProportion,
	);
	const sum = newWidths.reduce((a, b) => a + b, 0);
	if (sum <= 0) {
		return initialWidths;
	}
	return newWidths.map((w) => w / sum);
}

/**
 * Clamp a dragged row height: `initialRowHeight + deltaY`, floored at
 * {@link MIN_ROW_HEIGHT} and rounded to the nearest whole pixel.
 */
export function computeResizedRowHeight(initialRowHeight: number, deltaY: number): number {
	return Math.round(Math.max(MIN_ROW_HEIGHT, initialRowHeight + deltaY));
}

/**
 * Redistribute column widths when column `index` is set to `newFraction` (a
 * proportion of the table width, 0-1), scaling every OTHER column
 * proportionally so their relative ratios to each other are preserved and the
 * array still sums to 1. This is the table-properties-inspector "set this
 * column's width" slider/input, shared by every binding so a drag on one
 * behaves identically to a drag on any other.
 *
 * Each non-target column is floored at {@link MIN_COLUMN_WIDTH_FRACTION}
 * before the whole array is renormalised to sum to 1.
 *
 * Returns `widths` unchanged if `index` is out of range.
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
				next[j] = Math.max(MIN_COLUMN_WIDTH_FRACTION, widths[j] - diff * (widths[j] / othersTotal));
			}
		}
	}
	const sum = next.reduce((a, b) => a + b, 0);
	return sum > 0 ? next.map((w) => w / sum) : next;
}

/** An equal-width column array for `count` columns, each `1 / count` (empty for `count <= 0`). */
export function evenColumnWidths(count: number): number[] {
	if (count <= 0) {
		return [];
	}
	return Array.from({ length: count }, () => 1 / count);
}

/**
 * `rows` with a uniform height applied: every row's height is set to the
 * rounded average of the rows' current heights (falling back to
 * {@link DEFAULT_ROW_HEIGHT} for a row with no explicit height).
 */
export function evenRowHeights(rows: PptxTableRow[]): PptxTableRow[] {
	const count = rows.length;
	if (count === 0) {
		return rows;
	}
	const avg = Math.round(rows.reduce((s, r) => s + (r.height ?? DEFAULT_ROW_HEIGHT), 0) / count);
	return rows.map((r) => ({ ...r, height: avg }));
}
