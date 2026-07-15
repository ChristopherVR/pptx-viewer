import type { ShapeStyle, XmlObject } from '../../types';
import { colorsEqual, extractColorChoiceXml } from '../../utils/color-xml-preservation';

const COLOR_NAMES = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr']);

export function localName(key: string): string {
	return key.split(':').at(-1) ?? key;
}

export function effectChild(parent: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	const value = key ? parent[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/** Merge modeled values into an effect while retaining unknown XML and color transforms. */
export function mergeEffectNode(
	original: XmlObject | undefined,
	generated: XmlObject,
	originalResolvedColor: string | undefined,
	currentColor: string | undefined,
	originalOpacity: number | undefined,
	currentOpacity: number | undefined,
): XmlObject {
	const merged: XmlObject = { ...(original ?? {}) };
	for (const [key, value] of Object.entries(generated)) {
		if (key.startsWith('@_')) {
			merged[key] = value;
		}
	}
	for (const key of Object.keys(merged)) {
		if (COLOR_NAMES.has(localName(key))) {
			delete merged[key];
		}
	}
	const color =
		colorsEqual(originalResolvedColor, currentColor) &&
		originalOpacity === currentOpacity &&
		original
			? extractColorChoiceXml(original)
			: extractColorChoiceXml(generated);
	for (const [key, value] of Object.entries(color ?? {})) {
		merged[key] = value;
	}
	return merged;
}

/** Merge generated attributes while retaining unknown attributes and child XML. */
export function mergeAttributeEffectNode(
	original: XmlObject | undefined,
	generated: XmlObject,
): XmlObject {
	const merged: XmlObject = { ...(original ?? {}) };
	for (const [key, value] of Object.entries(generated)) {
		if (key.startsWith('@_')) {
			merged[key] = value;
		}
	}
	return merged;
}

export function createEffectList(style: ShapeStyle, spPr: XmlObject): XmlObject {
	return { ...(style.effectListXml ?? effectChild(spPr, 'effectLst') ?? {}) };
}

export function setEffectChild(list: XmlObject, name: string, value: XmlObject | undefined): void {
	const existing = Object.keys(list).find((key) => localName(key) === name);
	if (existing) {
		delete list[existing];
	}
	if (value) {
		list[`a:${name}`] = value;
	}
}
