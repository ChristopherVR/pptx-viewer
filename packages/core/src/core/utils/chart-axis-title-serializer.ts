/**
 * Pure serialization helper for writing a chart axis title (`c:title` under a
 * `c:catAx`/`c:valAx`/`c:dateAx`/`c:serAx`) back into the parsed chart XML on
 * save.
 *
 * Updates the text of an existing title in place (preserving its formatting),
 * inserts a minimal title in schema order when newly set, or removes it when
 * cleared. Dependency-light (a `getLocalName` resolver only) so it can be
 * unit-tested directly.
 *
 * @module utils/chart-axis-title-serializer
 */

import type { XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** Local names of CT_*Ax children that follow `c:title` in schema order. */
const AFTER_TITLE = new Set([
	'numFmt',
	'majorTickMark',
	'minorTickMark',
	'tickLblPos',
	'spPr',
	'txPr',
	'crossAx',
	'crosses',
	'crossesAt',
	'auto',
	'lblAlgn',
	'lblOffset',
	'tickLblSkip',
	'tickMarkSkip',
	'noMultiLvlLbl',
	'dispUnits',
	'majorUnit',
	'minorUnit',
	'baseTimeUnit',
	'majorTimeUnit',
	'minorTimeUnit',
]);

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

/** Set the first descendant text run (`a:t`) to `text`. Returns whether one was found. */
function setFirstText(node: unknown, text: string, getLocalName: GetLocalName): boolean {
	if (!node || typeof node !== 'object') {
		return false;
	}
	const obj = node as XmlObject;
	for (const key of Object.keys(obj)) {
		if (getLocalName(key) === 't') {
			const value = obj[key];
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				(value as XmlObject)['#text'] = text;
			} else {
				obj[key] = text;
			}
			return true;
		}
		const child = obj[key];
		const children = Array.isArray(child) ? child : [child];
		for (const c of children) {
			if (setFirstText(c, text, getLocalName)) {
				return true;
			}
		}
	}
	return false;
}

/** Build a minimal `c:title` carrying a single text run. */
function buildTitle(text: string): XmlObject {
	return {
		'c:tx': {
			'c:rich': {
				'a:bodyPr': {},
				'a:lstStyle': {},
				'a:p': { 'a:r': { 'a:t': text } },
			},
		},
		'c:overlay': { '@_val': '0' },
	};
}

/** Insert `c:title` before the first child that follows it in schema order. */
function insertTitleOrdered(
	axisNode: XmlObject,
	title: XmlObject,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(axisNode);
	const beforeIdx = keys.findIndex((k) => AFTER_TITLE.has(getLocalName(k)));
	const entries = keys.map((k) => [k, axisNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:title', title] as const);
	for (const k of keys) {
		delete axisNode[k];
	}
	for (const [k, v] of entries) {
		axisNode[k] = v;
	}
}

/**
 * Apply an axis title onto an axis node.
 *
 * - `titleText === undefined` leaves the axis untouched (passthrough).
 * - `titleText === ''` removes the `c:title`.
 * - a non-empty string updates an existing title's text (preserving its
 *   formatting) or inserts a new minimal title in schema order.
 *
 * Mutates `axisNode` in place.
 */
export function applyChartAxisTitleToXml(
	axisNode: XmlObject,
	titleText: string | undefined,
	getLocalName: GetLocalName,
): void {
	if (titleText === undefined) {
		return;
	}
	const titleKey = findKey(axisNode, 'title', getLocalName);

	if (titleText === '') {
		if (titleKey) {
			delete axisNode[titleKey];
		}
		return;
	}

	if (titleKey) {
		const updated = setFirstText(axisNode[titleKey], titleText, getLocalName);
		if (!updated) {
			axisNode[titleKey] = buildTitle(titleText);
		}
		return;
	}
	insertTitleOrdered(axisNode, buildTitle(titleText), getLocalName);
}

/** Font styling applied to an axis title's text runs. */
export interface ChartAxisTitleStyle {
	fontFamily?: string;
	fontSize?: number;
	fontBold?: boolean;
	fontColor?: string;
}

function hex(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

/** Build the `a:defRPr` run-properties carrying the modeled font styling. */
function buildDefRPr(style: ChartAxisTitleStyle): XmlObject {
	const rPr: XmlObject = {};
	if (style.fontSize !== undefined) {
		// OOXML font size is in hundredths of a point.
		rPr['@_sz'] = String(Math.round(style.fontSize * 100));
	}
	if (style.fontBold !== undefined) {
		rPr['@_b'] = style.fontBold ? '1' : '0';
	}
	if (style.fontColor) {
		rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': hex(style.fontColor) } };
	}
	if (style.fontFamily) {
		rPr['a:latin'] = { '@_typeface': style.fontFamily };
	}
	return rPr;
}

/**
 * Apply font styling (family/size/bold/colour) onto an axis title's `c:txPr`.
 * Requires a `c:title` to be present already (set via
 * {@link applyChartAxisTitleToXml}); no-ops otherwise. When no style fields are
 * provided this leaves the node untouched. Mutates `axisNode` in place.
 */
export function applyChartAxisTitleStyleToXml(
	axisNode: XmlObject,
	style: ChartAxisTitleStyle,
	getLocalName: GetLocalName,
): void {
	const hasAny =
		style.fontFamily !== undefined ||
		style.fontSize !== undefined ||
		style.fontBold !== undefined ||
		style.fontColor !== undefined;
	if (!hasAny) {
		return;
	}
	const titleKey = findKey(axisNode, 'title', getLocalName);
	if (!titleKey) {
		return;
	}
	const title: XmlObject = { ...((axisNode[titleKey] as XmlObject | undefined) ?? {}) };
	const txPrKey = findKey(title, 'txPr', getLocalName) ?? 'c:txPr';
	const txPr: XmlObject = { ...((title[txPrKey] as XmlObject | undefined) ?? {}) };

	// c:txPr := a:bodyPr, a:lstStyle, a:p (> a:pPr > a:defRPr). The run defaults
	// that carry font styling live in a:p/a:pPr/a:defRPr, never directly on txPr.
	if (!txPr[findKey(txPr, 'bodyPr', getLocalName) ?? 'a:bodyPr']) {
		txPr['a:bodyPr'] = {};
	}
	if (!txPr[findKey(txPr, 'lstStyle', getLocalName) ?? 'a:lstStyle']) {
		txPr['a:lstStyle'] = {};
	}
	const pKey = findKey(txPr, 'p', getLocalName) ?? 'a:p';
	const existingP = txPr[pKey];
	const para: XmlObject = {
		...((Array.isArray(existingP) ? existingP[0] : (existingP as XmlObject | undefined)) ?? {}),
	};
	const pPrKey = findKey(para, 'pPr', getLocalName) ?? 'a:pPr';
	const pPr: XmlObject = { ...((para[pPrKey] as XmlObject | undefined) ?? {}) };
	const defRPrKey = findKey(pPr, 'defRPr', getLocalName) ?? 'a:defRPr';
	const existingDefRPr = (pPr[defRPrKey] as XmlObject | undefined) ?? {};
	pPr[defRPrKey] = { ...existingDefRPr, ...buildDefRPr(style) };
	para[pPrKey] = pPr;
	txPr[pKey] = para;

	title[txPrKey] = txPr;
	axisNode[titleKey] = title;
}
