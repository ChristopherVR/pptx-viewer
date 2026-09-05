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

import type { PptxChartTitleRun, XmlObject } from '../types';

type GetLocalName = (key: string) => string;
type XmlValue = XmlObject[string];

/** The title-relevant subset of `PptxChartData` / `PptxChartStyle`. */
export interface ChartTitleModel {
	/** The title text; `''` clears the title, `undefined` leaves it alone. */
	title?: string;
	/** Explicit visibility; wins over `title` when it is `false`. */
	hasTitle?: boolean;
	/**
	 * Lossless multi-run title text (`PptxChartData.titleRuns`). When present
	 * and non-empty, this REPLACES the rich body with one run per entry
	 * (each carrying its own bold/italic/size/color), taking priority over
	 * {@link title}'s single-run patch. `title` is still expected to carry
	 * the flat, first-run text alongside it (as the parser always produces),
	 * so a consumer that ignores `titleRuns` keeps working. `prefix: 'cx'`
	 * ignores this field: ChartEx titles are out of scope (see the module
	 * doc on `chart-title-runs-parser.ts`).
	 */
	titleRuns?: PptxChartTitleRun[];
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

/** Collect every `a:t` text value under `node`, walking depth-first, in document order. */
function collectAllText(node: XmlObject, getLocalName: GetLocalName, out: string[]): void {
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const value = node[key];
		const children = Array.isArray(value) ? value : [value];
		if (getLocalName(key) === 't') {
			for (const child of children) {
				if (child === undefined || child === null) {
					continue;
				}
				out.push(
					typeof child === 'object' ? String((child as XmlObject)['#text'] ?? '') : String(child),
				);
			}
			continue;
		}
		for (const child of children) {
			if (child && typeof child === 'object') {
				collectAllText(child as XmlObject, getLocalName, out);
			}
		}
	}
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

/** Build one run's `a:rPr` from its typed bold/italic/size/color, or `undefined` when none is set. */
function buildRunProperties(run: PptxChartTitleRun): XmlObject | undefined {
	const rPr: XmlObject = {};
	if (run.bold !== undefined) {
		rPr['@_b'] = run.bold ? '1' : '0';
	}
	if (run.italic !== undefined) {
		rPr['@_i'] = run.italic ? '1' : '0';
	}
	if (run.fontSize !== undefined) {
		rPr['@_sz'] = String(Math.round(run.fontSize * 100));
	}
	if (run.color) {
		rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': run.color.replace(/^#/u, '').toUpperCase() } };
	}
	return Object.keys(rPr).length > 0 ? rPr : undefined;
}

/** A fresh rich-text `tx` block carrying one run per `PptxChartTitleRun`. */
function buildTitleTextFromRuns(prefix: 'c' | 'cx', runs: PptxChartTitleRun[]): XmlObject {
	const runNodes = runs.map((run): XmlObject => {
		const rPr = buildRunProperties(run);
		return { ...(rPr ? { 'a:rPr': rPr } : {}), 'a:t': run.text };
	});
	const paragraph: XmlObject = { 'a:r': runNodes.length === 1 ? runNodes[0] : runNodes };
	const rich: XmlObject =
		prefix === 'c' ? { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': paragraph } : { 'a:p': paragraph };
	const tx: XmlObject = {};
	tx[`${prefix}:rich`] = rich;
	return tx;
}

/** A fresh title node (schema order: tx, then overlay for the 2006 model). */
function buildTitleNode(
	prefix: 'c' | 'cx',
	text: string | undefined,
	runs: PptxChartTitleRun[] | undefined,
): XmlObject {
	const node: XmlObject = {};
	if (runs && runs.length > 0) {
		node[`${prefix}:tx`] = buildTitleTextFromRuns(prefix, runs);
	} else if (text !== undefined) {
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

	// ChartEx titles are out of scope for the multi-run path (see
	// `ChartTitleModel.titleRuns`'s doc). Also ignored when `title` has
	// diverged from `titleRuns`' FIRST run (the parser always sets `title` to
	// just the first run's text, matching `replaceFirstText`'s own single-run
	// semantics; the joined text of every run is a DIFFERENT string whenever
	// there is more than one run, so comparing against that would treat a
	// perfectly in-sync pair as stale). `titleRuns` is populated on every
	// load (even a trivial single-run title), so a caller that edits only
	// the flat `title` field - every pre-existing consumer, since
	// `titleRuns` did not exist before this field was added - would
	// otherwise have that edit silently overwritten by the stale, unedited
	// `titleRuns` on save. Diverged `title` is treated as the caller's
	// explicit intent to replace the (possibly richer) run data with plain
	// text, exactly like `replaceFirstText` already does for the existing
	// single-run case below.
	const runsFirstText = model.titleRuns?.[0]?.text;
	const runsStale =
		model.title !== undefined && runsFirstText !== undefined && model.title !== runsFirstText;
	let runs =
		prefix === 'c' && model.titleRuns && model.titleRuns.length > 0 && !runsStale
			? model.titleRuns
			: undefined;

	let titleNode = existingKey ? (chartRoot[existingKey] as XmlObject | undefined) : undefined;

	// An untouched multi-run title (every run's TEXT matches what is already
	// authored, in order) skips the rebuild entirely: rebuilding from the
	// narrow `PptxChartTitleRun` shape only re-emits bold/italic/size/color
	// as a literal `a:srgbClr`, which would silently downgrade an authored
	// `a:schemeClr` theme reference (or drop an attribute this type does not
	// model, e.g. `a:latin`) on every save even when nothing changed. Falling
	// through to the single-run `replaceFirstText` path below is a genuine
	// no-op here (it rewrites the first run's text to the SAME value) and
	// leaves every other run - and its formatting - byte-identical.
	if (runs && titleNode && typeof titleNode === 'object') {
		const existingTexts: string[] = [];
		collectAllText(titleNode, getLocalName, existingTexts);
		const newTexts = runs.map((run) => run.text);
		if (
			existingTexts.length === newTexts.length &&
			existingTexts.every((text, index) => text === newTexts[index])
		) {
			runs = undefined;
		}
	}
	if (!titleNode || typeof titleNode !== 'object') {
		titleNode = buildTitleNode(prefix, model.title, runs);
		if (existingKey) {
			chartRoot[existingKey] = titleNode;
		} else {
			insertAt(chartRoot, 0, `${prefix}:title`, titleNode);
		}
	} else if (runs) {
		// Multi-run text REPLACES the whole rich body rather than patching the
		// first run in place, since a prior save may have had a different
		// number of runs.
		const txKey = findKey(titleNode, 'tx', getLocalName);
		if (txKey) {
			titleNode[txKey] = buildTitleTextFromRuns(prefix, runs);
		} else {
			insertAt(titleNode, 0, `${prefix}:tx`, buildTitleTextFromRuns(prefix, runs));
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
