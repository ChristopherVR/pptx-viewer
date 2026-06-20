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

import type { XmlObject } from '../types';

/** Resolve a possibly-prefixed XML key to its local name (e.g. `c:legend` -> `legend`). */
type GetLocalName = (key: string) => string;

/** The legend-relevant subset of `PptxChartStyle`. */
export interface ChartLegendStyle {
	/** Whether the chart has a visible legend. */
	hasLegend?: boolean;
	/** Legend position (`b`, `tr`, `l`, `r`, `t`). */
	legendPosition?: string;
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
	if (style.hasLegend !== true) {
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
}
