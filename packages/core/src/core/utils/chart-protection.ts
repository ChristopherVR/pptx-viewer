import type { PptxChartProtection, XmlObject } from '../types';
import { cloneXmlObject } from './clone-utils';

type LocalName = (key: string) => string;
const CX_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const FIELDS = ['chartObject', 'data', 'formatting', 'selection', 'userInterface'] as const;
type ProtectionField = (typeof FIELDS)[number];

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

function qualified(prefix: string, name: string): string {
	return prefix ? `${prefix}:${name}` : name;
}

function isCxChartSpace(chartSpace: XmlObject): boolean {
	return Object.entries(chartSpace).some(
		([key, value]) => key.startsWith('@_xmlns') && value === CX_NAMESPACE,
	);
}

function parseBoolean(node: XmlObject): boolean | undefined {
	const raw = node['@_val'];
	if (raw === undefined) {
		return true;
	}
	if (raw === '1' || raw === 'true') {
		return true;
	}
	if (raw === '0' || raw === 'false') {
		return false;
	}
	return undefined;
}

/** Parse classic ChartML protection with the CT_Boolean default of true. */
export function parseChartProtection(
	chartSpace: XmlObject | undefined,
	localName: LocalName,
): PptxChartProtection | undefined {
	if (chartSpace && isCxChartSpace(chartSpace)) {
		return undefined;
	}
	const protectionKey = keyOf(chartSpace, 'protection', localName);
	const value = protectionKey ? chartSpace?.[protectionKey] : undefined;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const node = value as XmlObject;
	const result: PptxChartProtection = { rawXml: cloneXmlObject(node) ?? {} };
	for (const field of FIELDS) {
		const childKey = keyOf(node, field, localName);
		const child = childKey ? node[childKey] : undefined;
		if (child && typeof child === 'object' && !Array.isArray(child)) {
			const parsed = parseBoolean(child as XmlObject);
			if (parsed !== undefined) {
				result[field] = parsed;
			}
		} else if (childKey) {
			result[field] = true;
		}
	}
	return result;
}

function applyField(
	node: XmlObject,
	field: ProtectionField,
	value: boolean | null | undefined,
	prefix: string,
	localName: LocalName,
): void {
	if (value === undefined) {
		return;
	}
	const existingKey = keyOf(node, field, localName);
	if (value === null) {
		if (existingKey) {
			delete node[existingKey];
		}
		return;
	}
	const key = existingKey ?? qualified(prefix, field);
	const existing = existingKey ? node[existingKey] : undefined;
	if (existingKey && existing === '' && value) {
		return;
	}
	if (
		existing &&
		typeof existing === 'object' &&
		!Array.isArray(existing) &&
		parseBoolean(existing as XmlObject) === value
	) {
		return;
	}
	const child =
		existing && typeof existing === 'object' && !Array.isArray(existing)
			? (existing as XmlObject)
			: {};
	child['@_val'] = value ? '1' : '0';
	node[key] = child;
}

function reorderKnownChildren(node: XmlObject, localName: LocalName): void {
	const entries = Object.entries(node);
	const attributes = entries.filter(([key]) => key.startsWith('@_') || key === '#text');
	const known = FIELDS.flatMap((field) => entries.filter(([key]) => localName(key) === field));
	const foreign = entries.filter(
		([key]) =>
			!key.startsWith('@_') &&
			key !== '#text' &&
			!FIELDS.includes(localName(key) as ProtectionField),
	);
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const [key, value] of [...attributes, ...known, ...foreign]) {
		node[key] = value;
	}
}

/** Apply, create, or remove classic ChartML protection in schema order. */
export function applyChartProtection(
	chartSpace: XmlObject,
	value: PptxChartProtection | null,
	localName: LocalName,
): void {
	if (isCxChartSpace(chartSpace)) {
		return;
	}
	const protectionKey = keyOf(chartSpace, 'protection', localName);
	if (value === null) {
		if (protectionKey) {
			delete chartSpace[protectionKey];
		}
		return;
	}
	const existing = protectionKey ? chartSpace[protectionKey] : undefined;
	const node =
		value.rawXml !== undefined
			? (cloneXmlObject(value.rawXml) ?? {})
			: existing && typeof existing === 'object' && !Array.isArray(existing)
				? (existing as XmlObject)
				: {};
	const chartKey = keyOf(chartSpace, 'chart', localName);
	const prefix = prefixOf(protectionKey ?? chartKey) || 'c';
	for (const field of FIELDS) {
		applyField(node, field, value[field], prefix, localName);
	}
	reorderKnownChildren(node, localName);
	if (protectionKey) {
		chartSpace[protectionKey] = node;
		return;
	}
	const entries = Object.entries(chartSpace);
	for (const key of Object.keys(chartSpace)) {
		delete chartSpace[key];
	}
	let inserted = false;
	for (const [key, child] of entries) {
		if (!inserted && localName(key) === 'chart') {
			chartSpace[qualified(prefix, 'protection')] = node;
			inserted = true;
		}
		chartSpace[key] = child;
	}
	if (!inserted) {
		chartSpace[qualified(prefix, 'protection')] = node;
	}
}

/** Add protection to the object tree produced for a new classic chart part. */
export function applyGeneratedChartProtection(
	tree: XmlObject,
	value: PptxChartProtection | null | undefined,
): void {
	const chartSpace = tree['c:chartSpace'];
	if (!value || !chartSpace || typeof chartSpace !== 'object' || Array.isArray(chartSpace)) {
		return;
	}
	applyChartProtection(chartSpace as XmlObject, value, (key) => key.replace(/^.*:/u, ''));
}
