import type { XmlObject } from '../../types';
import type {
	PptxSmartArtColorListMetadata,
	PptxSmartArtColorStyleLabel,
	PptxSmartArtDefinitionMetadata,
	PptxSmartArtQuickStyleLabel,
} from '../../types/smart-art-style-definition';

type LocalName = (key: string) => string;

function findKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function prefixFor(node: XmlObject): string {
	const key = Object.keys(node).find(
		(candidate) => !candidate.startsWith('@_') && candidate.includes(':'),
	);
	return key ? key.slice(0, key.indexOf(':') + 1) : 'dgm:';
}

function objects(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is XmlObject => Boolean(item) && typeof item === 'object');
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function setChildren(
	node: XmlObject,
	name: string,
	values: XmlObject[] | undefined,
	localName: LocalName,
): boolean {
	if (values === undefined) {
		return false;
	}
	const existing = findKey(node, name, localName);
	if (values.length === 0) {
		if (existing) {
			delete node[existing];
		}
		return Boolean(existing);
	}
	node[existing ?? `${prefixFor(node)}${name}`] = values.length === 1 ? values[0] : values;
	return true;
}

export function applySmartArtDefinitionMetadata(
	node: XmlObject,
	metadata: PptxSmartArtDefinitionMetadata,
	localName: LocalName,
): boolean {
	let changed = false;
	if (metadata.uniqueId !== undefined) {
		node['@_uniqueId'] = metadata.uniqueId;
		changed = true;
	}
	if (metadata.minimumVersion !== undefined) {
		node['@_minVer'] = metadata.minimumVersion;
		changed = true;
	}
	const textNodes = (values: PptxSmartArtDefinitionMetadata['titles']) =>
		values?.map((value) => ({
			'@_val': value.value,
			...(value.language ? { '@_lang': value.language } : {}),
		}));
	changed = setChildren(node, 'title', textNodes(metadata.titles), localName) || changed;
	changed = setChildren(node, 'desc', textNodes(metadata.descriptions), localName) || changed;
	if (metadata.categories !== undefined) {
		const key = findKey(node, 'catLst', localName);
		if (metadata.categories.length === 0) {
			if (key) {
				delete node[key];
			}
			changed = Boolean(key) || changed;
		} else {
			const categoryList = key ? (objects(node[key])[0] ?? {}) : {};
			setChildren(
				categoryList,
				'cat',
				metadata.categories.map((category) => ({
					'@_type': category.type,
					'@_pri': String(category.priority),
				})),
				localName,
			);
			node[key ?? `${prefixFor(node)}catLst`] = categoryList;
			changed = true;
		}
	}
	return changed;
}

function ensureLabels(node: XmlObject, localName: LocalName): { key: string; labels: XmlObject[] } {
	const key = findKey(node, 'styleLbl', localName) ?? `${prefixFor(node)}styleLbl`;
	return { key, labels: objects(node[key]) };
}

export function applySmartArtQuickStyleLabels(
	node: XmlObject,
	labels: PptxSmartArtQuickStyleLabel[] | undefined,
	localName: LocalName,
): boolean {
	if (labels === undefined) {
		return false;
	}
	const current = ensureLabels(node, localName);
	labels.forEach((label, index) => {
		(current.labels[index] ??= {})['@_name'] = label.name;
	});
	node[current.key] = current.labels.length === 1 ? current.labels[0] : current.labels;
	return true;
}

const COLOR_LISTS = [
	['fill', 'fillClrLst'],
	['line', 'linClrLst'],
	['effect', 'effectClrLst'],
	['textLine', 'txLinClrLst'],
	['textFill', 'txFillClrLst'],
	['textEffect', 'txEffectClrLst'],
] as const;

function applyColorList(
	label: XmlObject,
	name: string,
	metadata: PptxSmartArtColorListMetadata,
	localName: LocalName,
): void {
	const key = findKey(label, name, localName) ?? `${prefixFor(label)}${name}`;
	const list = objects(label[key])[0] ?? {};
	if (metadata.method !== undefined) {
		list['@_meth'] = metadata.method;
	}
	if (metadata.hueDirection !== undefined) {
		list['@_hueDir'] = metadata.hueDirection;
	}
	label[key] = list;
}

export function applySmartArtColorStyleLabels(
	node: XmlObject,
	labels: PptxSmartArtColorStyleLabel[] | undefined,
	localName: LocalName,
): boolean {
	if (labels === undefined) {
		return false;
	}
	const current = ensureLabels(node, localName);
	labels.forEach((label, index) => {
		const xml = (current.labels[index] ??= {});
		xml['@_name'] = label.name;
		for (const [property, element] of COLOR_LISTS) {
			const metadata = label[property];
			if (metadata) {
				applyColorList(xml, element, metadata, localName);
			}
		}
	});
	node[current.key] = current.labels.length === 1 ? current.labels[0] : current.labels;
	return true;
}
