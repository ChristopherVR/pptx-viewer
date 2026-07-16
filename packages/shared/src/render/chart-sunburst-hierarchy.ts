import type { PptxChartData } from 'pptx-viewer-core';

import { paletteColor } from './chart-view-model';

/** One sunburst ring arc segment. */
export interface SunburstArc {
	/** SVG path `d` of the arc (donut wedge). */
	d: string;
	/** Fill colour. */
	fill: string;
	/** Opacity (outer rings fade), clamped to at least 0.1. */
	opacity: number;
	/** Source leaf point for interactive outer-ring arcs. */
	pointIndex?: number;
	/** Zero-based rendered ring index, where zero is innermost. */
	level?: number;
	/** Category label represented by this arc when hierarchy data is available. */
	label?: string;
}

function arcPath(
	cx: number,
	cy: number,
	innerRadius: number,
	outerRadius: number,
	startAngle: number,
	endAngle: number,
): string {
	const sweep = endAngle - startAngle;
	const largeArc = sweep > Math.PI ? 1 : 0;
	const x1 = cx + outerRadius * Math.cos(startAngle);
	const y1 = cy + outerRadius * Math.sin(startAngle);
	const x2 = cx + outerRadius * Math.cos(endAngle);
	const y2 = cy + outerRadius * Math.sin(endAngle);
	const x3 = cx + innerRadius * Math.cos(endAngle);
	const y3 = cy + innerRadius * Math.sin(endAngle);
	const x4 = cx + innerRadius * Math.cos(startAngle);
	const y4 = cy + innerRadius * Math.sin(startAngle);
	return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

/** Compute the legacy one-ring-per-series sunburst geometry. */
export function computeSunburstArcs(
	series: PptxChartData['series'],
	cx: number,
	cy: number,
	maxR: number,
	colorPalette: readonly string[] | undefined,
): SunburstArc[] {
	const seriesCount = Math.max(series.length, 1);
	const ringWidth = maxR / (seriesCount + 0.5);
	const out: SunburstArc[] = [];

	for (let si = 0; si < series.length; si++) {
		const values = series[si].values;
		const innerRadius = ringWidth * (si + 0.5);
		const outerRadius = ringWidth * (si + 1.5);
		const total = values.reduce((acc, value) => acc + Math.abs(value), 0) || 1;
		let startAngle = -Math.PI / 2;
		for (let pointIndex = 0; pointIndex < values.length; pointIndex++) {
			const endAngle = startAngle + (Math.abs(values[pointIndex]) / total) * Math.PI * 2;
			out.push({
				d: arcPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle),
				fill: paletteColor(pointIndex, colorPalette),
				opacity: Math.max(0.1, 0.9 - si * 0.1),
				pointIndex,
				level: si,
			});
			startAngle = endAngle;
		}
	}
	return out;
}

function hierarchyKey(levels: ReadonlyArray<ReadonlyArray<string>>, level: number, index: number) {
	return levels
		.slice(level)
		.map((labels) => labels[index] ?? '')
		.join('\u0000');
}

/**
 * Compute one aligned ring per ChartEx category level. Levels are stored leaf
 * first, so the highest parent level becomes the innermost ring. Parent wedges
 * aggregate the values of their contiguous descendant leaves.
 */
export function computeHierarchicalSunburstArcs(
	categoryLevels: ReadonlyArray<ReadonlyArray<string>>,
	values: ReadonlyArray<number>,
	cx: number,
	cy: number,
	maxR: number,
	colorPalette: readonly string[] | undefined,
): SunburstArc[] {
	const levels = categoryLevels.filter((level) => level.length > 0);
	const leafCount = Math.max(values.length, ...levels.map((level) => level.length), 0);
	if (levels.length === 0 || leafCount === 0) {
		return [];
	}
	const rawWeights = Array.from({ length: leafCount }, (_, index) => Math.abs(values[index] ?? 0));
	const weights = rawWeights.some((value) => value !== 0) ? rawWeights : rawWeights.map(() => 1);
	const total = weights.reduce((sum, value) => sum + value, 0);
	const prefix = [0];
	for (const weight of weights) {
		prefix.push((prefix[prefix.length - 1] ?? 0) + weight);
	}

	const ringWidth = maxR / (levels.length + 0.5);
	const rootLabels = levels[levels.length - 1] ?? [];
	const rootColors = new Map<string, number>();
	const out: SunburstArc[] = [];
	for (let level = levels.length - 1; level >= 0; level--) {
		const ringIndex = levels.length - 1 - level;
		const innerRadius = ringWidth * (ringIndex + 0.5);
		const outerRadius = ringWidth * (ringIndex + 1.5);
		let start = 0;
		while (start < leafCount) {
			const key = hierarchyKey(levels, level, start);
			let end = start + 1;
			while (end < leafCount && hierarchyKey(levels, level, end) === key) {
				end++;
			}
			const startAngle = -Math.PI / 2 + (prefix[start] / total) * Math.PI * 2;
			const endAngle = -Math.PI / 2 + (prefix[end] / total) * Math.PI * 2;
			const rootLabel = rootLabels[start] ?? '';
			if (!rootColors.has(rootLabel)) {
				rootColors.set(rootLabel, rootColors.size);
			}
			out.push({
				d: arcPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle),
				fill: paletteColor(rootColors.get(rootLabel) ?? start, colorPalette),
				opacity: Math.max(0.1, 0.9 - ringIndex * 0.1),
				level: ringIndex,
				label: levels[level][start] ?? '',
				...(level === 0 && end === start + 1 ? { pointIndex: start } : {}),
			});
			start = end;
		}
	}
	return out;
}
