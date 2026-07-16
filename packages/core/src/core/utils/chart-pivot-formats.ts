import type { PptxChartPivotFormat, PptxChartPivotFormats, XmlObject } from '../types';
import { cloneXmlObject } from './clone-utils';

type LocalName = (key: string) => string;
const MAX_UINT = 4_294_967_295;
const CHILDREN = ['idx', 'spPr', 'marker', 'dLbl', 'extLst'] as const;
const ROOT_FOLLOWERS = ['view3D', 'floor', 'sideWall', 'backWall', 'plotArea'];

function keyOf(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): string | undefined {
	return node ? Object.keys(node).find((key) => localName(key) === name) : undefined;
}

function prefixOf(key: string | undefined): string {
	return key?.includes(':') ? key.slice(0, key.lastIndexOf(':')) : '';
}

function nodesOf(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = keyOf(node, name, localName);
	const value = key ? node[key] : undefined;
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values.filter(
		(item): item is XmlObject => typeof item === 'object' && !Array.isArray(item),
	);
}

function unsigned(value: unknown): number | undefined {
	if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
		return undefined;
	}
	const result = Number(value);
	return Number.isSafeInteger(result) && result <= MAX_UINT ? result : undefined;
}

function cloneChild(node: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	const key = keyOf(node, name, localName);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? cloneXmlObject(value as XmlObject)
		: undefined;
}

export function parseChartPivotFormats(
	chart: XmlObject | undefined,
	localName: LocalName,
): PptxChartPivotFormats | undefined {
	const rootKey = keyOf(chart, 'pivotFmts', localName);
	const value = rootKey ? chart?.[rootKey] : undefined;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const root = value as XmlObject;
	const formats: PptxChartPivotFormat[] = [];
	for (const node of nodesOf(root, 'pivotFmt', localName)) {
		const idxKey = keyOf(node, 'idx', localName);
		const idxNode = idxKey ? node[idxKey] : undefined;
		const index =
			idxNode && typeof idxNode === 'object' && !Array.isArray(idxNode)
				? unsigned((idxNode as XmlObject)['@_val'])
				: undefined;
		if (index === undefined) {
			continue;
		}
		formats.push({
			index,
			shapePropertiesXml: cloneChild(node, 'spPr', localName),
			markerXml: cloneChild(node, 'marker', localName),
			dataLabelXml: cloneChild(node, 'dLbl', localName),
			extensionListXml: cloneChild(node, 'extLst', localName),
			rawXml: cloneXmlObject(node) ?? {},
		});
	}
	return formats.length ? { formats, rawXml: cloneXmlObject(root) ?? {} } : undefined;
}

function setChild(
	node: XmlObject,
	name: string,
	value: XmlObject | null | undefined,
	prefix: string,
	localName: LocalName,
): void {
	if (value === undefined) {
		return;
	}
	const key = keyOf(node, name, localName);
	if (value === null) {
		if (key) {
			delete node[key];
		}
	} else {
		node[key ?? `${prefix}:${name}`] = cloneXmlObject(value) ?? {};
	}
}

function buildFormat(value: PptxChartPivotFormat, prefix: string, localName: LocalName): XmlObject {
	if (!Number.isInteger(value.index) || value.index < 0 || value.index > MAX_UINT) {
		throw new RangeError(`pivotFmt.index must be an integer from 0 through ${MAX_UINT}`);
	}
	const node = cloneXmlObject(value.rawXml) ?? {};
	const idxKey = keyOf(node, 'idx', localName) ?? `${prefix}:idx`;
	const idxValue = node[idxKey];
	const idx = idxValue && typeof idxValue === 'object' && !Array.isArray(idxValue) ? idxValue : {};
	(idx as XmlObject)['@_val'] = String(value.index);
	node[idxKey] = idx;
	setChild(node, 'spPr', value.shapePropertiesXml, prefix, localName);
	setChild(node, 'marker', value.markerXml, prefix, localName);
	setChild(node, 'dLbl', value.dataLabelXml, prefix, localName);
	setChild(node, 'extLst', value.extensionListXml, prefix, localName);
	const entries = Object.entries(node);
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const name of CHILDREN) {
		for (const [key, child] of entries) {
			if (localName(key) === name) {
				node[key] = child;
			}
		}
	}
	for (const [key, child] of entries) {
		if (!CHILDREN.includes(localName(key) as never)) {
			node[key] = child;
		}
	}
	return node;
}

export function applyChartPivotFormats(
	chart: XmlObject,
	value: PptxChartPivotFormats | null,
	localName: LocalName,
): void {
	const rootKey = keyOf(chart, 'pivotFmts', localName);
	if (value === null) {
		if (rootKey) {
			delete chart[rootKey];
		}
		return;
	}
	if (!value.formats.length) {
		throw new RangeError('pivotFormats.formats must not be empty');
	}
	const prefix = prefixOf(rootKey ?? keyOf(chart, 'plotArea', localName)) || 'c';
	const root = cloneXmlObject(value.rawXml) ?? {};
	const itemKey = keyOf(root, 'pivotFmt', localName) ?? `${prefix}:pivotFmt`;
	root[itemKey] = value.formats.map((item) => buildFormat(item, prefix, localName));
	if (rootKey) {
		chart[rootKey] = root;
		return;
	}
	const entries = Object.entries(chart);
	for (const key of Object.keys(chart)) {
		delete chart[key];
	}
	let inserted = false;
	for (const [key, child] of entries) {
		if (!inserted && ROOT_FOLLOWERS.includes(localName(key))) {
			chart[`${prefix}:pivotFmts`] = root;
			inserted = true;
		}
		chart[key] = child;
	}
	if (!inserted) {
		chart[`${prefix}:pivotFmts`] = root;
	}
}
