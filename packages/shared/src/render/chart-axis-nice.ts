/**
 * PowerPoint's automatic value-axis scale.
 *
 * A chart that declares no `c:min` / `c:max` / `c:majorUnit` leaves the bounds
 * to the application, and PowerPoint does NOT simply run the axis to the largest
 * data point. It anchors the axis at zero, pads the data, then rounds out to a
 * round number and labels it in round steps. The reporter's deck (issue #132)
 * shows the difference plainly: a percentage chart whose bars top out at 52%
 * gets `0% 20% 40% 60%` from PowerPoint and got `0% 10% 21% 31% 42% 52%` here,
 * because the axis ran to the data maximum and was then divided into five.
 *
 * The rules, from Microsoft's documented automatic-scaling behaviour:
 *
 *  - **Zero anchor.** With all-positive data, the axis starts at zero unless the
 *    smallest value is at least 5/6 of the largest, in which case the data
 *    occupies a narrow band high up and a zero-anchored axis would flatten it.
 *    All-negative data mirrors this, ending at zero.
 *  - **Headroom.** The far end is pushed out by 5% of the data span so the
 *    tallest bar does not touch the top of the plot.
 *  - **Round steps.** The major unit is the first "nice" number (1, 2, 2.5 or 5
 *    times a power of ten) at or above `span / targetIntervals`, and the bounds
 *    are then snapped outwards to whole multiples of it.
 *
 * The snap is what makes the interval count differ from `targetIntervals`:
 * rounding 0.544 up to a multiple of 0.2 lands on 0.6, which is three steps, not
 * four. That is the intent, and it is why PowerPoint's axes read in round
 * numbers while an evenly-divided one does not.
 */

/** A resolved automatic axis scale. */
export interface NiceAxisBounds {
	min: number;
	max: number;
	/** Step between major gridlines; `max - min` is always a whole multiple. */
	majorUnit: number;
}

/**
 * Steps PowerPoint rounds a major unit to, as mantissas of a power of ten.
 * Anything between two entries rounds UP to the larger, so a unit is never so
 * fine that the axis grows more gridlines than asked for.
 */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** The fraction of the data span added as headroom beyond the last data point. */
const HEADROOM = 0.05;

/**
 * Plot-area points of vertical room PowerPoint reserves per gridline before it
 * asks for another one, and the ceiling/floor on how many it will ever ask
 * for. See {@link axisTargetIntervals}'s doc comment for the PowerPoint COM
 * measurements these were fit to.
 */
const POINTS_PER_GRIDLINE = 20;
const MIN_TARGET_INTERVALS = 1;
const MAX_TARGET_INTERVALS = 10;

/**
 * Pixels per point in the "px" unit `computePlotLayout` (and every renderer in
 * this engine) works in: 96 px per inch, 72 points per inch, so 4/3 px per pt.
 * Mirrors `EMU_PER_PIXEL` (core/constants.ts): `EMU_PER_POINT / EMU_PER_PIXEL`
 * reduces to the same 4/3.
 */
const PX_PER_POINT = 4 / 3;

/** {@link niceValueAxisBounds}'s `targetIntervals` when no plot height is known. */
const DEFAULT_TARGET_INTERVALS = 4;

/**
 * How close the smaller end of the data has to be to the larger before the axis
 * stops anchoring at zero. Below 5/6, zero anchoring keeps the bars readable;
 * above it, the data is a narrow band and zero would squash it flat.
 */
const ZERO_ANCHOR_RATIO = 5 / 6;

/**
 * How many gridline intervals PowerPoint's automatic value-axis scale aims
 * for, given the chart's plot-area height in the "px" unit `computePlotLayout`
 * returns (96 px/inch; see `PX_PER_POINT` above).
 *
 * This is NOT a universal constant (see this module's original doc comment,
 * which admitted as much: "matches the axes PowerPoint draws for a chart of
 * ORDINARY height"): a short chart gets fewer, coarser gridlines than a tall
 * one, up to a point, because PowerPoint only has room to label so many
 * without the axis text crowding.
 *
 * Measured via PowerPoint COM automation (`New-Object -ComObject
 * PowerPoint.Application`, `Shapes.AddChart2`, reading back
 * `chart.Axes(2).MinimumScale/.MaximumScale/.MajorUnit`): building a fresh
 * clustered-column chart at increasing shape heights with the SAME 8-point,
 * single-category data (values 1.2-3.2, the exact case reported against this
 * engine, which this engine rendered 0-4 while PowerPoint drew 0-3.5):
 *
 * | chart height | plot height | PowerPoint axis  | gridlines |
 * |--------------|-------------|------------------|-----------|
 * | 100pt        | ~33pt       | 0 to 5, unit 5   | 1         |
 * | 150pt        | ~83pt       | 0 to 4, unit 1   | 4         |
 * | 200pt        | ~133pt      | 0 to 3.5, unit 0.5 | 7       |
 * | 300pt        | ~233pt      | 0 to 3.5, unit 0.5 | 7       |
 * | 1000pt       | ~933pt      | 0 to 3.5, unit 0.5 | 7 (unchanged) |
 *
 * Cross-checked against two more datasets (0-52 and 0-9) at the same set of
 * heights to separate "the target interval count" from "which nice-number
 * bucket a particular span happens to round into": PowerPoint never asked for
 * more than about 10 intervals even at a 1000pt-tall chart, it only asks for
 * FEWER on a plot area too short to fit that many labels. That saturation
 * (not a straight line) is why this is clamped at the top, not just scaled.
 *
 * Modelled as one gridline interval per ~20pt of plot height (roughly one
 * axis-label line plus padding), clamped to `[1, 10]`. This will not be exact
 * for every data range: the actual PowerPoint algorithm also nudges the count
 * by how the span happens to snap to a nice number (see the module doc
 * comment), which this simplified model does not attempt to reproduce. It is
 * a large improvement over hard-coding the short-chart answer (4) for every
 * chart regardless of size, which is the bug this was added to fix.
 */
