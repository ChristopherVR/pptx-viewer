/**
 * Pure detector for the "Pareto" chart shape this SDK models.
 *
 * Pareto has no `PptxChartType` of its own (see `docs/guide/limitations.md`'s
 * ChartEx row): a PowerPoint-authored Pareto chart round-trips as
 * `chartType: 'histogram'` with a `clusteredColumn`-layout frequency series
 * plus a `paretoLine`-layout cumulative-percentage series
 * (`PptxHandlerRuntimeChartDetection` on parse, `chart-cx-generator.ts` on
 * save). Recognising that shape from data alone is needed by more than one
 * consumer:
 *
 * - `pptx-viewer-shared`'s `render/chart-pareto.ts` (the UI-facing
 *   `isParetoChart` / `resolveDisplayedChartType`, re-exported here so it has
 *   one implementation instead of two).
 * - `pptx-viewer-mcp` (`packages/tools`), which reports `chartType` in its
 *   `describeElement` / chart-inspection tool output and must NOT import from
 *   `pptx-viewer-shared` (shared is internal and bundled per binding).
 *
 * Living in `pptx-viewer-core` lets both depend on it without either
 * depending on the other.
 *
 * @module utils/chart-pareto-detect
 */

import type { PptxChartData } from '../types/chart';

/** The narrow slice of `PptxChartData` this detector needs. */
export type ParetoDetectableChartData = Pick<PptxChartData, 'chartType' | 'series'>;

/**
 * True when `data` is the shape this SDK models as "Pareto": `chartType:
 * 'histogram'` with at least one series whose `histogramOptions.layout` is
 * `'pareto'` (the cumulative-percentage line the Pareto conversion appends).
 */
export function isParetoChartData(data: ParetoDetectableChartData): boolean {
	return (
		data.chartType === 'histogram' &&
		data.series.some((series) => series.histogramOptions?.layout === 'pareto')
	);
}

/**
 * The chart type a reader (UI inspector, MCP tool output) should report as
 * "current". `data.chartType` alone reads a Pareto chart back as
 * `'histogram'` because Pareto is a display-only overlay on the histogram
 * shape (see {@link isParetoChartData}); this restores the round trip for
 * display purposes only. It never changes what is stored or serialized, and
 * introduces no `PptxChartType` of `'pareto'`.
 */
export function resolveDisplayedChartTypeName(
	data: ParetoDetectableChartData,
): PptxChartData['chartType'] | 'pareto' {
	return isParetoChartData(data) ? 'pareto' : data.chartType;
}
