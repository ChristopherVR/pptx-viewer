/**
 * Per-series helpers for the in-place ChartEx save update: name, fill, data
 * labels and the `cx:data` binding of one `cx:series` node.
 *
 * @module runtime/chart-cx-update-series
 */

import type { PptxChartData, PptxChartSeries, XmlObject } from '../../types';
import {
	buildChartExData,
	buildChartExDataLabels,
	buildChartExSeriesFill,
} from '../../utils/chart-cx-generator';
import { replaceChartExDataDimensions } from './chart-cx-update-data';

export type GetLocalName = (key: string) => string;

export function findKey(node: XmlObject, localName: string, getLocalName: GetLocalName) {
	return Object.keys(node).find((key) => getLocalName(key) === localName);
}

export function child(
	node: XmlObject | undefined,
	localName: string,
	getLocalName: GetLocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = findKey(node, localName, getLocalName);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

export function asArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]).filter(
		(entry): entry is XmlObject => Boolean(entry) && typeof entry === 'object',
	);
}

/** Insert `key: value` before the first child whose local name is in `before`. */
export function insertBefore(
	parent: XmlObject,
	key: string,
	value: XmlObject[string],
	before: string[],
	getLocalName: GetLocalName,
): void {
	const entries = Object.keys(parent).map((k) => [k, parent[k]] as const);
	let index = entries.findIndex(([k]) => !k.startsWith('@_') && before.includes(getLocalName(k)));
	if (index === -1) {
		index = entries.length;
	}
	entries.splice(index, 0, [key, value] as const);
	for (const k of Object.keys(parent)) {
		delete parent[k];
	}
	for (const [k, v] of entries) {
		parent[k] = v;
	}
}

/** Everything that may follow `cx:tx` in `CT_Series`. */
const AFTER_TX = [
	'spPr',
	'valueColors',
	'valueColorPositions',
	'dataPt',
	'dataLabels',
	'dataId',
	'layoutPr',
	'axisId',
	'extLst',
];

export function applySeriesName(node: XmlObject, name: string, getLocalName: GetLocalName): void {
	const tx = child(node, 'tx', getLocalName);
	const txData = child(tx, 'txData', getLocalName);
	if (tx && txData) {
		const vKey = findKey(txData, 'v', getLocalName) ?? 'cx:v';
		txData[vKey] = name;
		return;
	}
	const txKey = findKey(node, 'tx', getLocalName);
	if (txKey) {
		delete node[txKey];
	}
	insertBefore(node, 'cx:tx', { 'cx:txData': { 'cx:v': name } }, AFTER_TX, getLocalName);
}

const FILL_KINDS = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'];
const AFTER_FILL = ['ln', 'effectLst', 'effectDag', 'scene3d', 'sp3d', 'extLst'];

function currentSeriesColor(node: XmlObject, getLocalName: GetLocalName): string | undefined {
	const srgb = child(
		child(child(node, 'spPr', getLocalName), 'solidFill', getLocalName),
		'srgbClr',
		getLocalName,
	);
	const value = srgb?.['@_val'];
	return typeof value === 'string' ? value.toUpperCase() : undefined;
}

/** Only touches `cx:spPr` when the model colour differs from the saved one. */
export function applySeriesColor(
	node: XmlObject,
	series: PptxChartSeries,
	getLocalName: GetLocalName,
): void {
	const fill = buildChartExSeriesFill(series);
	if (!fill) {
		return;
	}
	const wanted = series.color?.replace(/^#/u, '').toUpperCase();
	if (wanted === currentSeriesColor(node, getLocalName)) {
		return;
	}
	const spPr = child(node, 'spPr', getLocalName);
	if (!spPr) {
		insertBefore(node, 'cx:spPr', fill, AFTER_TX.slice(1), getLocalName);
		return;
	}
	for (const key of Object.keys(spPr)) {
		if (FILL_KINDS.includes(getLocalName(key))) {
			delete spPr[key];
		}
	}
	insertBefore(spPr, 'a:solidFill', fill['a:solidFill'], AFTER_FILL, getLocalName);
}

export function applySeriesDataLabels(
	node: XmlObject,
	hasDataLabels: boolean | undefined,
	getLocalName: GetLocalName,
): void {
	if (hasDataLabels === undefined) {
		return;
	}
	const key = findKey(node, 'dataLabels', getLocalName);
	if (!hasDataLabels) {
		if (key) {
			delete node[key];
		}
		return;
	}
	if (!key) {
		insertBefore(
			node,
			'cx:dataLabels',
			buildChartExDataLabels(),
			['dataId', 'layoutPr', 'axisId', 'extLst'],
			getLocalName,
		);
	}
}

export function nextDataId(dataNodes: XmlObject[]): number {
	let max = -1;
	for (const node of dataNodes) {
		const id = Number.parseInt(String(node['@_id'] ?? ''), 10);
		if (Number.isFinite(id) && id > max) {
			max = id;
		}
	}
	return max + 1;
}

/** Bind `node` to `dataNodes`: refresh its referenced data, or attach fresh data. */
export function bindSeriesData(
	node: XmlObject,
	dataNodes: XmlObject[],
	chartData: PptxChartData,
	series: PptxChartSeries,
	getLocalName: GetLocalName,
): void {
	const dataIdNode = child(node, 'dataId', getLocalName);
	const dataId = dataIdNode ? String(dataIdNode['@_val'] ?? '') : undefined;
	const referenced =
		dataId !== undefined ? dataNodes.find((data) => String(data['@_id']) === dataId) : undefined;
	if (referenced) {
		replaceChartExDataDimensions(
			referenced,
			buildChartExData(chartData, series, Number(dataId)),
			getLocalName,
		);
		return;
	}
	const inlineKey = findKey(node, 'data', getLocalName);
	if (inlineKey && !dataIdNode) {
		const inline = node[inlineKey];
		if (inline && typeof inline === 'object' && !Array.isArray(inline)) {
			replaceChartExDataDimensions(
				inline as XmlObject,
				buildChartExData(chartData, series, 0),
				getLocalName,
			);
			return;
		}
	}
	const id = nextDataId(dataNodes);
	dataNodes.push(buildChartExData(chartData, series, id));
	if (dataIdNode) {
		dataIdNode['@_val'] = String(id);
	} else {
		insertBefore(
			node,
			'cx:dataId',
			{ '@_val': String(id) },
			['layoutPr', 'axisId', 'extLst'],
			getLocalName,
		);
	}
}
