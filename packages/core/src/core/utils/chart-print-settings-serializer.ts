import type {
	PptxChartPageMargins,
	PptxChartPageSetup,
	PptxChartPrintHeaderFooter,
	PptxChartPrintSettings,
	XmlObject,
} from '../types';
import { cloneXmlObject } from './clone-utils';

type LocalName = (key: string) => string;
const HEADER_CHILDREN = [
	'oddHeader',
	'oddFooter',
	'evenHeader',
	'evenFooter',
	'firstHeader',
	'firstFooter',
] as const;
const PRINT_CHILDREN = ['headerFooter', 'pageMargins', 'pageSetup', 'legacyDrawingHF'] as const;
const ORIENTATIONS = new Set(['default', 'portrait', 'landscape']);

function keyOf(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): string | undefined {
	return node ? Object.keys(node).find((key) => localName(key) === name) : undefined;
}

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	const key = keyOf(node, name, localName);
	const value = key ? node?.[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function prefixOf(key: string | undefined): string {
	return key?.includes(':') ? key.slice(0, key.lastIndexOf(':')) : '';
}

function qualified(prefix: string, name: string): string {
	return prefix ? `${prefix}:${name}` : name;
}

function assertInteger(name: string, value: number, min: number, max: number): void {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`${name} must be an integer from ${min} through ${max}`);
	}
}

function setAttr(
	node: XmlObject,
	name: string,
	value: string | number | boolean | undefined,
): void {
	if (value === undefined) {
		delete node[`@_${name}`];
	} else {
		node[`@_${name}`] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
	}
}

function replaceChildrenInOrder(
	node: XmlObject,
	names: readonly string[],
	localName: LocalName,
): void {
	const entries = Object.entries(node);
	const attributes = entries.filter(([key]) => key.startsWith('@_') || key === '#text');
	const known = names.flatMap((name) => entries.filter(([key]) => localName(key) === name));
	const unknown = entries.filter(
		([key]) => !key.startsWith('@_') && key !== '#text' && !names.includes(localName(key)),
	);
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const [key, value] of [...attributes, ...known, ...unknown]) {
		node[key] = value;
	}
}

function applyHeaderFooter(
	existing: XmlObject | undefined,
	value: PptxChartPrintHeaderFooter,
	localName: LocalName,
	prefix: string,
): XmlObject {
	const node = cloneXmlObject(existing) ?? cloneXmlObject(value.rawXml as XmlObject) ?? {};
	for (const name of HEADER_CHILDREN) {
		const oldKey = keyOf(node, name, localName);
		if (value[name] === undefined) {
			if (oldKey) {
				delete node[oldKey];
			}
		} else {
			node[oldKey ?? qualified(prefix, name)] = { '#text': value[name] };
		}
	}
	for (const name of ['alignWithMargins', 'differentOddEven', 'differentFirst'] as const) {
		setAttr(node, name, value[name]);
	}
	replaceChildrenInOrder(node, HEADER_CHILDREN, localName);
	return node;
}

function applyMargins(existing: XmlObject | undefined, value: PptxChartPageMargins): XmlObject {
	const node = cloneXmlObject(existing) ?? cloneXmlObject(value.rawXml as XmlObject) ?? {};
	const values = [value.left, value.right, value.top, value.bottom, value.header, value.footer];
	if (values.some((entry) => !Number.isFinite(entry))) {
		throw new RangeError('page margins must be finite');
	}
	for (const [attributeName, entry] of ['l', 'r', 't', 'b', 'header', 'footer'].map(
		(marginName, index) => [marginName, values[index]] as const,
	)) {
		setAttr(node, attributeName, entry);
	}
	return node;
}

