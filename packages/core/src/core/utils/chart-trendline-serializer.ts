/**
 * Pure serialization helper for writing per-series trendlines (`c:trendline`
 * inside `c:ser`) back into the parsed chart XML on save.
 *
 * Rebuilds each trendline in schema order while preserving children the model
 * does not capture (`c:name`, `c:trendlineLbl`, and non-colour `c:spPr`
 * styling), so re-saving an unedited chart is loss-free. Dependency-light (a
 * `getLocalName` resolver only) so it can be unit-tested directly.
 *
 * @module utils/chart-trendline-serializer
 */

import type { PptxChartTrendline, XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** Model trendline type -> OOXML `ST_TrendlineType` value. */
const TYPE_TO_OOXML: Record<PptxChartTrendline['trendlineType'], string> = {
	linear: 'linear',
	exponential: 'exp',
	logarithmic: 'log',
	polynomial: 'poly',
	power: 'power',
	movingAvg: 'movingAvg',
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

function hex(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

/** Merge a trendline colour into an existing `c:spPr` (preserving other line props). */
function buildSpPr(
	existing: XmlObject | undefined,
	color: string | undefined,
	getLocalName: GetLocalName,
): XmlObject | undefined {
	if (!color) {
		return existing;
	}
	const spPr: XmlObject = existing ? { ...existing } : {};
	const lnKey = findKey(spPr, 'ln', getLocalName) ?? 'a:ln';
	const existingLn = (spPr[lnKey] as XmlObject | undefined) ?? {};
	const fillKey = findKey(existingLn, 'solidFill', getLocalName) ?? 'a:solidFill';
	// Drop any other fill style on the line so the chosen colour wins.
	const noFillKey = findKey(existingLn, 'noFill', getLocalName);
	const ln: XmlObject = { ...existingLn };
	if (noFillKey) {
		delete ln[noFillKey];
	}
	ln[fillKey] = { 'a:srgbClr': { '@_val': hex(color) } };
	spPr[lnKey] = ln;
	return spPr;
}

/** Build a single `c:trendline` node in schema order, preserving unmodeled children. */
function buildTrendline(
	existing: XmlObject | undefined,
	t: PptxChartTrendline,
	getLocalName: GetLocalName,
): XmlObject {
	const node: XmlObject = {};

	if (existing) {
		const nameKey = findKey(existing, 'name', getLocalName);
		if (nameKey) {
			node['c:name'] = existing[nameKey];
		}
	}
	const spPr = buildSpPr(
		existing ? (existing[findKey(existing, 'spPr', getLocalName) ?? ''] as XmlObject) : undefined,
		t.color,
		getLocalName,
	);
	if (spPr) {
		node['c:spPr'] = spPr;
	}

	node['c:trendlineType'] = { '@_val': TYPE_TO_OOXML[t.trendlineType] };
	if (t.trendlineType === 'polynomial') {
		node['c:order'] = { '@_val': String(t.order ?? 2) };
	}
	if (t.trendlineType === 'movingAvg') {
		node['c:period'] = { '@_val': String(t.period ?? 2) };
	}
	if (t.forward !== undefined) {
		node['c:forward'] = { '@_val': String(t.forward) };
	}
	if (t.backward !== undefined) {
		node['c:backward'] = { '@_val': String(t.backward) };
	}
	if (t.intercept !== undefined) {
		node['c:intercept'] = { '@_val': String(t.intercept) };
	}
	if (t.displayRSq) {
		node['c:dispRSqr'] = { '@_val': '1' };
	}
	if (t.displayEq) {
		node['c:dispEq'] = { '@_val': '1' };
	}

	if (existing) {
		const lblKey = findKey(existing, 'trendlineLbl', getLocalName);
		if (lblKey) {
			node['c:trendlineLbl'] = existing[lblKey];
		}
	}
	return node;
}

/**
 * Apply the model's trendlines onto a `c:ser` node. Replaces the series'
 * `c:trendline` children (in schema order, before `c:cat`/`c:val`), reusing
 * matched existing nodes to preserve unmodeled styling. An empty `trendlines`
 * array removes all trendlines. Mutates `seriesNode` in place.
 */
export function applySeriesTrendlinesToXml(
	seriesNode: XmlObject,
	trendlines: PptxChartTrendline[],
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(seriesNode, 'trendline', getLocalName);
	const existingNodes = (existingKey ? ensureArray(seriesNode[existingKey]) : []) as XmlObject[];

	const built = trendlines.map((t, i) => buildTrendline(existingNodes[i], t, getLocalName));

	// Remove the existing key; we will re-insert in the correct position.
	if (existingKey) {
		delete seriesNode[existingKey];
	}
	if (built.length === 0) {
		return;
	}

	// Re-insert `c:trendline` immediately before the first `c:cat`/`c:val`
	// child (CT_*Ser order: ... dLbls, trendline*, errBars*, cat, val ...).
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => {
		const local = getLocalName(k);
		return local === 'cat' || local === 'val' || local === 'xVal' || local === 'yVal';
	});
	const value = built.length === 1 ? built[0] : built;
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:trendline', value] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}
