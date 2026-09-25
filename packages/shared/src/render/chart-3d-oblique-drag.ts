/**
 * Value-drag maths for the right-angle-axes 3D bar chart
 * (`chart-3d-oblique-layout.ts`), kept pure so it is testable without WebGL.
 *
 * A bar's front face is drawn flat, so dragging along the value axis moves
 * its value by `chart px / valueScale`, rounded like every other chart drag
 * (`roundDragValue`). Columns drag vertically (up = larger), horizontal bars
 * horizontally (right = larger). Like the 2D chart, only `clustered` and
 * `standard` bars are value-draggable: a stacked segment sits on a running
 * sum, so dragging one would not track the pointer.
 *
 * @module chart-3d-oblique-drag
 */
import { obliqueBarTaper } from './chart-3d-oblique-bars';
import type { ObliqueBar, ObliqueChartLayout } from './chart-3d-oblique-layout';
import { roundDragValue } from './chart-interaction';

/** Whether a bar in this layout can be value-dragged. */
export function isObliqueBarDraggable(layout: Pick<ObliqueChartLayout, 'grouping'>): boolean {
	return layout.grouping === 'clustered' || layout.grouping === 'standard';
}

/**
 * The value after dragging by a pointer delta, in chart px (`dx` right,
 * `dy` down).
 */
export function obliqueDragValue(
	layout: Pick<ObliqueChartLayout, 'horizontal' | 'range' | 'valueScale'>,
	startValue: number,
	dx: number,
	dy: number,
): number {
	const along = layout.horizontal ? dx : -dy;
	const raw = startValue + along / layout.valueScale;
	const span = layout.range.max - layout.range.min;
	return roundDragValue(raw, { min: layout.range.min, max: layout.range.max, span });
}

/**
 * A bar's extent along the value axis after a drag to `value` (the baseline
 * end stays put), clipped to the axis, in the layout's world units.
 */
export function obliqueDraggedExtent(
	layout: Pick<ObliqueChartLayout, 'range' | 'valueScale'>,
	value: number,
): { from: number; length: number } {
	const { min, max } = layout.range;
	const base = Math.min(Math.max(0, min), max);
	const clamp = (v: number): number => Math.min(Math.max(v, min), max);
	const lo = (clamp(Math.min(base, value)) - min) * layout.valueScale;
	const hi = (clamp(Math.max(base, value)) - min) * layout.valueScale;
	return { from: lo, length: hi - lo };
}

/** `bar` with its value-axis extent (and taper) replaced: a live drag preview. */
export function obliqueBarAtValue(
	layout: Pick<ObliqueChartLayout, 'horizontal' | 'range' | 'valueScale'>,
	bar: ObliqueBar,
	value: number,
): ObliqueBar {
	const { from, length } = obliqueDraggedExtent(layout, value);
	const extent = (layout.range.max - layout.range.min) * layout.valueScale;
	const taper = obliqueBarTaper(bar.shape, from, from + length, extent, value);
	return layout.horizontal
		? { ...bar, x: from, w: length, value, taper }
		: { ...bar, y: from, h: length, value, taper };
}
