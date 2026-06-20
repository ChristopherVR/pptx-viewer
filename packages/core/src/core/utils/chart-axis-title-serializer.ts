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
