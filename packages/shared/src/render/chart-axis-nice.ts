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
 * How close the smaller end of the data has to be to the larger before the axis
 * stops anchoring at zero. Below 5/6, zero anchoring keeps the bars readable;
 * above it, the data is a narrow band and zero would squash it flat.
 */
const ZERO_ANCHOR_RATIO = 5 / 6;

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
 *   a round unit means the result is usually one fewer. Four matches the axes
 *   PowerPoint draws for a chart of ordinary height.
 */
export function niceValueAxisBounds(
	dataMin: number,
	dataMax: number,
	targetIntervals = 4,
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
