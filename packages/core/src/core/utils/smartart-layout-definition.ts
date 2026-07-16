import type {
	PptxSmartArtLayoutCategory,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtLocalizedText,
	XmlObject,
} from '../types';
import {
	applySmartArtConstraintRules,
	parseSmartArtConstraintRules,
	validateSmartArtConstraintRules,
} from './smartart-constraint-rules';
import {
	applySmartArtLayoutAlgorithm,
	parseSmartArtLayoutAlgorithm,
	validateSmartArtLayoutAlgorithm,
} from './smartart-layout-algorithm';
import {
	applySmartArtControlFlow,
	parseSmartArtControlFlow,
	validateSmartArtControlFlow,
} from './smartart-layout-control-flow';

type LocalName = (key: string) => string;

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value)
		? (value[0] as XmlObject | undefined)
		: (value as XmlObject | undefined);
}

function children(node: XmlObject | undefined, name: string, localName: LocalName): XmlObject[] {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

/** Find the next generation of layout nodes through forEach/choose wrappers. */
function nestedLayoutNodes(node: XmlObject, localName: LocalName): XmlObject[] {
	const found: XmlObject[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		for (const [key, entry] of Object.entries(value as XmlObject)) {
			if (key.startsWith('@_')) {
				continue;
			}
			if (localName(key) === 'layoutNode') {
				for (const layoutNode of Array.isArray(entry) ? entry : [entry]) {
					if (layoutNode && typeof layoutNode === 'object') {
						found.push(layoutNode as XmlObject);
					}
				}
			} else {
				visit(entry);
			}
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value });
		}
	}
	return found;
}

function optionalString(value: unknown): string | undefined {
	const result = String(value ?? '').trim();
	return result.length > 0 ? result : undefined;
}

function parseLocalized(node: XmlObject): PptxSmartArtLocalizedText | undefined {
	const value = optionalString(node['@_val']);
	return value ? { value, language: optionalString(node['@_lang']) } : undefined;
}

function parseNode(node: XmlObject, localName: LocalName): PptxSmartArtLayoutNode {
	const nested = nestedLayoutNodes(node, localName).map((entry) => parseNode(entry, localName));
	const childOrder = optionalString(node['@_chOrder']);
	return {
		name: optionalString(node['@_name']),
		styleLabel: optionalString(node['@_styleLbl']),
		childOrder: childOrder === 'b' || childOrder === 't' ? childOrder : undefined,
		moveWith: optionalString(node['@_moveWith']),
		algorithm: parseSmartArtLayoutAlgorithm(node, localName),
		...parseSmartArtControlFlow(node, localName),
		...parseSmartArtConstraintRules(node, localName),
		children: nested.length > 0 ? nested : undefined,
	};
}

/** Parse CT_DiagramDefinition without relying on the producer's prefix. */
export function parseSmartArtLayoutDefinition(
	layoutDef: XmlObject | undefined,
	localName: LocalName,
): PptxSmartArtLayoutDefinition | undefined {
	const root = child(layoutDef, 'layoutNode', localName);
	if (!layoutDef || !root) {
		return undefined;
	}
	const catList = child(layoutDef, 'catLst', localName);
	const categories = children(catList, 'cat', localName)
		.map((entry): PptxSmartArtLayoutCategory | undefined => {
			const type = optionalString(entry['@_type']);
			const priority = Number(entry['@_pri']);
			return type && Number.isInteger(priority) && priority >= 0 ? { type, priority } : undefined;
		})
		.filter((entry): entry is PptxSmartArtLayoutCategory => Boolean(entry));
	return {
		uniqueId: optionalString(layoutDef['@_uniqueId']),
		minimumVersion: optionalString(layoutDef['@_minVer']),
		defaultStyle: optionalString(layoutDef['@_defStyle']),
		titles: children(layoutDef, 'title', localName)
			.map(parseLocalized)
			.filter(Boolean) as PptxSmartArtLocalizedText[],
		descriptions: children(layoutDef, 'desc', localName)
			.map(parseLocalized)
			.filter(Boolean) as PptxSmartArtLocalizedText[],
		categories: categories.length > 0 ? categories : undefined,
		rootNode: parseNode(root, localName),
		rawXml: JSON.parse(JSON.stringify(layoutDef)) as XmlObject,
	};
}

