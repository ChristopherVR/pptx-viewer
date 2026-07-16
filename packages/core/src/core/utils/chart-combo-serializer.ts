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

import type { PptxChartAxisFormatting, PptxChartSeries, PptxChartType, XmlObject } from '../types';

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
 * Collapse every `c:*Chart` sibling container in a combo plot area into the
 * first one, concatenating their `c:ser` nodes (in document order) and removing
 * the now-empty extra containers. Returns the surviving container key, or
 * `undefined` when the plot area holds no chart-type container.
 *
 * This is the inverse of {@link applyComboSeriesTypesToXml}: a combo chart loads
 * as multiple containers whose series flatten into a single index-aligned model
 * list, so on save we first consolidate back to one container, let the generic
 * per-series update run over the full list, then re-split by `seriesChartType`.
 *
 * Mutates `plotArea` in place. The first container's non-series children
 * (grouping, axId, etc.) are kept as the shared template for the later split.
 */
export function consolidateComboContainersInXml(
	plotArea: XmlObject,
	getLocalName: GetLocalName,
): string | undefined {
	const containerKeys = Object.keys(plotArea).filter((k) => getLocalName(k).endsWith('Chart'));
	if (containerKeys.length === 0) {
		return undefined;
	}
	const primaryKey = containerKeys[0];
	if (containerKeys.length === 1) {
		return primaryKey;
	}

	const primary = plotArea[primaryKey] as XmlObject | undefined;
	if (!primary) {
		return primaryKey;
	}
	const serKey = findKey(primary, 'ser', getLocalName) ?? 'c:ser';

	const allSeries: XmlObject[] = [];
	for (const key of containerKeys) {
		const container = plotArea[key] as XmlObject | undefined;
		if (!container) {
			continue;
		}
		const containerSerKey = findKey(container, 'ser', getLocalName);
		if (containerSerKey) {
			allSeries.push(...(ensureArray(container[containerSerKey]) as XmlObject[]));
		}
		if (key !== primaryKey) {
			delete plotArea[key];
		}
	}

	primary[serKey] = allSeries.length === 1 ? allSeries[0] : allSeries;
	return primaryKey;
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
	axes?: PptxChartAxisFormatting[],
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
		applyGroupAxisReferences(
			container,
			series.filter((_item, index) => containers[index] === local),
			axes,
			getLocalName,
		);
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

function applyGroupAxisReferences(
	container: XmlObject,
	series: PptxChartSeries[],
	axes: PptxChartAxisFormatting[] | undefined,
	getLocalName: GetLocalName,
): void {
	const axisIds = new Set(series.map((item) => item.axisId).filter((id) => id !== undefined));
	if (axisIds.size !== 1) {
		return;
	}
	const valueAxisId = [...axisIds][0];
	const valueAxis = axes?.find((axis) => axis.axisId === valueAxisId);
	const categoryAxisId =
		valueAxis?.crossAxisId ?? axes?.find((axis) => axis.crossAxisId === valueAxisId)?.axisId;
	if (valueAxisId === undefined || categoryAxisId === undefined) {
		return;
	}
	const key = findKey(container, 'axId', getLocalName) ?? 'c:axId';
	container[key] = [{ '@_val': String(categoryAxisId) }, { '@_val': String(valueAxisId) }];
}
