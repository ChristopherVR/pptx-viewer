/**
 * Pure serialization helper for writing per-series error bars (`c:errBars`
 * inside `c:ser`) back into the parsed chart XML on save.
 *
 * Rebuilds each error-bar node in schema order while preserving children the
 * model does not capture (`c:noEndCap`, `c:spPr`), so re-saving an unedited
 * chart is loss-free. Dependency-light (a `getLocalName` resolver only) so it
 * can be unit-tested directly.
 *
 * @module utils/chart-errbars-serializer
 */

import type { PptxChartErrBars, XmlObject } from '../types';

type GetLocalName = (key: string) => string;

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

function validateErrBars(e: PptxChartErrBars): void {
	if (e.val !== undefined && !Number.isFinite(e.val)) {
		throw new RangeError('error-bar value must be finite');
	}
	for (const value of [...(e.customPlus ?? []), ...(e.customMinus ?? [])]) {
		if (!Number.isFinite(value)) {
			throw new RangeError('custom error-bar values must be finite');
		}
	}
}

function buildSpPr(existing: XmlObject | undefined, color: string, getLocalName: GetLocalName) {
	const spPr: XmlObject = existing ? { ...existing } : {};
	const lnKey = findKey(spPr, 'ln', getLocalName) ?? 'a:ln';
	const ln = { ...((spPr[lnKey] as XmlObject | undefined) ?? {}) };
	const fillKey = findKey(ln, 'solidFill', getLocalName) ?? 'a:solidFill';
	ln[fillKey] = { 'a:srgbClr': { '@_val': hex(color) } };
	spPr[lnKey] = ln;
	return spPr;
}

/** Build a `c:numLit` cache for custom error-bar values. */
function numLit(values: number[]): XmlObject {
	return {
		'c:ptCount': { '@_val': String(values.length) },
		'c:pt': values.map((v, i) => ({ '@_idx': String(i), 'c:v': String(v) })),
	};
}

/** Build a single `c:errBars` node in schema order, preserving unmodeled children. */
function buildErrBars(
	existing: XmlObject | undefined,
	e: PptxChartErrBars,
	getLocalName: GetLocalName,
): XmlObject {
	validateErrBars(e);
	const node: XmlObject = {
		'c:errDir': { '@_val': e.direction },
		'c:errBarType': { '@_val': e.barType },
		'c:errValType': { '@_val': e.valType },
	};

	if (e.noEndCap !== undefined) {
		node['c:noEndCap'] = { '@_val': e.noEndCap ? '1' : '0' };
	} else if (existing) {
		const noEndCapKey = findKey(existing, 'noEndCap', getLocalName);
		if (noEndCapKey) {
			node['c:noEndCap'] = existing[noEndCapKey];
		}
	}

	if (e.valType === 'cust') {
		if (e.customPlus && e.customPlus.length > 0) {
			node['c:plus'] = { 'c:numLit': numLit(e.customPlus) };
		}
		if (e.customMinus && e.customMinus.length > 0) {
			node['c:minus'] = { 'c:numLit': numLit(e.customMinus) };
		}
	} else if (e.val !== undefined) {
		node['c:val'] = { '@_val': String(e.val) };
	}

	const spPrKey = existing ? findKey(existing, 'spPr', getLocalName) : undefined;
	const existingSpPr = spPrKey ? (existing?.[spPrKey] as XmlObject) : undefined;
	if (e.color) {
		node['c:spPr'] = buildSpPr(existingSpPr, e.color, getLocalName);
	} else if (existingSpPr) {
		node['c:spPr'] = existingSpPr;
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
 * Apply the model's error bars onto a `c:ser` node. Replaces the series'
 * `c:errBars` children (in schema order, before `c:cat`/`c:val`), reusing
 * matched existing nodes to preserve unmodeled styling. An empty `errBars`
 * array removes all error bars. Mutates `seriesNode` in place.
 */
export function applySeriesErrBarsToXml(
	seriesNode: XmlObject,
	errBars: PptxChartErrBars[],
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(seriesNode, 'errBars', getLocalName);
	const existingNodes = (existingKey ? ensureArray(seriesNode[existingKey]) : []) as XmlObject[];

	const built = errBars.map((e, i) => buildErrBars(existingNodes[i], e, getLocalName));

	if (existingKey) {
		delete seriesNode[existingKey];
	}
	if (built.length === 0) {
		return;
	}

	// Re-insert `c:errBars` immediately before the first `c:cat`/`c:val` child
	// (CT_*Ser order: ... trendline*, errBars*, cat, val ...).
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => {
		const local = getLocalName(k);
		return local === 'cat' || local === 'val' || local === 'xVal' || local === 'yVal';
	});
	const value = built.length === 1 ? built[0] : built;
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:errBars', value] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}
