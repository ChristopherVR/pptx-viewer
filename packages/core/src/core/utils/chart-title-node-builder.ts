/**
 * Builders for a fresh chart title node's rich-text body (`c:tx`/`cx:tx`),
 * either as a single plain-text run or as one run per `PptxChartTitleRun`
 * (each carrying its own bold/italic/size/color).
 *
 * Split out of `chart-title-serializer.ts` to keep that file under the
 * repo's 300-LOC limit; `applyChartTitleToXml` is the only caller.
 *
 * @module utils/chart-title-node-builder
 */

import type { PptxChartTitleRun, XmlObject } from '../types';

/** A fresh rich-text `tx` block carrying a single run. */
export function buildTitleText(prefix: 'c' | 'cx', text: string): XmlObject {
	const rich: XmlObject =
		prefix === 'c'
			? { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': { 'a:r': { 'a:t': text } } }
			: { 'a:p': { 'a:r': { 'a:t': text } } };
	const tx: XmlObject = {};
	tx[`${prefix}:rich`] = rich;
	return tx;
}

/** Build one run's `a:rPr` from its typed bold/italic/size/color, or `undefined` when none is set. */
export function buildRunProperties(run: PptxChartTitleRun): XmlObject | undefined {
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
export function buildTitleTextFromRuns(prefix: 'c' | 'cx', runs: PptxChartTitleRun[]): XmlObject {
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
export function buildTitleNode(
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
