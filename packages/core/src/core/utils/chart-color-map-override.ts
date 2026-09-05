/**
 * Serializer for the chart-space colour-map override (`c:clrMapOvr`,
 * CT_ColorMapping): 12 `bg1/tx1/bg2/tx2/accent1..6/hlink/folHlink` attributes
 * remapping theme colour roles for one chart, mirroring what a slide/layout's
 * `p:clrMapOvr` does for shape colours (see `theme-override-utils.ts`).
 *
 * The parse side (`PptxHandlerRuntimeChartParsingHelpers.parseClrMapOvr`)
 * already flattens the element into a `Record<string, string>`; until now
 * there was no write-back path at all, so editing the model field had no
 * effect on save (graded `edit: unassessed` in
 * `openxml-coverage-chart-labels-supplement.ts`).
 *
 * @module utils/chart-color-map-override
 */
import type { XmlObject } from '../types';

type LocalName = (key: string) => string;

function keyOf(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function prefixOf(key: string | undefined): string {
	if (!key) {
		return 'c';
	}
	const colon = key.indexOf(':');
	return colon === -1 ? 'c' : key.slice(0, colon);
}

/**
 * Apply, replace, or remove `c:clrMapOvr` on a chart-space node. `undefined`
 * is a no-op (passthrough); `null` or an empty map removes the element;
 * otherwise the map's attributes fully replace the element's attributes
 * (CT_ColorMapping has no children, only the 12 role attributes, so there is
 * nothing else to preserve). Inserted before `c:chart` when absent, matching
 * CT_ChartSpace's schema order.
 */
export function applyChartColorMapOverride(
	chartSpace: XmlObject,
	value: Record<string, string> | null | undefined,
	localName: LocalName,
): void {
	if (value === undefined) {
		return;
	}
	const existingKey = keyOf(chartSpace, 'clrMapOvr', localName);
	if (value === null || Object.keys(value).length === 0) {
		if (existingKey) {
			delete chartSpace[existingKey];
		}
		return;
	}
	const node: XmlObject = {};
	for (const [attribute, attrValue] of Object.entries(value)) {
		node[`@_${attribute}`] = attrValue;
	}
	if (existingKey) {
		chartSpace[existingKey] = node;
		return;
	}
	const chartKey = keyOf(chartSpace, 'chart', localName);
	const prefix = prefixOf(chartKey);
	const entries = Object.entries(chartSpace);
	for (const key of Object.keys(chartSpace)) {
		delete chartSpace[key];
	}
	let inserted = false;
	for (const [key, child] of entries) {
		if (!inserted && localName(key) === 'chart') {
			chartSpace[`${prefix}:clrMapOvr`] = node;
			inserted = true;
		}
		chartSpace[key] = child;
	}
	if (!inserted) {
		chartSpace[`${prefix}:clrMapOvr`] = node;
	}
}
