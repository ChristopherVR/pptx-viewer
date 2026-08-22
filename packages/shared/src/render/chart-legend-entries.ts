/**
 * chart-legend-entries.ts - applies `c:legendEntry` overrides (deletion + a
 * per-entry `c:txPr` text-style) onto an already-built legend list.
 *
 * Every chart kind builds its own base `LegendEntry[]` (series order for most
 * kinds, category/slice order for pie / doughnut / ofPie), then
 * `buildChartViewModel` runs the result through {@link applyLegendEntryOverrides}
 * exactly once before returning. `c:legendEntry/@idx` indexes into that base
 * list in the same order it was built, matching how PowerPoint itself assigns
 * legend-entry indices. A deleted entry is dropped outright (not merely
 * hidden), so the remaining entries re-flow to fill the gap the way
 * PowerPoint's own legend does. Consuming it at this single choke point means
 * every chart kind, and all five bindings (which only ever read the finished
 * `ChartViewModel.legend`), honour `c:legendEntry` identically without any
 * per-kind or per-binding code.
 *
 * @module chart-legend-entries
 */
import type { PptxChartLegendEntry } from 'pptx-viewer-core';

import type { LegendEntry } from './chart-view-model';

/**
 * Filter deleted entries and attach per-entry text-style overrides.
 * Returns the input array unchanged (same reference) when there is nothing to
 * apply, so callers with no `c:legendEntry` overrides pay no extra cost.
 */
export function applyLegendEntryOverrides(
	legend: readonly LegendEntry[],
	entries: readonly PptxChartLegendEntry[] | undefined,
): LegendEntry[] {
	if (!entries || entries.length === 0) {
		return legend as LegendEntry[];
	}
	const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
	const result: LegendEntry[] = [];
	legend.forEach((item, index) => {
		const override = byIndex.get(index);
		if (override?.deleted) {
			return;
		}
		result.push(override?.textStyle ? { ...item, textStyle: override.textStyle } : item);
	});
	return result;
}
