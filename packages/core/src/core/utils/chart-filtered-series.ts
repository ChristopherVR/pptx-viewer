/**
 * chart-filtered-series.ts: PowerPoint's "Chart Filters" feature (the Series
 * tab of the funnel-shaped filter button next to a selected chart) hides a
 * series from the plot while keeping its data in the workbook. The hidden
 * series is not deleted from the chart XML; it is moved into
 * `c:<type>Chart/c:extLst/c:ext[@uri={02D57815-91ED-43cb-92C2-25804820EDAC}]
 * /c15:filtered<Type>Series/c15:ser`, a full `c:ser`-shaped node (its own
 * idx, order, tx/cat/val caches, and its own `c16:uniqueId`) that render
 * never looks at.
 *
 * Confirmed against real PowerPoint output (Office16, COM-authored via
 * `Series.IsFiltered = True`; the committed fixture is
 * `e2e/fixtures/chart-filtered-series.pptx`, a bar chart, but the same
 * COM script run against line and pie chart types during investigation
 * produced an identically shaped `c15:filteredLineSeries` /
 * `c15:filteredPieSeries` wrapper, so the pattern is matched generically
 * rather than special-cased per chart type). A pure CATEGORY filter
 * (`FullCategoryCollection().IsFiltered`, no series filtered) produced NO
 * extension at all in every chart type tried: PowerPoint just shortens every
 * surviving series' `c:strCache` /
 * `c:numCache` to omit the hidden category's cached point, leaving the
 * `c:f` range reference untouched. That is already lossless under this
 * codebase's existing idx/ptCount cache expansion, so no separate
 * category-filter modelling is needed. `c15:filteredCategoryTitle` /
 * `c15:filteredSeriesTitle` / `c15:xForSave` were not reproducible via COM
 * automation in any chart type tried here; they are left undocumented
 * pending a real corpus sample.
 *
 * The one behaviour this module fixes, not just describes: the save path
 * (`PptxHandlerRuntimeSaveDataSerialization`) allocates every visible
 * series' `c:idx`/`c:order` as a plain 0..N-1 sequence with no idea a
 * filtered series already occupies one of those values. Editing a chart
 * that has a filtered series and saving silently reassigned a visible
 * series onto the SAME idx a filtered series still uses.
 * {@link collectFilteredSeriesIndices} lets the save path treat those
 * indices as reserved when allocating.
 *
 * @module utils/chart-filtered-series
 */
import type { PptxChartFilteredSeries, XmlObject } from '../types';
import { parseChartUniqueId } from './chart-series-identity';

/** `c:ext/@uri` for the Office 2013+ chart15 series/category filter extension family. */
export const CHART_FILTERED_SERIES_EXT_URI = '{02D57815-91ED-43cb-92C2-25804820EDAC}';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

/** Resolve a possibly-prefixed XML key to its local name (`c15:ser` -> `ser`). */
function localNameOf(key: string): string {
	return key.replace(/^.*:/u, '');
}

function scalarChild(
	parent: XmlObject | undefined,
	name: string,
	xmlLookup: XmlLookupLike,
): string | undefined {
	const viaLookup = xmlLookup.getScalarChildByLocalName?.(parent, name);
	if (viaLookup !== undefined && viaLookup !== '') {
		return viaLookup;
	}
	const node = xmlLookup.getChildByLocalName(parent, name);
	return node?.['#text'] === undefined ? undefined : String(node['#text']);
}

/**
 * Expand a `c:tx`/`c:cat`/`c:val`-shaped reference container's
 * `strCache`/`numCache` into a dense array, matching the codebase's existing
 * idx/ptCount expansion rule (a sparse cache slot is a genuine blank, not
 * absence): {@link PptxHandlerRuntimeChartDetection.extractChartCategoryValues}.
 */
function readCachedValues(refContainer: XmlObject | undefined, xmlLookup: XmlLookupLike): string[] {
	if (!refContainer) {
		return [];
	}
	const cacheNode =
		xmlLookup.getChildByLocalName(refContainer, 'strCache') ??
		xmlLookup.getChildByLocalName(refContainer, 'numCache');
	if (!cacheNode) {
		return [];
	}
	const points = xmlLookup.getChildrenArrayByLocalName(cacheNode, 'pt');
	const byIndex = new Map<number, string>();
	let maxIndex = -1;
	for (const point of points) {
		const idx = Number.parseInt(String(point['@_idx'] ?? ''), 10);
		if (!Number.isInteger(idx) || idx < 0) {
			continue;
		}
		byIndex.set(idx, scalarChild(point, 'v', xmlLookup) ?? '');
		if (idx > maxIndex) {
			maxIndex = idx;
		}
	}
	if (byIndex.size === 0) {
		return [];
	}
	const declared = Number.parseInt(
		String(xmlLookup.getChildByLocalName(cacheNode, 'ptCount')?.['@_val'] ?? ''),
		10,
	);
	const length = Number.isFinite(declared) && declared > maxIndex + 1 ? declared : maxIndex + 1;
	const out: string[] = [];
	for (let i = 0; i < length; i++) {
		out.push(byIndex.get(i) ?? '');
	}
	return out;
}

