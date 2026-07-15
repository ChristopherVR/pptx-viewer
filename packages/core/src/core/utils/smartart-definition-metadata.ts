import type { XmlObject } from '../types';
import type {
	PptxSmartArtColorListMetadata,
	PptxSmartArtColorStyleLabel,
	PptxSmartArtDefinitionMetadata,
	PptxSmartArtQuickStyleLabel,
} from '../types/smart-art-style-definition';

type LocalName = (key: string) => string;

function children(node: XmlObject | undefined, name: string, localName: LocalName): XmlObject[] {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (key && value === '') {
		return [{}];
	}
	if (Array.isArray(value)) {
		return value.filter((item): item is XmlObject => Boolean(item) && typeof item === 'object');
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function child(node: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	return children(node, name, localName)[0];
}

function parseText(node: XmlObject, name: string, localName: LocalName) {
	const values = children(node, name, localName).map((item) => ({
		value: String(item['@_val'] ?? ''),
		language: String(item['@_lang'] ?? '') || undefined,
	}));
	return values.length > 0 ? values : undefined;
}

export function parseSmartArtDefinitionMetadata(
	node: XmlObject,
	localName: LocalName,
): PptxSmartArtDefinitionMetadata {
	const categoryList = child(node, 'catLst', localName);
	const categories = children(categoryList, 'cat', localName).map((item) => ({
		type: String(item['@_type'] ?? ''),
		priority: Number(item['@_pri'] ?? 0),
	}));
	return {
		uniqueId: String(node['@_uniqueId'] ?? '') || undefined,
		minimumVersion: String(node['@_minVer'] ?? '') || undefined,
		titles: parseText(node, 'title', localName),
		descriptions: parseText(node, 'desc', localName),
		categories: categories.length > 0 ? categories : undefined,
	};
}

export function parseSmartArtQuickStyleLabels(
	node: XmlObject,
	localName: LocalName,
): PptxSmartArtQuickStyleLabel[] | undefined {
	const labels = children(node, 'styleLbl', localName).map((item) => ({
		name: String(item['@_name'] ?? ''),
	}));
	return labels.length > 0 ? labels : undefined;
}

function parseColorList(
	node: XmlObject,
	name: string,
	localName: LocalName,
): PptxSmartArtColorListMetadata | undefined {
	const list = child(node, name, localName);
	if (!list) {
		return undefined;
	}
	const method = String(list['@_meth'] ?? '');
	const hueDirection = String(list['@_hueDir'] ?? '');
	return {
		method: COLOR_METHODS.has(method)
			? (method as PptxSmartArtColorListMetadata['method'])
			: undefined,
		hueDirection: HUE_DIRECTIONS.has(hueDirection)
			? (hueDirection as PptxSmartArtColorListMetadata['hueDirection'])
			: undefined,
	};
}

export function parseSmartArtColorStyleLabels(
	node: XmlObject,
	localName: LocalName,
): PptxSmartArtColorStyleLabel[] | undefined {
	const labels = children(node, 'styleLbl', localName).map((item) => ({
		name: String(item['@_name'] ?? ''),
		fill: parseColorList(item, 'fillClrLst', localName),
		line: parseColorList(item, 'linClrLst', localName),
		effect: parseColorList(item, 'effectClrLst', localName),
		textLine: parseColorList(item, 'txLinClrLst', localName),
		textFill: parseColorList(item, 'txFillClrLst', localName),
		textEffect: parseColorList(item, 'txEffectClrLst', localName),
	}));
	return labels.length > 0 ? labels : undefined;
}

const COLOR_METHODS = new Set(['span', 'cycle', 'repeat']);
const HUE_DIRECTIONS = new Set(['cw', 'ccw']);

/** Validate the typed subset of CT_StyleDefinition or CT_ColorTransform. */
export function validateSmartArtDefinitionMetadata(
	metadata: PptxSmartArtDefinitionMetadata,
): string[] {
	const issues: string[] = [];
	for (const [index, category] of (metadata.categories ?? []).entries()) {
		if (!category.type) {
			issues.push(`categories[${index}].type is required`);
		}
		if (
			!Number.isInteger(category.priority) ||
			category.priority < 0 ||
			category.priority > 4294967295
		) {
			issues.push(`categories[${index}].priority must be an unsigned 32-bit integer`);
		}
	}
	for (const [kind, values] of [
		['titles', metadata.titles],
		['descriptions', metadata.descriptions],
	] as const) {
		for (const [index, value] of (values ?? []).entries()) {
			if (!value.value) {
				issues.push(`${kind}[${index}].value is required`);
			}
		}
	}
	return issues;
}

/** Validate CT_CTStyleLabel required names and CT_Colors enum attributes. */
export function validateSmartArtColorStyleLabels(labels: PptxSmartArtColorStyleLabel[]): string[] {
	const issues: string[] = [];
	labels.forEach((label, index) => {
		if (!label.name) {
			issues.push(`labels[${index}].name is required`);
		}
		for (const [property, list] of Object.entries(label)) {
			if (!list || typeof list !== 'object') {
				continue;
			}
			const metadata = list as PptxSmartArtColorListMetadata;
			if (metadata.method && !COLOR_METHODS.has(metadata.method)) {
				issues.push(`labels[${index}].${property}.method is invalid`);
			}
			if (metadata.hueDirection && !HUE_DIRECTIONS.has(metadata.hueDirection)) {
				issues.push(`labels[${index}].${property}.hueDirection is invalid`);
			}
		}
	});
	return issues;
}
