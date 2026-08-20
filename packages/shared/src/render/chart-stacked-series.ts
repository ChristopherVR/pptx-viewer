/**
 * chart-stacked-series.ts: running-sum plot geometry for stacked and
 * percentStacked LINE / AREA charts.
 *
 * Bar/column stacking (`computeStackedBarRects` in chart-view-model.ts) draws
 * one rect per segment stacked on a shared baseline. Line/area stacking is
 * different: each series is plotted at its cumulative height, so the
 * top-most series traces the category total (line) or the topmost band edge
 * (area). This module owns that running-sum math, shared by `buildLines` and
 * `buildAreas` in chart-cartesian-line-area.ts so the two kinds cannot drift.
 *
 * @module chart-stacked-series
 */

/** How a line/area series' values combine with its siblings for plotting. */
export type LineAreaStacking = 'clustered' | 'stacked' | 'percentStacked';

/** Per-category stacked plot geometry for one series. */
export interface StackedSeriesPlot {
	/** Cumulative value through and including this series: the plotted line/area top. */
	cumulative: number[];
	/** Cumulative value before this series: the area band's lower edge. */
	base: number[];
	/**
	 * This series' own contribution at each category: the raw value for plain
	 * `stacked`, or its percent share of the category's absolute total for
	 * `percentStacked`. Used for data-label/tooltip text, which reads the
	 * series' value rather than the running sum it is plotted at.
	 */
	own: number[];
}

/**
 * Per-category sum of absolute values across all series, used to normalise
 * percentStacked shares. Mirrors `categoryTotals` in chart-cartesian-bars.ts
 * (bar's percentStacked normalisation) so bar/line/area agree on what "100%"
 * means for a category.
 */
function categoryAbsTotals(
	seriesValues: ReadonlyArray<ReadonlyArray<number>>,
	catCount: number,
): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		seriesValues.reduce((sum, values) => sum + Math.abs(values[ci] ?? 0), 0),
	);
}

/**
 * Build running-sum stacked/percentStacked plot values for a set of line or
 * area series, one entry per series in `seriesValues` order (series 0 sits at
 * the bottom of the stack, exactly like stacked bar segments). Positive and
 * negative values accumulate on separate running sums, so a chart mixing
 * signs stacks above and below zero independently instead of the values
 * cancelling out.
 */
export function computeStackedSeriesPlots(
	seriesValues: ReadonlyArray<ReadonlyArray<number>>,
	catCount: number,
	percent: boolean,
): StackedSeriesPlot[] {
	const totals = percent ? categoryAbsTotals(seriesValues, catCount) : undefined,
		posRunning = new Array<number>(catCount).fill(0),
		negRunning = new Array<number>(catCount).fill(0);

	return seriesValues.map((values) => {
		const cumulative: number[] = [],
			base: number[] = [],
			own: number[] = [];
		for (let ci = 0; ci < catCount; ci++) {
			const raw = values[ci] ?? 0,
				total = totals?.[ci] ?? 0,
				val = percent ? (total > 0 ? (raw / total) * 100 : 0) : raw,
				isNeg = val < 0,
				from = isNeg ? negRunning[ci] : posRunning[ci],
				to = from + val;
			base.push(from);
			cumulative.push(to);
			own.push(val);
			if (isNeg) {
				negRunning[ci] = to;
			} else {
				posRunning[ci] = to;
			}
		}
		return { cumulative, base, own };
	});
}
