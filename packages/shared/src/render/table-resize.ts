/**
 * table-resize.ts - framework-agnostic table drag-resize geometry.
 *
 * The pure math behind the column / row drag handles: cumulative column-boundary
 * positions, redistributing two adjacent column proportions by a drag delta
 * (clamped + renormalised to sum to 1), and clamping a dragged row height.
 * Extracted from the React viewer's `utils/table-render-resize.tsx` overlay so
 * every binding drives its own overlay component from one copy of the maths.
 * No framework imports.
 */

/** Minimum proportion a single column may shrink to during a drag. */
export const MIN_COLUMN_PROPORTION = 0.03;

/** Minimum height (px) a row may shrink to during a drag. */
export const MIN_ROW_HEIGHT = 16;

/** Default row height (px) assumed when an actual measurement is unavailable. */
export const DEFAULT_ROW_HEIGHT = 32;

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
