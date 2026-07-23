/**
 * Blank-value display resolution for `c:dispBlanksAs`.
 *
 * A chart series carries an optional `blanks` mask (from core) marking category
 * slots whose numeric cache point was absent. This module turns that mask into
 * per-point render instructions per the chart's `c:dispBlanksAs` mode:
 *
 * - `gap`  - the blank point is omitted and the line breaks around it.
 * - `zero` - the blank point plots as `0` (its placeholder value).
 * - `span` - the blank is linearly interpolated from its nearest real neighbours.
 *
 * When the mode is unset the output preserves existing behaviour exactly (all
 * points visible, placeholder `0` values), so charts without an explicit
 * `c:dispBlanksAs` render unchanged.
 *
 * @module chart-blank-display
 */

/** Values of `c:dispBlanksAs`. */
export type DispBlanksAs = 'gap' | 'zero' | 'span';

/** Per-point render instructions after applying a blank mode. */
export interface BlankDisplay {
	/** Effective values (interpolated for `span`; `0` placeholder otherwise). */
	values: number[];
	/** Whether each point is drawn. `false` only for blanks under `gap`. */
	visible: boolean[];
}

/** Linearly interpolate blank slots between their nearest real neighbours. */
function interpolate(values: ReadonlyArray<number>, blank: ReadonlyArray<boolean>): number[] {
	const out = [...values];
	for (let i = 0; i < out.length; i++) {
		if (!blank[i]) {
			continue;
		}
		let prev = i - 1;
		while (prev >= 0 && blank[prev]) {
			prev--;
		}
		let next = i + 1;
		while (next < out.length && blank[next]) {
			next++;
		}
		const hasPrev = prev >= 0;
		const hasNext = next < out.length;
		if (hasPrev && hasNext) {
			const t = (i - prev) / (next - prev);
			out[i] = values[prev] + (values[next] - values[prev]) * t;
		} else if (hasPrev) {
			out[i] = values[prev];
		} else if (hasNext) {
			out[i] = values[next];
		}
	}
	return out;
}

/**
 * Resolve display values + visibility for a series given its blank mask and mode.
 *
 * @param values - Effective values aligned to display order (blanks carry `0`).
 * @param blanks - Blank mask aligned index-for-index with `values`.
 * @param mode - `c:dispBlanksAs` mode; `undefined` preserves existing behaviour.
 */
export function resolveBlankDisplay(
	values: ReadonlyArray<number>,
	blanks: ReadonlyArray<boolean> | undefined,
	mode: DispBlanksAs | undefined,
): BlankDisplay {
	const visible = values.map(() => true);
	if (!blanks || !blanks.some(Boolean) || mode === undefined || mode === 'zero') {
		return { values: [...values], visible };
	}
	if (mode === 'span') {
		return { values: interpolate(values, blanks), visible };
	}
	// mode === 'gap': hide blank points so the line breaks around them.
	return {
		values: [...values],
		visible: values.map((_v, i) => !blanks[i]),
	};
}

/** Contiguous runs of visible indices, used to break a line at gaps. */
export function visibleRuns(visible: ReadonlyArray<boolean>): number[][] {
	const runs: number[][] = [];
	let current: number[] = [];
	for (let i = 0; i < visible.length; i++) {
		if (visible[i]) {
			current.push(i);
		} else if (current.length > 0) {
			runs.push(current);
			current = [];
		}
	}
	if (current.length > 0) {
		runs.push(current);
	}
	return runs;
}
