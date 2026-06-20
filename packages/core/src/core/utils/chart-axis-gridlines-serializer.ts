/**
 * Pure serialization helper for toggling chart axis gridlines
 * (`c:majorGridlines` / `c:minorGridlines` under an axis node) on save.
 *
 * Adds an empty gridlines element in schema order when turned on (preserving
 * an existing one with its styling), removes it when turned off, and leaves it
 * untouched when the flag is `undefined`. Dependency-light (a `getLocalName`
 * resolver only) so it can be unit-tested directly.
 *
 * @module utils/chart-axis-gridlines-serializer
 */

import type { PptxChartShapeProps, XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** CT_*Ax children that follow `c:majorGridlines` in schema order. */
const AFTER_MAJOR = new Set([
	'minorGridlines',
	'title',
	'numFmt',
	'majorTickMark',
	'minorTickMark',
	'tickLblPos',
	'spPr',
	'txPr',
	'crossAx',
	'crosses',
	'crossesAt',
	'crossBetween',
	'majorUnit',
	'minorUnit',
	'dispUnits',
	'extLst',
]);
/** CT_*Ax children that follow `c:minorGridlines` (same, minus majorGridlines/minorGridlines). */
const AFTER_MINOR = new Set([...AFTER_MAJOR].filter((x) => x !== 'minorGridlines'));

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function insertBefore(
	axisNode: XmlObject,
	newKey: string,
	value: XmlObject,
	afterSet: Set<string>,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(axisNode);
	const beforeIdx = keys.findIndex((k) => afterSet.has(getLocalName(k)));
	const entries = keys.map((k) => [k, axisNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, [newKey, value] as const);
	for (const k of keys) {
		delete axisNode[k];
	}
	for (const [k, v] of entries) {
		axisNode[k] = v;
	}
}

function applyOne(
	axisNode: XmlObject,
	local: string,
	key: string,
	flag: boolean | undefined,
	afterSet: Set<string>,
	getLocalName: GetLocalName,
): void {
	if (flag === undefined) {
		return;
	}
	const existingKey = findKey(axisNode, local, getLocalName);
	if (!flag) {
		if (existingKey) {
			delete axisNode[existingKey];
		}
		return;
	}
	// Turning on: keep an existing element (and its styling); insert an empty
	// one only when absent.
	if (!existingKey) {
		insertBefore(axisNode, key, {}, afterSet, getLocalName);
	}
}

/**
 * Toggle major/minor gridlines on an axis node from the model flags. Mutates
 * `axisNode` in place. `undefined` flags are left untouched (passthrough).
 */
export function applyChartAxisGridlinesToXml(
	axisNode: XmlObject,
	opts: {
		majorGridlines?: boolean;
		minorGridlines?: boolean;
		majorGridlinesSpPr?: PptxChartShapeProps;
		minorGridlinesSpPr?: PptxChartShapeProps;
	},
	getLocalName: GetLocalName,
): void {
	applyOne(
		axisNode,
		'majorGridlines',
		'c:majorGridlines',
		opts.majorGridlines,
		AFTER_MAJOR,
		getLocalName,
	);
	applyOne(
		axisNode,
		'minorGridlines',
		'c:minorGridlines',
		opts.minorGridlines,
		AFTER_MINOR,
		getLocalName,
	);
	applyGridlineStyle(axisNode, 'majorGridlines', opts.majorGridlinesSpPr, getLocalName);
	applyGridlineStyle(axisNode, 'minorGridlines', opts.minorGridlinesSpPr, getLocalName);
}

function hex(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

/** Build a `c:spPr` carrying the modeled gridline line styling (colour/width/dash). */
function buildGridlineSpPr(
	existing: XmlObject | undefined,
	style: PptxChartShapeProps,
	getLocalName: GetLocalName,
): XmlObject {
	const spPr: XmlObject = existing ? { ...existing } : {};
	const lnKey = findKey(spPr, 'ln', getLocalName) ?? 'a:ln';
	const ln: XmlObject = { ...((spPr[lnKey] as XmlObject | undefined) ?? {}) };
	if (style.strokeWidth !== undefined) {
		// EMU: 1 pt = 12700 EMU.
		ln['@_w'] = String(Math.round(style.strokeWidth * 12700));
	}
	if (style.strokeColor) {
		const fillKey = findKey(ln, 'solidFill', getLocalName) ?? 'a:solidFill';
		const noFillKey = findKey(ln, 'noFill', getLocalName);
		if (noFillKey) {
			delete ln[noFillKey];
		}
		ln[fillKey] = { 'a:srgbClr': { '@_val': hex(style.strokeColor) } };
	}
	if (style.strokeDashStyle) {
		const dashKey = findKey(ln, 'prstDash', getLocalName) ?? 'a:prstDash';
		ln[dashKey] = { '@_val': style.strokeDashStyle };
	}
	spPr[lnKey] = ln;
	return spPr;
}

/**
 * Apply line styling onto an existing gridlines element's `c:spPr`. The
 * gridlines element must already be present (toggled on via
 * {@link applyChartAxisGridlinesToXml}). `undefined` style is a passthrough.
 */
function applyGridlineStyle(
	axisNode: XmlObject,
	local: string,
	style: PptxChartShapeProps | undefined,
	getLocalName: GetLocalName,
): void {
	if (!style) {
		return;
	}
	const gridKey = findKey(axisNode, local, getLocalName);
	if (!gridKey) {
		return;
	}
	const grid: XmlObject = { ...((axisNode[gridKey] as XmlObject | undefined) ?? {}) };
	const spPrKey = findKey(grid, 'spPr', getLocalName) ?? 'c:spPr';
	grid[spPrKey] = buildGridlineSpPr(grid[spPrKey] as XmlObject | undefined, style, getLocalName);
	axisNode[gridKey] = grid;
}
