/**
 * Raw-observation binning for the histogram/Pareto ChartEx series: numeric
 * range binning (`cx:layoutPr/cx:binning`) and category aggregation
 * (`cx:layoutPr/cx:aggregation`). Split out of `chart-histogram.ts` (which
 * consumes both to build the bar view-model) to keep each file under the
 * repo's ~300-LOC budget.
 *
 * @module chart-histogram-binning
 */
import type { PptxChartHistogramOptions } from 'pptx-viewer-core';

import { groupRowsByCategory } from './chart-box-whisker-stats';
import { formatAxisValue } from './chart-view-model';

export interface HistogramBin {
	value: number;
	label: string;
	sourceIndices: number[];
}

function binLabel(lower: number, upper: number, closed: 'l' | 'r'): string {
	return closed === 'r'
		? `(${formatAxisValue(lower)}, ${formatAxisValue(upper)}]`
		: `[${formatAxisValue(lower)}, ${formatAxisValue(upper)})`;
}

/** Bin raw observations according to ChartEx binning properties. */
export function computeHistogramBins(
	values: ReadonlyArray<number>,
	options: PptxChartHistogramOptions,
): HistogramBin[] {
	const closed = options.intervalClosed ?? 'l';
	const finite = values
		.map((value, sourceIndex) => ({ value, sourceIndex }))
		.filter((item) => Number.isFinite(item.value));
	if (finite.length === 0) {
		return [];
	}
	const underflow = typeof options.underflow === 'number' ? options.underflow : undefined;
	const overflow = typeof options.overflow === 'number' ? options.overflow : undefined;
	const under =
		underflow === undefined
			? []
			: finite.filter((item) =>
					closed === 'r' ? item.value <= underflow : item.value < underflow,
				);
	const over =
		overflow === undefined
			? []
			: finite.filter((item) => (closed === 'l' ? item.value >= overflow : item.value > overflow));
	const regular = finite.filter((item) => !under.includes(item) && !over.includes(item));
	const result: HistogramBin[] = [];
	if (underflow !== undefined) {
		result.push({
			value: under.length,
			label: `${closed === 'r' ? '≤' : '<'} ${formatAxisValue(underflow)}`,
			sourceIndices: under.map((item) => item.sourceIndex),
		});
	}
	if (regular.length > 0) {
		const min = Math.min(...regular.map((item) => item.value));
		const max = Math.max(...regular.map((item) => item.value));
		const requestedSize = options.binSize && options.binSize > 0 ? options.binSize : undefined;
		const requestedCount = options.binCount && options.binCount > 0 ? options.binCount : undefined;
		const start = requestedSize ? Math.floor(min / requestedSize) * requestedSize : min;
		const count = requestedSize
			? Math.max(
					closed === 'l'
						? Math.floor((max - start) / requestedSize) + 1
						: Math.ceil((max - start) / requestedSize),
					1,
				)
			: Math.max(requestedCount ?? Math.ceil(Math.sqrt(regular.length)), 1);
		const width = requestedSize ?? Math.max((max - start) / count, 1);
		const bins = Array.from({ length: count }, (_, index) => ({
			value: 0,
			label: binLabel(start + index * width, start + (index + 1) * width, closed),
			sourceIndices: [] as number[],
		}));
		for (const item of regular) {
			const rawIndex =
				closed === 'r'
					? Math.ceil((item.value - start) / width) - 1
					: Math.floor((item.value - start) / width);
			const index = Math.max(0, Math.min(rawIndex, bins.length - 1));
			bins[index].value += 1;
			bins[index].sourceIndices.push(item.sourceIndex);
		}
		result.push(...bins);
	}
	if (overflow !== undefined) {
		result.push({
			value: over.length,
			label: `${closed === 'l' ? '≥' : '>'} ${formatAxisValue(overflow)}`,
			sourceIndices: over.map((item) => item.sourceIndex),
		});
	}
	return result;
}

/**
 * Aggregate raw observations by their (repeated) category label instead of by
 * numeric value range: `cx:layoutPr/cx:aggregation` (COM-verified against
 * charts-com.pptx slide 31 / chartEx6.xml) means the source rows are
 * CATEGORICAL, one row per occurrence, with the value column carrying a
 * constant `1` so summing it counts occurrences per category. Summing
 * (rather than literally counting rows) also does the right thing for a
 * dataset that authors a real numeric measure per row instead of a bare `1`.
 */
export function aggregateByCategory(
	values: ReadonlyArray<number>,
	rawCategories: ReadonlyArray<string>,
): HistogramBin[] {
	const { uniqueCategories, rowIndexesByCategory } = groupRowsByCategory(rawCategories);
	return uniqueCategories.map((label) => {
		const rows = rowIndexesByCategory.get(label) ?? [];
		return {
			value: rows.reduce((sum, row) => sum + (values[row] ?? 0), 0),
			label,
			sourceIndices: rows,
		};
	});
}
