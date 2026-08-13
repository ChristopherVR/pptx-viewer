/**
 * Pure serialization helper for per-series combo chart types.
 *
 * When series in a single chart-type container carry different
 * {@link PptxChartSeries.seriesChartType} values, PowerPoint represents the
 * chart as multiple sibling `c:*Chart` containers under `c:plotArea`, each
 * holding the series of one type and sharing the axes. This helper regroups the
 * `<c:ser>` nodes of an existing single container into per-type containers.
 *
 * Each rebuilt container keeps **its own** original non-series children
 * (a line container's `c:marker` / `c:dropLines` / `c:hiLowLines`, a bar
 * container's `c:barDir` / `c:gapWidth` / `c:overlap`), falling back to the
 * consolidated container's children only for a type that was not present in the
 * source. Everything is then filtered and ordered against the target `CT_*`
 * content model, because a `c:barDir` inside `<c:lineChart>` makes PowerPoint
 * reject the whole package.
 *
 * Dependency-light (a `getLocalName` resolver only) so it can be unit-tested
 * directly.
 *
 * @module utils/chart-combo-serializer
 */

import type { PptxChartAxisFormatting, PptxChartSeries, PptxChartType, XmlObject } from '../types';
import {
	chartTypeToContainerLocalName,
	normalizeChartContainerChildren,
	orderChartContainerChildren,
} from './chart-container-schema';

type GetLocalName = (key: string) => string;

type XmlValue = XmlObject[keyof XmlObject];

/** A container's non-series children, keyed by its local name (`barChart`, ...). */
export type ComboContainerChildren = Map<string, ReadonlyArray<readonly [string, XmlValue]>>;

/** Outcome of {@link consolidateComboContainersInXml}. */
export interface ComboConsolidation {
	/** The surviving chart-type container key in `plotArea`. */
	primaryKey: string;
	/**
	 * Non-series children captured per original container, so a later re-split
	 * can restore each container's own settings instead of the first one's.
	 */
	containerChildren: ComboContainerChildren;
}

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function nonSeriesEntries(
	container: XmlObject,
	getLocalName: GetLocalName,
): Array<readonly [string, XmlValue]> {
	return Object.keys(container)
		.filter((k) => getLocalName(k) !== 'ser')
		.map((k) => [k, container[k]] as const);
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
 * the now-empty extra containers. Returns the surviving container key plus each
 * original container's non-series children, or `undefined` when the plot area
 * holds no chart-type container.
 *
 * This is the inverse of {@link applyComboSeriesTypesToXml}: a combo chart loads
 * as multiple containers whose series flatten into a single index-aligned model
 * list, so on save we first consolidate back to one container, let the generic
 * per-series update run over the full list, then re-split by `seriesChartType`.
 *
 * Mutates `plotArea` in place. Every container's non-series children are
 * captured (not just the first one's) so the split can restore each container's
 * own `c:marker` / `c:dropLines` / `c:gapWidth` / axis pair.
 */
export function consolidateComboContainersInXml(
	plotArea: XmlObject,
	getLocalName: GetLocalName,
): ComboConsolidation | undefined {
	const containerKeys = Object.keys(plotArea).filter((k) => getLocalName(k).endsWith('Chart'));
	if (containerKeys.length === 0) {
		return undefined;
	}
	const primaryKey = containerKeys[0];
	const containerChildren: ComboContainerChildren = new Map();
	for (const key of containerKeys) {
		const container = plotArea[key] as XmlObject | undefined;
		if (container) {
			containerChildren.set(getLocalName(key), nonSeriesEntries(container, getLocalName));
		}
	}
	if (containerKeys.length === 1) {
		return { primaryKey, containerChildren };
	}

	const primary = plotArea[primaryKey] as XmlObject | undefined;
	if (!primary) {
		return { primaryKey, containerChildren };
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
	return { primaryKey, containerChildren };
}

/**
 * Determine the effective per-series container local name for each series.
 * Falls back to `chartLevelType` when a series has no explicit type.
 *
 * Returns `undefined` for a series whose type has no classic `c:*Chart`
 * representation (a chartex kind, `combo`, `unknown`). Callers must bail rather
 * than guess: silently defaulting to `barChart` turned a stock series into a bar
 * series without a word.
 */
function effectiveContainers(
	series: PptxChartSeries[],
	chartLevelType: PptxChartType,
): Array<string | undefined> {
	return series.map((s) => chartTypeToContainerLocalName(s.seriesChartType ?? chartLevelType));
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
 * @param getLocalName Namespace-prefix stripper.
 * @param axes Parsed axis formatting, used to re-point each group's `c:axId` pair.
 * @param originalChildren Per-container non-series children captured by
 *   {@link consolidateComboContainersInXml}. Without it every container falls
 *   back to the consolidated container's children, which is how a line group
 *   used to inherit `c:barDir` and lose its own `c:marker`.
 * @returns Whether a combo split was performed.
 */
export function applyComboSeriesTypesToXml(
	plotArea: XmlObject,
	originalKey: string,
	series: PptxChartSeries[],
	chartLevelType: PptxChartType,
	getLocalName: GetLocalName,
	axes?: PptxChartAxisFormatting[],
	originalChildren?: ComboContainerChildren,
): boolean {
	const containers = effectiveContainers(series, chartLevelType);
	if (containers.some((local) => local === undefined)) {
		// At least one series has no classic c:*Chart representation. Splitting
		// would have to invent a container type; leave the consolidated (still
		// schema-valid) single container alone instead.
		return false;
	}
	const resolved = containers as string[];
	const distinct = new Set(resolved);
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

	// Children of the consolidated container that are NOT series. Used only for a
	// group whose container type had no counterpart in the source XML.
	const fallbackEntries = nonSeriesEntries(original, getLocalName);

	// Group series-node indices by their target container local name, preserving order.
	const groups = new Map<string, XmlObject[]>();
	const groupOrder: string[] = [];
	for (let i = 0; i < serNodes.length; i++) {
		const local = resolved[i];
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
		for (const [k, v] of originalChildren?.get(local) ?? fallbackEntries) {
			// Deep-clone so containers never alias the same node.
			container[k] = JSON.parse(JSON.stringify(v)) as XmlValue;
		}
		const grouped = groups.get(local)!;
		container[serKey] = grouped.length === 1 ? grouped[0] : grouped;
		applyGroupAxisReferences(
			container,
			series.filter((_item, index) => resolved[index] === local),
			axes,
			getLocalName,
		);
		// Drop children this container type does not permit (a cloned `c:barDir`
		// inside `<c:lineChart>` is fatal), add any required child, then emit in
		// the CT_* sequence order.
		normalizeChartContainerChildren(container, local, getLocalName);
		orderChartContainerChildren(container, local, getLocalName);
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
