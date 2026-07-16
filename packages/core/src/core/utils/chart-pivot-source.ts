import type { PptxChartPivotSource, XmlObject } from '../types';
import { cloneXmlObject } from './clone-utils';

type LocalName = (key: string) => string;
const MAX_UINT = 4_294_967_295;
const CHILDREN = ['name', 'fmtId', 'extLst'] as const;

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

function textOf(value: XmlObject[string]): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const text = (value as XmlObject)['#text'];
		return typeof text === 'string' ? text : undefined;
	}
	return undefined;
}

function parseUnsigned(value: unknown): number | undefined {
	if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed <= MAX_UINT ? parsed : undefined;
}

export function parseChartPivotSource(
	chartSpace: XmlObject | undefined,
	localName: LocalName,
): PptxChartPivotSource | undefined {
	const rootKey = keyOf(chartSpace, 'pivotSource', localName);
	const value = rootKey ? chartSpace?.[rootKey] : undefined;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const node = value as XmlObject;
	const nameKey = keyOf(node, 'name', localName);
	const fmtKey = keyOf(node, 'fmtId', localName);
	const name = nameKey ? textOf(node[nameKey]) : undefined;
	const fmtNode = fmtKey ? node[fmtKey] : undefined;
	const formatId =
		fmtNode && typeof fmtNode === 'object' && !Array.isArray(fmtNode)
			? parseUnsigned((fmtNode as XmlObject)['@_val'])
			: undefined;
	if (name === undefined || formatId === undefined) {
		return undefined;
	}
	return { name, formatId, rawXml: cloneXmlObject(node) ?? {} };
}

function reorder(node: XmlObject, localName: LocalName): void {
	const entries = Object.entries(node);
	const attrs = entries.filter(([key]) => key.startsWith('@_') || key === '#text');
	const known = CHILDREN.flatMap((name) => entries.filter(([key]) => localName(key) === name));
	const foreign = entries.filter(
		([key]) =>
			!key.startsWith('@_') && key !== '#text' && !CHILDREN.includes(localName(key) as never),
	);
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const [key, value] of [...attrs, ...known, ...foreign]) {
		node[key] = value;
	}
}

export function applyChartPivotSource(
	chartSpace: XmlObject,
	value: PptxChartPivotSource | null,
	localName: LocalName,
): void {
	const rootKey = keyOf(chartSpace, 'pivotSource', localName);
	if (value === null) {
		if (rootKey) {
			delete chartSpace[rootKey];
		}
		return;
	}
	if (!Number.isInteger(value.formatId) || value.formatId < 0 || value.formatId > MAX_UINT) {
		throw new RangeError(`pivotSource.formatId must be an integer from 0 through ${MAX_UINT}`);
	}
	const existing = rootKey ? chartSpace[rootKey] : undefined;
	const node = value.rawXml
		? (cloneXmlObject(value.rawXml) ?? {})
		: existing && typeof existing === 'object' && !Array.isArray(existing)
			? (existing as XmlObject)
			: {};
	const chartKey = keyOf(chartSpace, 'chart', localName);
	const prefix = prefixOf(rootKey ?? chartKey) || 'c';
	const nameKey = keyOf(node, 'name', localName) ?? `${prefix}:name`;
	const nameNode = node[nameKey];
	if (textOf(nameNode) !== value.name) {
		if (nameNode && typeof nameNode === 'object' && !Array.isArray(nameNode)) {
			(nameNode as XmlObject)['#text'] = value.name;
		} else {
			node[nameKey] = { '#text': value.name };
		}
	}
	const fmtKey = keyOf(node, 'fmtId', localName) ?? `${prefix}:fmtId`;
	const fmtValue = node[fmtKey];
	const fmtNode =
		fmtValue && typeof fmtValue === 'object' && !Array.isArray(fmtValue)
			? (fmtValue as XmlObject)
			: {};
	if (parseUnsigned(fmtNode['@_val']) !== value.formatId) {
		fmtNode['@_val'] = String(value.formatId);
	}
	node[fmtKey] = fmtNode;
	reorder(node, localName);
	if (rootKey) {
		chartSpace[rootKey] = node;
		return;
	}
	const entries = Object.entries(chartSpace);
	for (const key of Object.keys(chartSpace)) {
		delete chartSpace[key];
	}
	let inserted = false;
	for (const [key, child] of entries) {
		if (!inserted && ['protection', 'chart'].includes(localName(key))) {
			chartSpace[`${prefix}:pivotSource`] = node;
			inserted = true;
		}
		chartSpace[key] = child;
	}
	if (!inserted) {
		chartSpace[`${prefix}:pivotSource`] = node;
	}
}
