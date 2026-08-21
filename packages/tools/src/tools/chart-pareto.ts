import type { ChartPptxElement } from 'pptx-viewer-core';

/**
 * Compute the running cumulative-percentage-of-total for a list of values, in
 * the order given (no reordering). Rounded to 2 decimal places, matching how
 * PowerPoint labels a Pareto chart's cumulative line.
 */
function cumulativePercent(values: number[]): number[] {
	const total = values.reduce((sum, value) => sum + value, 0);
	if (total === 0) {
		return values.map(() => 0);
	}
	let running = 0;
	return values.map((value) => {
		running += value;
		return Math.round((running / total) * 10000) / 100;
	});
}

/**
 * Translate an MCP/AI request for `chartType: "pareto"` into this SDK's
 * actual chart model.
 *
 * "Pareto" is not a distinct `PptxChartType` here: a PowerPoint-authored
 * Pareto chart is modeled (both on parse and on save) as
 * `chartType: 'histogram'` with one `clusteredColumn`-layout series (the bin
 * frequencies) and one `paretoLine`-layout series (the cumulative
 * percentage) -- see `PptxHandlerRuntimeChartDetection` and
 * `chart-cx-generator.ts`. `createChart`/`updateChart` accept a free-form
 * `chartType` string for MCP/LLM ergonomics, so a literal `"pareto"` request
 * would otherwise silently fall back to a plain bar chart: `canGenerateChartEx`
 * does not recognise the string `"pareto"`, and the classic (non-ChartEx)
 * writer has no container for it either.
 *
 * Mutates `chart.chartData` in place: sets the chart type to `'histogram'`,
 * marks the first series as the frequency bars, and appends a computed
 * cumulative-percentage series (unless one is already present) so the result
 * round-trips as a real ChartEx Pareto chart. No-ops for any other
 * `requestedType`.
 */
export function applyParetoChartTypeAlias(chart: ChartPptxElement, requestedType: string): void {
	if (requestedType.trim().toLowerCase() !== 'pareto' || !chart.chartData) {
		return;
	}
	const data = chart.chartData;
	data.chartType = 'histogram';
	const [frequency] = data.series;
	if (!frequency) {
		return;
	}
	frequency.histogramOptions = { ...frequency.histogramOptions, layout: 'histogram' };
	const hasParetoLine = data.series.some((s) => s.histogramOptions?.layout === 'pareto');
	if (!hasParetoLine) {
		data.series.push({
			name: 'Cumulative %',
			values: cumulativePercent(frequency.values),
			histogramOptions: { layout: 'pareto' },
		});
	}
}
