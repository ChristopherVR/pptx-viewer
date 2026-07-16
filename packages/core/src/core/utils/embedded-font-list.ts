import type {
	PptxEmbeddedFontDataId,
	PptxEmbeddedFontDescriptor,
	PptxEmbeddedFontList,
	PptxEmbeddedFontListEntry,
	XmlObject,
} from '../types';

const ENTRY_ORDER = ['font', 'regular', 'bold', 'italic', 'boldItalic'] as const;
const PRESENTATION_BEFORE = new Set([
	'sldMasterIdLst',
	'notesMasterIdLst',
	'handoutMasterIdLst',
	'sldIdLst',
	'sldSz',
	'notesSz',
	'smartTags',
]);

const localName = (key: string): string => key.replace(/^@_/u, '').replace(/^.*:/u, '');
const findKey = (node: XmlObject, name: string): string | undefined =>
	Object.keys(node).find((key) => localName(key) === name);
const child = (node: XmlObject, name: string): XmlObject | undefined => {
	const key = findKey(node, name);
	return key ? (node[key] as XmlObject | undefined) : undefined;
};
const children = (node: XmlObject, name: string): XmlObject[] => {
	const key = findKey(node, name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value) ? value : value ? [value as XmlObject] : [];
};

function parseDataId(node: XmlObject | undefined): PptxEmbeddedFontDataId | undefined {
	return node ? { relationshipId: node['@_r:id'], rawXml: node } : undefined;
}

function parseDescriptor(node: XmlObject | undefined): PptxEmbeddedFontDescriptor {
	return {
		typeface: node?.['@_typeface'],
		panose: node?.['@_panose'],
		pitchFamily: node?.['@_pitchFamily'],
		charset: node?.['@_charset'],
		rawXml: node,
	};
}

export function parseEmbeddedFontList(
	presentationData: XmlObject | null | undefined,
): PptxEmbeddedFontList | undefined {
	if (!presentationData) {
		return undefined;
	}
	const rootKey = Object.keys(presentationData).find((key) => localName(key) === 'presentation');
	const root = rootKey ? (presentationData[rootKey] as XmlObject | undefined) : undefined;
	const list = root ? child(root, 'embeddedFontLst') : undefined;
	if (!list) {
		return undefined;
	}

	return {
		fonts: children(list, 'embeddedFont').map((entry) => ({
			font: parseDescriptor(child(entry, 'font')),
			regular: parseDataId(child(entry, 'regular')),
			bold: parseDataId(child(entry, 'bold')),
			italic: parseDataId(child(entry, 'italic')),
			boldItalic: parseDataId(child(entry, 'boldItalic')),
			rawXml: entry,
		})),
		rawXml: list,
	};
}

function applyAttribute(node: XmlObject, name: string, value: string | null | undefined): void {
	const key = findKey(node, name);
	if (value === null) {
		if (key) {
			delete node[key];
		}
	} else if (value !== undefined) {
		node[key ?? `@_${name}`] = value;
	}
}

function serializeDataId(data: PptxEmbeddedFontDataId): XmlObject {
	const node = { ...(data.rawXml ?? {}) } as XmlObject;
	if (!data.rawXml && !data.relationshipId) {
		throw new Error('CT_EmbeddedFontDataId requires a non-empty r:id');
	}
	if (data.relationshipId === '') {
		throw new Error('CT_EmbeddedFontDataId requires a non-empty r:id');
	}
	applyAttribute(node, 'r:id', data.relationshipId);
	return node;
}

function serializeDescriptor(font: PptxEmbeddedFontDescriptor): XmlObject {
	const node = { ...(font.rawXml ?? {}) } as XmlObject;
	if (!font.rawXml && !font.typeface) {
		throw new Error('Embedded font descriptors require a typeface');
	}
	applyAttribute(node, 'typeface', font.typeface);
	applyAttribute(node, 'panose', font.panose);
	applyAttribute(node, 'pitchFamily', font.pitchFamily);
	applyAttribute(node, 'charset', font.charset);
	return node;
}

function serializeEntry(entry: PptxEmbeddedFontListEntry): XmlObject {
	const source = { ...(entry.rawXml ?? {}) } as XmlObject;
	const edits = new Map<string, XmlObject | null>([['font', serializeDescriptor(entry.font)]]);
	for (const variant of ENTRY_ORDER.slice(1)) {
		const value = entry[variant];
		if (value !== undefined) {
			edits.set(variant, value === null ? null : serializeDataId(value));
		}
	}
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(source)) {
		if (key.startsWith('@_')) {
			result[key] = value;
		}
	}
	for (const name of ENTRY_ORDER) {
		const edit = edits.get(name);
		const key = findKey(source, name) ?? `p:${name}`;
		if (edit !== null && edit !== undefined) {
			result[key] = edit;
		} else if (!edits.has(name) && source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	for (const [key, value] of Object.entries(source)) {
		if (!key.startsWith('@_') && !ENTRY_ORDER.includes(localName(key) as never)) {
			result[key] = value;
		}
	}
	return result;
}

export function serializeEmbeddedFontList(list: PptxEmbeddedFontList): XmlObject {
	if (list.fonts.length === 0) {
		throw new Error('CT_EmbeddedFontList requires at least one embeddedFont');
	}
	const source = { ...(list.rawXml ?? {}) } as XmlObject;
	const key = findKey(source, 'embeddedFont') ?? 'p:embeddedFont';
	source[key] = list.fonts.map(serializeEntry);
	return source;
}

export function setEmbeddedFontList(presentationData: XmlObject, list: XmlObject | null): void {
	const rootKey = Object.keys(presentationData).find((key) => localName(key) === 'presentation');
	if (!rootKey) {
		return;
	}
	const root = presentationData[rootKey] as XmlObject;
	const existingKey = findKey(root, 'embeddedFontLst');
	const result: XmlObject = {};
	let inserted = false;
	for (const [key, value] of Object.entries(root)) {
		const name = localName(key);
		if (name === 'embeddedFontLst') {
			continue;
		}
		if (!inserted && list && !key.startsWith('@_') && !PRESENTATION_BEFORE.has(name)) {
			result[existingKey ?? 'p:embeddedFontLst'] = list;
			inserted = true;
		}
		result[key] = value;
	}
	if (list && !inserted) {
		result[existingKey ?? 'p:embeddedFontLst'] = list;
	}
	presentationData[rootKey] = result;
}
