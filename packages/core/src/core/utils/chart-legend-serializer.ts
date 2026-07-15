/**
 * Pure serialization helper for writing a chart's legend
 * (`c:legend` / `c:legendPos`, CT_Legend) back into the parsed chart XML
 * tree on save.
 *
 * Kept framework-free and dependency-light (it only needs a `getLocalName`
 * resolver so it works for both prefixed `c:legend` and namespace-stripped
 * `legend` keys) so it can be unit-tested directly without a full save
 * round-trip.
 *
 * @module utils/chart-legend-serializer
 */

import type { PptxChartLegendEntry, XmlObject } from '../types';

/** Resolve a possibly-prefixed XML key to its local name (e.g. `c:legend` -> `legend`). */
type GetLocalName = (key: string) => string;

/** The legend-relevant subset of `PptxChartStyle`. */
export interface ChartLegendStyle {
	/** Whether the chart has a visible legend. */
	hasLegend?: boolean;
	/** Legend position (`b`, `tr`, `l`, `r`, `t`). */
	legendPosition?: string;
	legendEntries?: PptxChartLegendEntry[];
}

type ParseColor = (node: XmlObject | undefined) => string | undefined;

function child(node: XmlObject | undefined, name: string, getLocalName: GetLocalName) {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => getLocalName(candidate) === name);
	return key ? (node[key] as XmlObject | undefined) : undefined;
}

/** Parse indexed legend-entry overrides, including practical text defaults. */
export function parseChartLegendEntries(
	legend: XmlObject,
	getLocalName: GetLocalName,
	parseColor: ParseColor,
): PptxChartLegendEntry[] {
	const key = Object.keys(legend).find((candidate) => getLocalName(candidate) === 'legendEntry');
	const raw = key ? legend[key] : undefined;
	const nodes = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
	return nodes.flatMap((value) => {
		const node = value as XmlObject;
		const index = Number.parseInt(String(child(node, 'idx', getLocalName)?.['@_val'] ?? ''), 10);
		if (!Number.isFinite(index) || index < 0) {
			return [];
		}
		const entry: PptxChartLegendEntry = { index };
		const deleteNode = child(node, 'delete', getLocalName);
		if (deleteNode) {
			const val = deleteNode['@_val'];
			entry.deleted = val !== '0' && val !== 'false';
		}
		const defRPr = child(
			child(child(child(node, 'txPr', getLocalName), 'p', getLocalName), 'pPr', getLocalName),
			'defRPr',
			getLocalName,
		);
		if (defRPr) {
			const style: NonNullable<PptxChartLegendEntry['textStyle']> = {};
			const size = Number.parseInt(String(defRPr['@_sz'] ?? ''), 10);
			if (Number.isFinite(size)) {
				style.fontSize = size / 100;
			}
			if (defRPr['@_b'] !== undefined) {
				style.bold = defRPr['@_b'] === '1' || defRPr['@_b'] === 'true';
			}
			if (defRPr['@_i'] !== undefined) {
				style.italic = defRPr['@_i'] === '1' || defRPr['@_i'] === 'true';
			}
			const latin = child(defRPr, 'latin', getLocalName);
			if (latin?.['@_typeface']) {
				style.fontFamily = String(latin['@_typeface']);
			}
			const color = parseColor(child(defRPr, 'solidFill', getLocalName));
			if (color) {
				style.color = color;
			}
			if (Object.keys(style).length > 0) {
				entry.textStyle = style;
			}
		}
		return [entry];
	});
}