export function validateSmartArtLayoutDefinition(value: PptxSmartArtLayoutDefinition): string[] {
	const errors: string[] = [];
	const visit = (node: PptxSmartArtLayoutNode, path: string): void => {
		errors.push(...validateSmartArtConstraintRules(node).map((error) => `${path}.${error}`));
		errors.push(...validateSmartArtLayoutAlgorithm(node).map((error) => `${path}.${error}`));
		errors.push(...validateSmartArtControlFlow(node).map((error) => `${path}.${error}`));
		if (node.childOrder !== undefined && node.childOrder !== 'b' && node.childOrder !== 't') {
			errors.push(`${path}.childOrder must be b or t`);
		}
		node.children?.forEach((entry, index) => visit(entry, `${path}.children[${index}]`));
	};
	visit(value.rootNode, 'rootNode');
	value.categories?.forEach((category, index) => {
		if (!category.type.trim()) {
			errors.push(`categories[${index}].type is required`);
		}
		if (
			!Number.isInteger(category.priority) ||
			category.priority < 0 ||
			category.priority > 4294967295
		) {
			errors.push(`categories[${index}].priority must be an unsigned 32-bit integer`);
		}
	});
	for (const [name, entries] of [
		['titles', value.titles],
		['descriptions', value.descriptions],
	] as const) {
		entries?.forEach((entry, index) => {
			if (!entry.value.trim()) {
				errors.push(`${name}[${index}].value is required`);
			}
		});
	}
	return errors;
}

function setAttribute(node: XmlObject, key: string, value: string | undefined): void {
	if (value === undefined) {
		delete node[key];
	} else {
		node[key] = value;
	}
}

function applyNode(target: XmlObject, value: PptxSmartArtLayoutNode, localName: LocalName): void {
	setAttribute(target, '@_name', value.name);
	setAttribute(target, '@_styleLbl', value.styleLabel);
	setAttribute(target, '@_chOrder', value.childOrder);
	setAttribute(target, '@_moveWith', value.moveWith);
	applySmartArtLayoutAlgorithm(target, value.algorithm, localName);
	applySmartArtControlFlow(target, value, localName);
	applySmartArtConstraintRules(target, value, localName);
	const existing = nestedLayoutNodes(target, localName);
	value.children?.forEach((entry, index) => {
		if (existing[index]) {
			applyNode(existing[index], entry, localName);
		}
	});
}

function applyLocalized(
	target: XmlObject,
	name: string,
	values: PptxSmartArtLocalizedText[] | undefined,
	localName: LocalName,
): void {
	if (values === undefined) {
		return;
	}
	const key =
		Object.keys(target).find((candidate) => localName(candidate) === name) ?? `dgm:${name}`;
	const existing = children(target, name, localName);
	target[key] = values.map((value, index) => {
		const entry = existing[index] ?? {};
		entry['@_val'] = value.value;
		setAttribute(entry, '@_lang', value.language);
		return entry;
	});
}

/** Surgically merge editable fields while preserving unknown XML and extLst. */
export function applySmartArtLayoutDefinition(
	target: XmlObject,
	value: PptxSmartArtLayoutDefinition,
	localName: LocalName,
): boolean {
	if (validateSmartArtLayoutDefinition(value).length > 0) {
		return false;
	}
	const root = child(target, 'layoutNode', localName);
	if (!root) {
		return false;
	}
	setAttribute(target, '@_uniqueId', value.uniqueId);
	setAttribute(target, '@_minVer', value.minimumVersion);
	setAttribute(target, '@_defStyle', value.defaultStyle);
	applyLocalized(target, 'title', value.titles, localName);
	applyLocalized(target, 'desc', value.descriptions, localName);
	if (value.categories !== undefined) {
		const list = child(target, 'catLst', localName);
		if (list) {
			const key =
				Object.keys(list).find((candidate) => localName(candidate) === 'cat') ?? 'dgm:cat';
			const existing = children(list, 'cat', localName);
			list[key] = value.categories.map((category, index) => ({
				...(existing[index] ?? {}),
				'@_type': category.type,
				'@_pri': String(category.priority),
			}));
		}
	}
	applyNode(root, value.rootNode, localName);
	return true;
}
