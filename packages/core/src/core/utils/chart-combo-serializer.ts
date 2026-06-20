/**
 * Pure serialization helper for per-series combo chart types.
 *
 * When series in a single chart-type container carry different
 * {@link PptxChartSeries.seriesChartType} values, PowerPoint represents the
 * chart as multiple sibling `c:*Chart` containers under `c:plotArea`, each
 * holding the series of one type and sharing the axes. This helper regroups the
 * `<c:ser>` nodes of an existing single container into per-type containers,
 * cloning the original container's non-series children (grouping, axId, etc.)
 * into each so the result stays schema-valid.
 *
 * Dependency-light (a `getLocalName` resolver only) so it can be unit-tested
 * directly.
 *
 * @module utils/chart-combo-serializer
 */

import type { PptxChartSeries, PptxChartType, XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** Map a model chart type to its OOXML chart-type container local name. */
const TYPE_TO_CONTAINER: Partial<Record<PptxChartType, string>> = {
	bar: 'barChart',
	line: 'lineChart',
	area: 'areaChart',
	pie: 'pieChart',
	doughnut: 'doughnutChart',
	scatter: 'scatterChart',
	bubble: 'bubbleChart',
	radar: 'radarChart',
};

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
	if (v === undefined) {
		return [];
	}
	return Array.isArray(v) ? v : [v];
}

/**
 * Determine the effective per-series container local name for each series.
 * Falls back to `chartLevelType` when a series has no explicit type.
 */
function effectiveContainers(series: PptxChartSeries[], chartLevelType: PptxChartType): string[] {
	return series.map((s) => {
		const t = s.seriesChartType ?? chartLevelType;
		return TYPE_TO_CONTAINER[t] ?? TYPE_TO_CONTAINER.bar ?? 'barChart';
	});
}

/**
 * Regroup the series of `originalContainer` (found in `plotArea`) into multiple
 * per-type chart-type containers when the series carry differing
 * `seriesChartType` values. No-ops (returns `false`) when every series resolves
 * to the same container type. Mutates `plotArea` in place.
 *
 * @param plotArea The `c:plotArea` node.
 * @param originalKey The existing chart-type container key in `plotArea`.
 * @param series The modeled series, index-aligned with the container's `<c:ser>`.
 * @param chartLevelType The chart-level type used for series with no explicit type.
 * @returns Whether a combo split was performed.
 */
export function applyComboSeriesTypesToXml(
	plotArea: XmlObject,
	originalKey: string,
	series: PptxChartSeries[],
	chartLevelType: PptxChartType,
	getLocalName: GetLocalName,
): boolean {
	const containers = effectiveContainers(series, chartLevelType);
	const distinct = new Set(containers);
	if (distinct.size <= 1) {
		return false;
	}

	const original = plotArea[originalKey] as XmlObject | undefined;
	if (!original) {
		return false;
	}

	const serKey = findKey(original, 'ser', getLocalName) ?? 'c:ser';
	const serNodes = ensureArray(original[serKey]) as XmlObject[];
	if (serNodes.length !== series.length) {
		// Series counts diverged from the XML; leave combo handling to a full save.
		return false;
	}

	// Children of the original container that are NOT series; cloned per group.
	type XmlValue = XmlObject[keyof XmlObject];
	const sharedEntries = Object.keys(original)
		.filter((k) => getLocalName(k) !== 'ser')
		.map((k) => [k, original[k]] as const);

	// Group series-node indices by their target container local name, preserving order.
	const groups = new Map<string, XmlObject[]>();
	const groupOrder: string[] = [];
	for (let i = 0; i < serNodes.length; i++) {
		const local = containers[i];
		if (!groups.has(local)) {
			groups.set(local, []);
			groupOrder.push(local);
		}
		groups.get(local)!.push(serNodes[i]);
	}

	// Remove the original container, then re-insert one container per group in
	// the original position (preserving the rest of plotArea, e.g. axes).
	const keys = Object.keys(plotArea);
	const entries = keys.map((k) => [k, plotArea[k]] as const);
	const at = keys.indexOf(originalKey);
	const newEntries: Array<readonly [string, XmlValue]> = [];
	for (const local of groupOrder) {
		const container: XmlObject = {};
		for (const [k, v] of sharedEntries) {
			// Deep-clone shared children so containers do not alias the same node.
			container[k] = JSON.parse(JSON.stringify(v)) as XmlValue;
		}
		const grouped = groups.get(local)!;
		container['c:ser'] = grouped.length === 1 ? grouped[0] : grouped;
		newEntries.push([`c:${local}`, container] as const);
	}
	entries.splice(at, 1, ...newEntries);

	for (const k of keys) {
		delete plotArea[k];
	}
	for (const [k, v] of entries) {
		plotArea[k] = v;
	}
	return true;
}