function buildTextProperties(entry: PptxChartLegendEntry): XmlObject | undefined {
	const style = entry.textStyle;
	if (!style || Object.keys(style).length === 0) {
		return undefined;
	}
	const rPr: XmlObject = {};
	if (style.fontSize !== undefined) {
		rPr['@_sz'] = String(Math.round(style.fontSize * 100));
	}
	if (style.bold !== undefined) {
		rPr['@_b'] = style.bold ? '1' : '0';
	}
	if (style.italic !== undefined) {
		rPr['@_i'] = style.italic ? '1' : '0';
	}
	if (style.color) {
		rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': style.color.replace(/^#/u, '') } };
	}
	if (style.fontFamily) {
		rPr['a:latin'] = { '@_typeface': style.fontFamily };
	}
	return { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': { 'a:pPr': { 'a:defRPr': rPr } } };
}

function setEntryChoice(
	node: XmlObject,
	key: string,
	value: XmlObject,
	getLocalName: GetLocalName,
): void {
	if (key in node) {
		node[key] = value;
		return;
	}
	const entries = Object.entries(node);
	const extIndex = entries.findIndex(([candidate]) => getLocalName(candidate) === 'extLst');
	entries.splice(extIndex < 0 ? entries.length : extIndex, 0, [key, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, childValue] of entries) {
		node[candidate] = childValue;
	}
}

function applyLegendEntries(
	legend: XmlObject,
	entries: PptxChartLegendEntry[] | undefined,
	getLocalName: GetLocalName,
): void {
	if (!entries) {
		return;
	}
	const key = Object.keys(legend).find((candidate) => getLocalName(candidate) === 'legendEntry');
	const raw = key ? legend[key] : undefined;
	const existing = raw ? ((Array.isArray(raw) ? raw : [raw]) as XmlObject[]) : [];
	const byIndex = new Map(
		existing.map((node) => [Number(child(node, 'idx', getLocalName)?.['@_val']), node]),
	);
	const updated = [...existing];
	for (const entry of entries) {
		let node = byIndex.get(entry.index);
		if (!node) {
			node = { 'c:idx': { '@_val': String(entry.index) } };
			updated.push(node);
		}
		const deleteKey = Object.keys(node).find((candidate) => getLocalName(candidate) === 'delete');
		const txPrKey = Object.keys(node).find((candidate) => getLocalName(candidate) === 'txPr');
		const txPr = buildTextProperties(entry);
		if (txPr) {
			if (deleteKey) {
				delete node[deleteKey];
			}
			setEntryChoice(node, txPrKey ?? 'c:txPr', txPr, getLocalName);
		} else if (entry.deleted !== undefined) {
			if (txPrKey) {
				delete node[txPrKey];
			}
			setEntryChoice(
				node,
				deleteKey ?? 'c:delete',
				{ '@_val': entry.deleted ? '1' : '0' },
				getLocalName,
			);
		}
	}
	if (updated.length === 0) {
		return;
	}
	if (key) {
		legend[key] = updated;
		return;
	}
	const children = Object.entries(legend);
	const position = children.findIndex(([candidate]) => getLocalName(candidate) !== 'legendPos');
	children.splice(position < 0 ? children.length : position, 0, ['c:legendEntry', updated]);
	for (const candidate of Object.keys(legend)) {
		delete legend[candidate];
	}
	for (const [candidate, value] of children) {
		legend[candidate] = value;
	}
}

/**
 * Insert `newKey: newVal` into `parent` immediately after the existing child
 * whose local name is `afterLocalName`, preserving key (element) order so the
 * result stays schema-valid. When no such child exists, appends at the end, or
 * prepends when `atFrontIfMissing` is set. Mutates `parent` in place.
 */
function insertChildOrdered(
	parent: XmlObject,
	newKey: string,
	newVal: XmlObject,
	afterLocalName: string,
	getLocalName: GetLocalName,
	atFrontIfMissing = false,
): void {
	const keys = Object.keys(parent);
	const afterIdx = keys.findIndex((k) => getLocalName(k) === afterLocalName);
	const entries = keys.map((k) => [k, parent[k]] as const);
	const insertAt = afterIdx === -1 ? (atFrontIfMissing ? 0 : entries.length) : afterIdx + 1;
	entries.splice(insertAt, 0, [newKey, newVal] as const);
	for (const k of keys) {
		delete parent[k];
	}
	for (const [k, v] of entries) {
		parent[k] = v;
	}
}

/**
 * Apply legend visibility/position onto a chart root node (`c:chart`).
 *
 * - `style.hasLegend === false` removes the `<c:legend>` element.
 * - `style.hasLegend === true` ensures a `<c:legend>` exists (inserted in
 *   schema order, right after `<c:plotArea>`) and updates `<c:legendPos>`.
 * - When `hasLegend` is `undefined` the legend is left untouched so charts the
 *   user never edited round-trip via the original XML.
 *
 * Existing legend children (overlay, spPr, txPr, layout) are preserved; only
 * the position is updated. Mutates `chartRoot` in place.
 */
export function applyChartLegendToXml(
	chartRoot: XmlObject,
	style: ChartLegendStyle,
	getLocalName: GetLocalName,
): void {
	const existingKey = Object.keys(chartRoot).find((k) => getLocalName(k) === 'legend');

	if (style.hasLegend === false) {
		if (existingKey) {
			delete chartRoot[existingKey];
		}
		return;
	}
	if (style.hasLegend !== true && style.legendEntries === undefined) {
		return;
	}

	const legendNode = existingKey ? (chartRoot[existingKey] as XmlObject) : undefined;
	if (!legendNode) {
		// Insert a fresh legend right after the plot area (schema order:
		// plotArea, legend, plotVisOnly).
		insertChildOrdered(
			chartRoot,
			'c:legend',
			{
				'c:legendPos': { '@_val': style.legendPosition ?? 'r' },
				'c:overlay': { '@_val': '0' },
			},
			'plotArea',
			getLocalName,
		);
		const created = chartRoot['c:legend'] as XmlObject;
		applyLegendEntries(created, style.legendEntries, getLocalName);
		return;
	}

	if (style.legendPosition !== undefined) {
		const posKey = Object.keys(legendNode).find((k) => getLocalName(k) === 'legendPos');
		if (posKey) {
			(legendNode[posKey] as XmlObject)['@_val'] = style.legendPosition;
		} else {
			// `c:legendPos` is the first child of CT_Legend.
			insertChildOrdered(
				legendNode,
				'c:legendPos',
				{ '@_val': style.legendPosition },
				'__none__',
				getLocalName,
				true,
			);
		}
	}
	applyLegendEntries(legendNode, style.legendEntries, getLocalName);
}
