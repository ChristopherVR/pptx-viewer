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
import { buildTrendlineLabel } from './chart-trendline-label';

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

function assertFinite(value: number | undefined, name: string): void {
	if (value !== undefined && !Number.isFinite(value)) {
		throw new RangeError(`${name} must be finite`);
	}
}

function validateTrendline(t: PptxChartTrendline): void {
	if (t.order !== undefined && (!Number.isInteger(t.order) || t.order < 2 || t.order > 6)) {
		throw new RangeError('trendline order must be an integer from 2 through 6');
	}
	if (
		t.period !== undefined &&
		(!Number.isInteger(t.period) || t.period < 2 || t.period > 4294967295)
	) {
		throw new RangeError('trendline period must be an integer from 2 through 4294967295');
	}
	assertFinite(t.forward, 'trendline forward');
	assertFinite(t.backward, 'trendline backward');
	assertFinite(t.intercept, 'trendline intercept');
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
	validateTrendline(t);
	const node: XmlObject = {};

	const existingNameKey = existing ? findKey(existing, 'name', getLocalName) : undefined;
	if (t.name !== undefined) {
		node['c:name'] = t.name;
	} else if (existing && existingNameKey) {
		node['c:name'] = existing[existingNameKey];
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
	if (t.displayRSq !== undefined) {
		node['c:dispRSqr'] = { '@_val': t.displayRSq ? '1' : '0' };
	}
	if (t.displayEq !== undefined) {
		node['c:dispEq'] = { '@_val': t.displayEq ? '1' : '0' };
	}

	const lblKey = existing ? findKey(existing, 'trendlineLbl', getLocalName) : undefined;
	if (t.label) {
		node['c:trendlineLbl'] = buildTrendlineLabel(
			lblKey ? (existing?.[lblKey] as XmlObject) : undefined,
			t.label,
			getLocalName,
		);
	} else if (t.label === undefined && existing && lblKey) {
		node['c:trendlineLbl'] = existing[lblKey];
	}
	if (existing) {
		const extKey = findKey(existing, 'extLst', getLocalName);
		if (extKey) {
			node['c:extLst'] = existing[extKey];
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
