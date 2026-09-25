/**
 * chart-ofpie-split.ts: split-membership + layout geometry for the pie-of-pie /
 * bar-of-pie chart (`c:ofPieChart`).
 *
 * Split out of `chart-ofpie.ts` to keep each module within the repo's ~300-LOC
 * limit. Resolves which of a single series' points move to the SECONDARY plot
 * (`resolveSecondaryIndices`), the per-slice angular spans (`sliceAngles`), and
 * the primary/secondary plot placement (`computeOfPieGeom`).
 *
 * @module chart-ofpie-split
 */
import type { PptxChartOfPieOptions, PptxElement } from 'pptx-viewer-core';

/** Angular span (radians) of a single pie slice, with its bisector. */
export interface SliceAngle {
	start: number;
	end: number;
	mid: number;
}

/** Resolved plot placement for a pie-of-pie / bar-of-pie chart. */
export interface OfPieGeom {
	svgWidth: number;
	svgHeight: number;
	primaryCx: number;
	primaryCy: number;
	primaryR: number;
	secondaryCx: number;
	secondaryCy: number;
	secondaryR: number;
}

/**
 * Resolve which point indices belong to the secondary plot per `c:ofPieChart`
 * split rules: `pos` / `auto` (the last N points, default 2), `val` / `percent`
 * (points below a threshold), or `cust` (an explicit index list). Never returns
 * every point, so the primary pie always keeps at least one real slice.
 */
export function resolveSecondaryIndices(
	values: ReadonlyArray<number>,
	options: PptxChartOfPieOptions,
): Set<number> {
	const n = values.length;
	const result = new Set<number>();
	if (n <= 1) {
		return result;
	}
	const splitType = options.splitType ?? 'auto';
	if (splitType === 'cust') {
		for (const idx of options.custSplit ?? []) {
			if (idx >= 0 && idx < n) {
				result.add(idx);
			}
		}
	} else if (splitType === 'val') {
		const threshold = options.splitPos ?? 0;
		values.forEach((v, i) => {
			if (v < threshold) {
				result.add(i);
			}
		});
	} else if (splitType === 'percent') {
		const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
		const threshold = options.splitPos ?? 0;
		values.forEach((v, i) => {
			if ((Math.abs(v) / total) * 100 < threshold) {
				result.add(i);
			}
		});
	} else {
		// 'pos' and 'auto': the last N points (auto defaults to 2).
		const count = Math.min(Math.max(Math.round(options.splitPos ?? 2), 1), n - 1);
		for (let i = n - count; i < n; i++) {
			result.add(i);
		}
	}
	// Never move every point to the secondary plot: keep at least one primary slice.
	if (result.size >= n) {
		result.delete(0);
	}
	return result;
}

/**
 * Cumulative clockwise slice angles for a set of values, starting at
 * `startAngle` (radians, SVG orientation: 0 = 3 o'clock, positive = down).
 */
export function sliceAngles(
	values: ReadonlyArray<number>,
	startAngle = -Math.PI / 2,
): SliceAngle[] {
	const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
	let cursor = startAngle;
	return values.map((v) => {
		const span = (Math.abs(v) / total) * Math.PI * 2;
		const start = cursor;
		cursor += span;
		return { start, end: cursor, mid: (start + cursor) / 2 };
	});
}

/** Compute the primary + secondary plot placement for a chart element. */
export function computeOfPieGeom(
	element: PptxElement,
	secondPieSize: number,
	toBar = false,
): OfPieGeom {
	// Match the element frame exactly; bindings stretch the viewBox with
	// preserveAspectRatio "none", so a minimum would scale non-uniformly.
	const svgWidth = Math.max(element.width, 1);
	const svgHeight = Math.max(element.height, 1);
	// COM-verified placement (charts-com.pptx slides 5 and 6): pie-of-pie puts
	// the primary pie at about a quarter of the width with a radius near 30% of
	// the height and the secondary pie at 78%; bar-of-pie gives the primary pie
	// far more room (38% across, radius 42% of the height) and a slim bar at 80%.
	const primaryR = toBar
		? Math.max(Math.min(svgWidth * 0.24, svgHeight * 0.42), 4)
		: Math.max(Math.min(svgWidth * 0.2, svgHeight * 0.3), 4);
	const secScale = Math.min(Math.max(secondPieSize / 100, 0.3), 1.4);
	return {
		svgWidth,
		svgHeight,
		primaryCx: svgWidth * (toBar ? 0.38 : 0.25),
		primaryCy: svgHeight * 0.5,
		primaryR,
		secondaryCx: svgWidth * (toBar ? 0.8 : 0.78),
		secondaryCy: svgHeight * 0.5,
		secondaryR: Math.max(primaryR * secScale, 4),
	};
}