function applyPageSetup(existing: XmlObject | undefined, value: PptxChartPageSetup): XmlObject {
	const node = cloneXmlObject(existing) ?? cloneXmlObject(value.rawXml as XmlObject) ?? {};
	for (const name of ['paperSize', 'firstPageNumber', 'copies'] as const) {
		if (value[name] !== undefined) {
			assertInteger(name, value[name], 0, 0xffffffff);
		}
		setAttr(node, name, value[name]);
	}
	for (const name of ['horizontalDpi', 'verticalDpi'] as const) {
		if (value[name] !== undefined) {
			assertInteger(name, value[name], -0x80000000, 0x7fffffff);
		}
		setAttr(node, name, value[name]);
	}
	if (value.orientation !== undefined && !ORIENTATIONS.has(value.orientation)) {
		throw new RangeError('orientation must be default, portrait, or landscape');
	}
	setAttr(node, 'orientation', value.orientation);
	for (const name of ['blackAndWhite', 'draft', 'useFirstPageNumber'] as const) {
		setAttr(node, name, value[name]);
	}
	return node;
}

function setChild(
	node: XmlObject,
	name: string,
	value: XmlObject | null,
	localName: LocalName,
	prefix: string,
): void {
	const oldKey = keyOf(node, name, localName);
	if (value === null) {
		if (oldKey) {
			delete node[oldKey];
		}
	} else {
		node[oldKey ?? qualified(prefix, name)] = value;
	}
}

/** Apply, create, or remove classic ChartML CT_PrintSettings in schema order. */
export function applyChartPrintSettings(
	chartSpace: XmlObject,
	settings: PptxChartPrintSettings | null,
	localName: LocalName,
): void {
	const rootKey = keyOf(chartSpace, 'printSettings', localName);
	if (settings === null) {
		if (rootKey) {
			delete chartSpace[rootKey];
		}
		return;
	}
	const existing = rootKey ? (chartSpace[rootKey] as XmlObject) : undefined;
	const node = cloneXmlObject(existing) ?? cloneXmlObject(settings.rawXml as XmlObject) ?? {};
	const prefix = prefixOf(rootKey ?? keyOf(chartSpace, 'chart', localName)) || 'c';
	if (settings.headerFooter !== undefined) {
		setChild(
			node,
			'headerFooter',
			settings.headerFooter === null
				? null
				: applyHeaderFooter(
						child(node, 'headerFooter', localName),
						settings.headerFooter,
						localName,
						prefix,
					),
			localName,
			prefix,
		);
	}
	if (settings.pageMargins !== undefined) {
		setChild(
			node,
			'pageMargins',
			settings.pageMargins === null
				? null
				: applyMargins(child(node, 'pageMargins', localName), settings.pageMargins),
			localName,
			prefix,
		);
	}
	if (settings.pageSetup !== undefined) {
		setChild(
			node,
			'pageSetup',
			settings.pageSetup === null
				? null
				: applyPageSetup(child(node, 'pageSetup', localName), settings.pageSetup),
			localName,
			prefix,
		);
	}
	if (settings.legacyDrawingHeaderFooterRelationshipId !== undefined) {
		if (settings.legacyDrawingHeaderFooterRelationshipId === null) {
			setChild(node, 'legacyDrawingHF', null, localName, prefix);
		} else {
			const legacy = cloneXmlObject(child(node, 'legacyDrawingHF', localName)) ?? {};
			const idKey = Object.keys(legacy).find(
				(key) => key.startsWith('@_') && localName(key) === 'id',
			);
			legacy[idKey ?? '@_r:id'] = settings.legacyDrawingHeaderFooterRelationshipId;
			setChild(node, 'legacyDrawingHF', legacy, localName, prefix);
		}
	}
	replaceChildrenInOrder(node, PRINT_CHILDREN, localName);
	if (rootKey) {
		chartSpace[rootKey] = node;
	} else {
		insertPrintSettings(chartSpace, node, prefix, localName);
	}
}

function insertPrintSettings(
	chartSpace: XmlObject,
	node: XmlObject,
	prefix: string,
	localName: LocalName,
): void {
	const entries = Object.entries(chartSpace);
	for (const key of Object.keys(chartSpace)) {
		delete chartSpace[key];
	}
	let inserted = false;
	for (const [key, value] of entries) {
		if (!inserted && ['userShapes', 'extLst'].includes(localName(key))) {
			chartSpace[qualified(prefix, 'printSettings')] = node;
			inserted = true;
		}
		chartSpace[key] = value;
	}
	if (!inserted) {
		chartSpace[qualified(prefix, 'printSettings')] = node;
	}
}
