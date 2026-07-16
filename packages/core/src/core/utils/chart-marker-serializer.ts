/**
 * Pure serialization helper for writing a series marker (`c:marker` inside
 * `c:ser`) back into the parsed chart XML on save.
 *
 * Updates an existing `c:marker` in place (preserving unmodeled children) or
 * inserts a minimal one in schema order. An explicit `null`/`undefined` marker
 * removes the element. Dependency-light (a `getLocalName` resolver only) so it
 * can be unit-tested directly.
 *
 * @module utils/chart-marker-serializer
 */

import type { PptxChartMarker, XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** CT_Ser children that follow `c:marker` in schema order. */
const AFTER_MARKER = new Set([
	'dPt',
	'dLbls',
	'trendline',
	'errBars',
	'cat',
	'val',
	'xVal',
	'yVal',
	'bubbleSize',
	'bubble3D',
	'smooth',
	'extLst',
]);

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function hex(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

function insertOrdered(
	seriesNode: XmlObject,
	key: string,
	value: XmlObject,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => AFTER_MARKER.has(getLocalName(k)));
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, [key, value] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}

/** Build the `c:spPr` (fill + line) for a marker from its modeled shape props. */
function buildMarkerSpPr(
	existing: XmlObject | undefined,
	marker: PptxChartMarker,
	getLocalName: GetLocalName,
): XmlObject | undefined {
	const props = marker.spPr;
	if (!props) {
		return existing;
	}
	const spPr: XmlObject = existing ? { ...existing } : {};
	if (props.fillColor) {
		const fillKey = findKey(spPr, 'solidFill', getLocalName) ?? 'a:solidFill';
		const noFillKey = findKey(spPr, 'noFill', getLocalName);
		if (noFillKey) {
			delete spPr[noFillKey];
		}
		spPr[fillKey] = { 'a:srgbClr': { '@_val': hex(props.fillColor) } };
	}
	if (props.strokeColor) {
		const lnKey = findKey(spPr, 'ln', getLocalName) ?? 'a:ln';
		const ln: XmlObject = { ...((spPr[lnKey] as XmlObject | undefined) ?? {}) };
		const lnFillKey = findKey(ln, 'solidFill', getLocalName) ?? 'a:solidFill';
		ln[lnFillKey] = { 'a:srgbClr': { '@_val': hex(props.strokeColor) } };
		spPr[lnKey] = ln;
	}
	return spPr;
}

/** Build a `c:marker` node in schema order, reusing unmodeled children when present. */
export function buildChartMarkerXml(
	existing: XmlObject | undefined,
	marker: PptxChartMarker,
	getLocalName: GetLocalName,
): XmlObject {
	if (!Number.isInteger(marker.size ?? 5) || (marker.size ?? 5) < 2 || (marker.size ?? 5) > 72) {
		throw new RangeError('marker size must be an integer from 2 through 72');
	}
	const node: XmlObject = {};
	node['c:symbol'] = { '@_val': marker.symbol };
	if (marker.size !== undefined) {
		node['c:size'] = { '@_val': String(marker.size) };
	}
	const existingSpPr = existing
		? (existing[findKey(existing, 'spPr', getLocalName) ?? ''] as XmlObject | undefined)
		: undefined;
	const spPr = buildMarkerSpPr(existingSpPr, marker, getLocalName);
	if (spPr) {
		node['c:spPr'] = spPr;
	}
	if (existing) {
		const modeled = new Set(['symbol', 'size', 'spPr']);
		for (const key of Object.keys(existing)) {
			if (!modeled.has(getLocalName(key))) {
				node[key] = existing[key];
			}
		}
	}
	return node;
}

/**
 * Apply the model's marker onto a `c:ser` node. Replaces the series' `c:marker`
 * child (reusing an existing one to preserve unmodeled styling), inserting it in
 * schema order. A `null`/`undefined` marker removes any existing `c:marker`.
 * Mutates `seriesNode` in place.
 */
export function applySeriesMarkerToXml(
	seriesNode: XmlObject,
	marker: PptxChartMarker | null | undefined,
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(seriesNode, 'marker', getLocalName);
	if (!marker) {
		if (existingKey) {
			delete seriesNode[existingKey];
		}
		return;
	}
	const existing = existingKey ? (seriesNode[existingKey] as XmlObject) : undefined;
	const built = buildChartMarkerXml(existing, marker, getLocalName);
	if (existingKey) {
		seriesNode[existingKey] = built;
		return;
	}
	insertOrdered(seriesNode, 'c:marker', built, getLocalName);
}
