import type { PptxChartData, XmlObject } from '../types';

type Method = NonNullable<PptxChartData['colorMethod']>;
const METHODS = new Set<Method>(['cycle', 'withinLinear', 'acrossLinear']);
const COLOR_NAMES = new Set(['scrgbClr', 'srgbClr', 'hslClr', 'sysClr', 'schemeClr', 'prstClr']);

function localName(key: string): string {
	return key.replace(/^.*:/u, '');
}

function rootOf(tree: XmlObject): XmlObject {
	const key = Object.keys(tree).find((candidate) => localName(candidate) === 'colorStyle');
	const value = key ? tree[key] : tree;
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as XmlObject) : tree;
}

function normalizeHex(value: string): string {
	const hex = value.replace(/^#/u, '').toUpperCase();
	if (!/^[0-9A-F]{6}$/u.test(hex)) {
		throw new RangeError(`chart palette colour must be six-digit RGB: ${value}`);
	}
	return hex;
}

/** Apply canonical RGB palette edits while preserving variations, extensions, and foreign XML. */
export function applyChartColorStyleXml(
	tree: XmlObject,
	palette: readonly string[],
	method: Method,
): void {
	if (!palette.length) {
		throw new RangeError('chart colorPalette must not be empty');
	}
	if (!METHODS.has(method)) {
		throw new RangeError('chart colorMethod must be cycle, withinLinear, or acrossLinear');
	}
	const root = rootOf(tree);
	root['@_meth'] = method;
	const entries = Object.entries(root);
	for (const key of Object.keys(root)) {
		if (!key.startsWith('@_') && COLOR_NAMES.has(localName(key))) {
			delete root[key];
		}
	}
	const ordered = Object.entries(root);
	for (const childKey of Object.keys(root)) {
		delete root[childKey];
	}
	for (const [childKey, value] of ordered.filter(([candidate]) => candidate.startsWith('@_'))) {
		root[childKey] = value;
	}
	root['a:srgbClr'] = palette.map((color) => ({ '@_val': normalizeHex(color) }));
	for (const [key, value] of entries) {
		if (!key.startsWith('@_') && !COLOR_NAMES.has(localName(key))) {
			root[key] = value;
		}
	}
}

export function buildChartColorStyleXml(palette: readonly string[], method: Method): XmlObject {
	const tree: XmlObject = {
		'cs:colorStyle': {
			'@_xmlns:cs': 'http://schemas.microsoft.com/office/drawing/2012/chartStyle',
			'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			'@_meth': method,
			'@_id': '10',
		},
	};
	applyChartColorStyleXml(tree, palette, method);
	return tree;
}
