/**
 * Row indexes sharing each unique category label, in first-appearance order.
 *
 * A `cx:boxWhisker` chart's raw data repeats its category label once per
 * underlying observation (COM-verified against `charts-com.pptx` slide 32 /
 * `chartEx7.xml`: `Category 1` appears on 9 consecutive rows, `Category 2` on
 * 7, `Category 3` on 6), because every row IS one observation, not one
 * category. A box's quartiles must be computed from the observations that
 * share its category label, not from one value per row.
 */
export interface CategoryRowGroups {
	/** Unique category labels, in first-appearance (authoring) order. */
	uniqueCategories: string[];
	/** Every raw row index whose category label equals the map key. */
	rowIndexesByCategory: ReadonlyMap<string, number[]>;
}

/** Group raw (possibly repeated) category labels by unique text. */
export function groupRowsByCategory(rawCategories: ReadonlyArray<string>): CategoryRowGroups {
	const uniqueCategories: string[] = [];
	const rowIndexesByCategory = new Map<string, number[]>();
	rawCategories.forEach((rawLabel, rowIndex) => {
		const label = rawLabel ?? '';
		let rows = rowIndexesByCategory.get(label);
		if (!rows) {
			rows = [];
			rowIndexesByCategory.set(label, rows);
			uniqueCategories.push(label);
		}
		rows.push(rowIndex);
	});
	return { uniqueCategories, rowIndexesByCategory };
}

export interface BoxStats {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
}

function percentile(
	sorted: ReadonlyArray<number>,
	p: number,
	method: 'inclusive' | 'exclusive',
): number {
	const rank = method === 'inclusive' ? (sorted.length - 1) * p : (sorted.length + 1) * p - 1;
	const clamped = Math.max(0, Math.min(rank, sorted.length - 1));
	const lower = Math.floor(clamped);
	const upper = Math.ceil(clamped);
	const fraction = clamped - lower;
	return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

/** Compute quartiles, preserving the legacy floor-index result when method is absent. */
export function computeBoxStats(
	values: ReadonlyArray<number>,
	method?: 'inclusive' | 'exclusive',
): BoxStats | undefined {
	if (values.length < 2) {
		return undefined;
	}
	const sorted = [...values].sort((a, b) => a - b);
	if (!method) {
		return {
			min: sorted[0],
			q1: sorted[Math.floor(sorted.length * 0.25)],
			median: sorted[Math.floor(sorted.length * 0.5)],
			q3: sorted[Math.floor(sorted.length * 0.75)],
			max: sorted[sorted.length - 1],
		};
	}
	return {
		min: sorted[0],
		q1: percentile(sorted, 0.25, method),
		median: percentile(sorted, 0.5, method),
		q3: percentile(sorted, 0.75, method),
		max: sorted[sorted.length - 1],
	};
}