function parseOneFilteredSeries(
	node: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartFilteredSeries | undefined {
	const idx = Number.parseInt(
		String(xmlLookup.getChildByLocalName(node, 'idx')?.['@_val'] ?? ''),
		10,
	);
	if (!Number.isInteger(idx) || idx < 0) {
		return undefined;
	}
	const orderRaw = xmlLookup.getChildByLocalName(node, 'order')?.['@_val'];
	const parsedOrder = Number.parseInt(String(orderRaw ?? ''), 10);
	const order = Number.isInteger(parsedOrder) ? parsedOrder : idx;

	const result: PptxChartFilteredSeries = { idx, order };

	const txNode = xmlLookup.getChildByLocalName(node, 'tx');
	const nameValues = readCachedValues(
		xmlLookup.getChildByLocalName(txNode, 'strRef') ??
			xmlLookup.getChildByLocalName(txNode, 'numRef'),
		xmlLookup,
	);
	if (nameValues[0]) {
		result.name = nameValues[0];
	}

	const catNode = xmlLookup.getChildByLocalName(node, 'cat');
	const categories = readCachedValues(
		xmlLookup.getChildByLocalName(catNode, 'strRef') ??
			xmlLookup.getChildByLocalName(catNode, 'numRef'),
		xmlLookup,
	);
	if (categories.length > 0) {
		result.categories = categories;
	}

	const valNode = xmlLookup.getChildByLocalName(node, 'val');
	const values = readCachedValues(xmlLookup.getChildByLocalName(valNode, 'numRef'), xmlLookup)
		.map((v) => Number.parseFloat(v))
		.filter((n) => Number.isFinite(n));
	if (values.length > 0) {
		result.values = values;
	}

	const uniqueId = parseChartUniqueId(node, localNameOf);
	if (uniqueId) {
		result.uniqueId = uniqueId;
	}

	return result;
}

/** Find the chart15 filter `c:ext` (by uri) directly under `container/c:extLst`. */
function findFilterExt(
	container: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): XmlObject | undefined {
	const extLst = xmlLookup.getChildByLocalName(container, 'extLst');
	if (!extLst) {
		return undefined;
	}
	return xmlLookup
		.getChildrenArrayByLocalName(extLst, 'ext')
		.find((ext) => ext['@_uri'] === CHART_FILTERED_SERIES_EXT_URI);
}

/**
 * Parse every `c15:ser` hidden inside a chart-type container's
 * `c15:filtered<Type>Series` extension. The wrapper element name varies by
 * chart type (`filteredBarSeries`, `filteredLineSeries`,
 * `filteredPieSeries`, ...) so it is matched by pattern rather than an
 * exhaustive per-type list; every variant wraps one or more `c15:ser` nodes
 * shaped exactly like a real `c:ser`.
 */
export function parseFilteredSeries(
	container: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): PptxChartFilteredSeries[] | undefined {
	const ext = findFilterExt(container, xmlLookup);
	if (!ext) {
		return undefined;
	}
	const wrapperKey = Object.keys(ext).find((key) => /^filtered.*series$/iu.test(localNameOf(key)));
	if (!wrapperKey) {
		return undefined;
	}
	const wrapperValue = ext[wrapperKey];
	const wrapperNodes = Array.isArray(wrapperValue)
		? (wrapperValue as XmlObject[])
		: [wrapperValue as XmlObject];

	const results: PptxChartFilteredSeries[] = [];
	for (const wrapperNode of wrapperNodes) {
		for (const serNode of xmlLookup.getChildrenArrayByLocalName(wrapperNode, 'ser')) {
			const parsed = parseOneFilteredSeries(serNode, xmlLookup);
			if (parsed) {
				results.push(parsed);
			}
		}
	}
	return results.length > 0 ? results : undefined;
}

/**
 * The set of `c:idx` values a filtered series already occupies in this
 * chart-type container. The save path must never assign a visible series
 * one of these, or two `c:idx`-tagged series nodes (one real, one inside the
 * filter extension) end up sharing an index in the same plot area.
 */
export function collectFilteredSeriesIndices(
	container: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): Set<number> {
	const reserved = new Set<number>();
	for (const filtered of parseFilteredSeries(container, xmlLookup) ?? []) {
		reserved.add(filtered.idx);
	}
	return reserved;
}

/**
 * Build a collision-free `c:idx`/`c:order` assignment for `count` visible
 * series, in array order, skipping every index in `reservedIndices`.
 * Identical to the plain `0..count-1` sequence when `reservedIndices` is
 * empty, matching prior behaviour exactly for the (overwhelmingly common)
 * case of a chart with no filtered series.
 */
export function assignSeriesIndices(count: number, reservedIndices: Set<number>): number[] {
	const assigned: number[] = [];
	let cursor = 0;
	for (let i = 0; i < count; i++) {
		while (reservedIndices.has(cursor)) {
			cursor++;
		}
		assigned.push(cursor);
		cursor++;
	}
	return assigned;
}