export function axisTargetIntervals(plotHeightPx: number): number {
	if (!Number.isFinite(plotHeightPx) || plotHeightPx <= 0) {
		return DEFAULT_TARGET_INTERVALS;
	}
	const plotHeightPt = plotHeightPx / PX_PER_POINT;
	const raw = Math.round(plotHeightPt / POINTS_PER_GRIDLINE);
	return Math.min(MAX_TARGET_INTERVALS, Math.max(MIN_TARGET_INTERVALS, raw));
}

/** The smallest nice step at or above `value`. */
export function niceAxisStep(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return 1;
	}
	const exponent = Math.floor(Math.log10(value));
	const power = 10 ** exponent;
	const mantissa = value / power;
	const step = NICE_STEPS.find((candidate) => mantissa <= candidate + 1e-12) ?? 10;
	return step * power;
}

/** Round `value` outwards (away from zero-ward `toward`) to a multiple of `unit`. */
function snap(value: number, unit: number, direction: 'up' | 'down'): number {
	const scaled = value / unit;
	// Guard against float noise turning an exact multiple into the next one out.
	const rounded = direction === 'up' ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
	return rounded * unit;
}

/**
 * Resolve the automatic bounds and major unit for a value axis.
 *
 * @param dataMin Smallest plotted value.
 * @param dataMax Largest plotted value.
 * @param targetIntervals Roughly how many gridline steps to aim for. The snap to
 *   a round unit means the result is usually one fewer. Defaults to 4 only
 *   when the caller has no idea how tall the chart's plot area is; pass
 *   {@link axisTargetIntervals}`(plotHeightPx)` instead whenever that height is
 *   known; see that function's doc comment for why a fixed constant undershot
 *   real PowerPoint on any chart of ordinary-or-larger size.
 */
export function niceValueAxisBounds(
	dataMin: number,
	dataMax: number,
	targetIntervals = DEFAULT_TARGET_INTERVALS,
): NiceAxisBounds {
	if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
		return { min: 0, max: 1, majorUnit: 0.5 };
	}
	const low = Math.min(dataMin, dataMax);
	const high = Math.max(dataMin, dataMax);
	const intervals = Math.max(1, Math.round(targetIntervals));

	// Flat data (every point identical) has no span to scale. Zero-anchor it
	// where that reads sensibly, and otherwise bracket the single value.
	if (low === high) {
		if (low === 0) {
			return { min: 0, max: 1, majorUnit: 1 / intervals };
		}
		const unit = niceAxisStep(Math.abs(low) / intervals);
		return low > 0
			? { min: 0, max: snap(low, unit, 'up') || unit, majorUnit: unit }
			: { min: snap(low, unit, 'down'), max: 0, majorUnit: unit };
	}

	const dataSpan = high - low;
	const padding = dataSpan * HEADROOM;

	// Decide which end, if either, pins to zero.
	let paddedMin: number;
	let paddedMax: number;
	if (low >= 0) {
		paddedMin = low < high * ZERO_ANCHOR_RATIO ? 0 : low - padding;
		paddedMax = high + padding;
	} else if (high <= 0) {
		paddedMax = high > low * ZERO_ANCHOR_RATIO ? 0 : high + padding;
		paddedMin = low - padding;
	} else {
		// Straddles zero: both ends are data-driven, and zero falls inside.
		paddedMin = low - padding;
		paddedMax = high + padding;
	}

	const unit = niceAxisStep((paddedMax - paddedMin) / intervals);
	const min = paddedMin === 0 ? 0 : snap(paddedMin, unit, 'down');
	let max = paddedMax === 0 ? 0 : snap(paddedMax, unit, 'up');
	if (max <= min) {
		max = min + unit;
	}
	return { min, max, majorUnit: unit };
}
