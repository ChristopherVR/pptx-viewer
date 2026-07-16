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
