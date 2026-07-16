import type { XmlObject, PptxKinsoku } from '../types';

const BEFORE_KINSOKU = new Set([
	'sldMasterIdLst',
	'notesMasterIdLst',
	'handoutMasterIdLst',
	'sldIdLst',
	'sldSz',
	'notesSz',
	'smartTags',
	'embeddedFontLst',
	'custShowLst',
	'photoAlbum',
	'custDataLst',
]);

const localName = (key: string): string => key.replace(/^@_/u, '').replace(/^.*:/u, '');
const findKey = (node: XmlObject, name: string): string | undefined =>
	Object.keys(node).find((key) => localName(key) === name);

/** Parse PresentationML `CT_Kinsoku` independently of namespace prefixes. */
export function parseKinsoku(
	presentationXml: XmlObject | null | undefined,
): PptxKinsoku | undefined {
	if (!presentationXml) {
		return undefined;
	}
	const rootKey = findKey(presentationXml, 'presentation');
	const root = rootKey ? (presentationXml[rootKey] as XmlObject | undefined) : undefined;
	const key = root ? findKey(root, 'kinsoku') : undefined;
	const node = key && root ? (root[key] as XmlObject | undefined) : undefined;
	if (!node) {
		return undefined;
	}

	const result: PptxKinsoku = { rawXml: node };
	const lang = node['@_lang']?.trim();
	if (lang) {
		result.lang = lang;
	}
	if (node['@_invalStChars'] !== undefined) {
		result.invalStChars = node['@_invalStChars'];
	}
	if (node['@_invalEndChars'] !== undefined) {
		result.invalEndChars = node['@_invalEndChars'];
	}
	return result;
}

function setAttribute(node: XmlObject, name: string, value: string | null | undefined): void {
	const key = findKey(node, name);
	if (value === null) {
		if (key) {
			delete node[key];
		}
	} else if (value !== undefined) {
		node[key ?? `@_${name}`] = value;
	}
}

function insertKinsoku(root: XmlObject, key: string, value: XmlObject): XmlObject {
	const result: XmlObject = {};
	let inserted = false;
	for (const [childKey, childValue] of Object.entries(root)) {
		const name = localName(childKey);
		if (name === 'kinsoku') {
			continue;
		}
		if (!inserted && !childKey.startsWith('@_') && !BEFORE_KINSOKU.has(name)) {
			result[key] = value;
			inserted = true;
		}
		result[childKey] = childValue;
	}
	if (!inserted) {
		result[key] = value;
	}
	return result;
}

/** Apply, preserve, or remove `p:kinsoku` while retaining unknown XML. */
export function applyKinsokuToXml(
	presentation: XmlObject,
	kinsoku: PptxKinsoku | null | undefined,
): XmlObject {
	const existingKey = findKey(presentation, 'kinsoku');
	if (kinsoku === undefined) {
		return presentation;
	}
	if (kinsoku === null) {
		if (existingKey) {
			delete presentation[existingKey];
		}
		return presentation;
	}
	const existing = existingKey ? (presentation[existingKey] as XmlObject | undefined) : undefined;
	const node = { ...(kinsoku.rawXml ?? existing ?? {}) } as XmlObject;
	if (!kinsoku.rawXml && !existing) {
		if (kinsoku.invalStChars === undefined || kinsoku.invalEndChars === undefined) {
			throw new Error('CT_Kinsoku requires invalStChars and invalEndChars');
		}
	}
	setAttribute(node, 'lang', kinsoku.lang);
	setAttribute(node, 'invalStChars', kinsoku.invalStChars);
	setAttribute(node, 'invalEndChars', kinsoku.invalEndChars);
	const rebuilt = insertKinsoku(presentation, existingKey ?? 'p:kinsoku', node);
	for (const key of Object.keys(presentation)) {
		delete presentation[key];
	}
	Object.assign(presentation, rebuilt);
	return presentation;
}
