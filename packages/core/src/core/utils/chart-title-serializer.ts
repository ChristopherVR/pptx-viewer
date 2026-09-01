/**
 * Pure serialization helper for writing a chart's title (`c:title` /
 * `cx:title`) back into the parsed chart XML tree on save.
 *
 * Mirrors `chart-legend-serializer`: it creates the node when the model now
 * carries a title, removes it when the model says there is none, and leaves
 * the XML alone when the model is silent, so untouched charts round-trip
 * through their original markup.
 *
 * @module utils/chart-title-serializer
 */

import type { XmlObject } from '../types';

type GetLocalName = (key: string) => string;
type XmlValue = XmlObject[string];

/** The title-relevant subset of `PptxChartData` / `PptxChartStyle`. */
export interface ChartTitleModel {
	/** The title text; `''` clears the title, `undefined` leaves it alone. */
	title?: string;
	/** Explicit visibility; wins over `title` when it is `false`. */
	hasTitle?: boolean;
}

export interface ChartTitleOptions {
	/**
	 * Namespace prefix of the chart part: `c` for a 2006 DrawingML chart
	 * (`c:title`, with `c:autoTitleDeleted`), `cx` for a 2014 ChartEx part
	 * (`cx:title`, which has no auto-title flag).
	 */
	prefix: 'c' | 'cx';
}

function findKey(node: XmlObject, localName: string, getLocalName: GetLocalName) {
	return Object.keys(node).find((key) => getLocalName(key) === localName);
}

/** Rewrite `parent` with `entries` as its ordered children (keeps key order). */
function replaceEntries(parent: XmlObject, entries: Array<readonly [string, XmlValue]>): void {
	for (const key of Object.keys(parent)) {
		delete parent[key];
	}
	for (const [key, value] of entries) {
		parent[key] = value;
	}
}

/** Insert `key: value` at `index` in `parent`'s child order. */
function insertAt(parent: XmlObject, index: number, key: string, value: XmlValue): void {
	const entries = Object.keys(parent).map((k) => [k, parent[k]] as const);
	entries.splice(Math.max(0, Math.min(index, entries.length)), 0, [key, value] as const);
	replaceEntries(parent, entries);
}

/** Set (or insert, right after the title) the `c:autoTitleDeleted` flag. */
function setAutoTitleDeleted(chartRoot: XmlObject, deleted: boolean, getLocalName: GetLocalName) {
	const value = { '@_val': deleted ? '1' : '0' };
	const existingKey = findKey(chartRoot, 'autoTitleDeleted', getLocalName);
	if (existingKey) {
		chartRoot[existingKey] = value;
		return;
	}
	const keys = Object.keys(chartRoot);
	const titleIndex = keys.findIndex((key) => getLocalName(key) === 'title');
	insertAt(chartRoot, titleIndex === -1 ? 0 : titleIndex + 1, 'c:autoTitleDeleted', value);
}

/** Replace the first `a:t` text under `node`, walking depth-first. */
function replaceFirstText(node: XmlObject, text: string, getLocalName: GetLocalName): boolean {
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (getLocalName(key) === 't') {
			const current = node[key];
			node[key] =
				current && typeof current === 'object' && !Array.isArray(current)
					? { ...(current as XmlObject), '#text': text }
					: text;
			return true;
		}
		const value = node[key];
		const children = Array.isArray(value) ? value : [value];
		for (const child of children) {
			if (
				child &&
				typeof child === 'object' &&
				replaceFirstText(child as XmlObject, text, getLocalName)
			) {
				return true;
			}
		}
	}
	return false;
}

/** A fresh rich-text `tx` block carrying a single run. */
function buildTitleText(prefix: 'c' | 'cx', text: string): XmlObject {
	const rich: XmlObject =
		prefix === 'c'
			? { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': { 'a:r': { 'a:t': text } } }
			: { 'a:p': { 'a:r': { 'a:t': text } } };
	const tx: XmlObject = {};
	tx[`${prefix}:rich`] = rich;
	return tx;
}

/** A fresh title node (schema order: tx, then overlay for the 2006 model). */
function buildTitleNode(prefix: 'c' | 'cx', text: string | undefined): XmlObject {
	const node: XmlObject = {};
	if (text !== undefined) {
		node[`${prefix}:tx`] = buildTitleText(prefix, text);
	}
	if (prefix === 'c') {
		node['c:overlay'] = { '@_val': '0' };
	}
	return node;
}

/**
 * Apply the model's title onto a chart root node (`c:chart` or `cx:chart`).
 *
 * - `hasTitle === false`, or `title === ''` without an explicit `hasTitle`,
 *   removes the title node (and sets `c:autoTitleDeleted val="1"` on a
 *   2006 chart so PowerPoint does not re-synthesise one).
 * - A non-empty `title` ensures the node exists (inserted first, which is
 *   its schema position in both `CT_Chart` and `CT_ChartEx`) and rewrites its
 *   first text run; `hasTitle === true` with no text creates an empty
 *   (auto) title. Either way `c:autoTitleDeleted` becomes `0`.
 * - Both `undefined` leaves the XML untouched.
 *
 * Mutates `chartRoot` in place and returns whether a title node remains.
 */
export function applyChartTitleToXml(
	chartRoot: XmlObject,
	model: ChartTitleModel,
	getLocalName: GetLocalName,
	options: ChartTitleOptions = { prefix: 'c' },
): boolean {
	const { prefix } = options;
	const existingKey = findKey(chartRoot, 'title', getLocalName);
	const remove = model.hasTitle === false || (model.title === '' && model.hasTitle !== true);

	if (remove) {
		if (existingKey) {
			delete chartRoot[existingKey];
		}
		if (prefix === 'c') {
			setAutoTitleDeleted(chartRoot, true, getLocalName);
		}
		return false;
	}
	if (model.title === undefined && model.hasTitle !== true) {
		return existingKey !== undefined;
	}

	let titleNode = existingKey ? (chartRoot[existingKey] as XmlObject | undefined) : undefined;
	if (!titleNode || typeof titleNode !== 'object') {
		titleNode = buildTitleNode(prefix, model.title);
		if (existingKey) {
			chartRoot[existingKey] = titleNode;
		} else {
			insertAt(chartRoot, 0, `${prefix}:title`, titleNode);
		}
	} else if (model.title !== undefined && !replaceFirstText(titleNode, model.title, getLocalName)) {
		// A title node without any run (an auto title): give it explicit text.
		const txKey = findKey(titleNode, 'tx', getLocalName);
		if (txKey) {
			titleNode[txKey] = buildTitleText(prefix, model.title);
		} else {
			insertAt(titleNode, 0, `${prefix}:tx`, buildTitleText(prefix, model.title));
		}
	}
	if (prefix === 'c') {
		setAutoTitleDeleted(chartRoot, false, getLocalName);
	}
	return true;
}
