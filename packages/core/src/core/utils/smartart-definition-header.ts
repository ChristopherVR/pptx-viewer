import type {
	PptxSmartArtDefinitionHeader,
	PptxSmartArtDefinitionHeaderKind,
	PptxSmartArtDefinitionHeaderList,
	PptxSmartArtDefinitionPartDescriptor,
	PptxSmartArtHeaderText,
	XmlObject,
} from '../types';

const DGM_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const DGM_CONTENT = 'application/vnd.openxmlformats-officedocument.drawingml.';
const DGM_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';

export const SMART_ART_DEFINITION_PARTS: Readonly<
	Record<PptxSmartArtDefinitionHeaderKind, PptxSmartArtDefinitionPartDescriptor>
> = {
	layout: {
		kind: 'layout',
		contentType: `${DGM_CONTENT}diagramLayout+xml`,
		relationshipType: `${DGM_REL}diagramLayout`,
		rootElement: 'layoutDef',
		targetName: 'layout',
	},
	style: {
		kind: 'style',
		contentType: `${DGM_CONTENT}diagramStyle+xml`,
		relationshipType: `${DGM_REL}diagramQuickStyle`,
		rootElement: 'styleDef',
		targetName: 'quickStyle',
	},
	color: {
		kind: 'color',
		contentType: `${DGM_CONTENT}diagramColors+xml`,
		relationshipType: `${DGM_REL}diagramColors`,
		rootElement: 'colorsDef',
		targetName: 'colors',
	},
};

const ROOTS = {
	layout: ['layoutDefHdrLst', 'layoutDefHdr'],
	style: ['styleDefHdrLst', 'styleDefHdr'],
	color: ['colorsDefHdrLst', 'colorsDefHdr'],
} as const;

const localName = (key: string): string => key.slice(key.indexOf(':') + 1);
const keyFor = (node: XmlObject, name: string): string | undefined =>
	Object.keys(node).find((key) => !key.startsWith('@_') && localName(key) === name);
const objects = (value: unknown): XmlObject[] =>
	Array.isArray(value)
		? value.filter((item): item is XmlObject => Boolean(item) && typeof item === 'object')
		: value && typeof value === 'object'
			? [value as XmlObject]
			: [];
const children = (node: XmlObject, name: string): XmlObject[] =>
	objects(node[keyFor(node, name) ?? '']);
const copy = <T>(value: T): T => structuredClone(value);

function detectRoot(xml: XmlObject): {
	kind: PptxSmartArtDefinitionHeaderKind;
	root: XmlObject;
} {
	for (const kind of Object.keys(ROOTS) as PptxSmartArtDefinitionHeaderKind[]) {
		const key = keyFor(xml, ROOTS[kind][0]);
		if (key) {
			return { kind, root: objects(xml[key])[0] ?? {} };
		}
		if (keyFor(xml, ROOTS[kind][1])) {
			return { kind, root: xml };
		}
	}
	throw new Error('Expected a DiagramML definition header list root');
}

function parseText(node: XmlObject, name: string): PptxSmartArtHeaderText[] {
	return children(node, name).map((item) => ({
		value: String(item['@_val'] ?? ''),
		language: String(item['@_lang'] ?? '') || undefined,
		rawXml: copy(item),
	}));
}

function parseHeader(node: XmlObject): PptxSmartArtDefinitionHeader {
	const catList = children(node, 'catLst')[0];
	const categories = catList
		? children(catList, 'cat').map((item) => ({
				type: String(item['@_type'] ?? ''),
				priority: Number(item['@_pri'] ?? Number.NaN),
				rawXml: copy(item),
			}))
		: undefined;
	return {
		uniqueId: String(node['@_uniqueId'] ?? ''),
		minimumVersion: String(node['@_minVer'] ?? '') || undefined,
		defaultStyle: String(node['@_defStyle'] ?? '') || undefined,
		resourceId: node['@_resId'] === undefined ? undefined : Number(node['@_resId']),
		titles: parseText(node, 'title'),
		descriptions: parseText(node, 'desc'),
		categories,
		rawXml: copy(node),
	};
}

/** Parse any of the three definition-header list roots, regardless of prefix. */
export function parseSmartArtDefinitionHeaderList(
	xml: XmlObject,
): PptxSmartArtDefinitionHeaderList {
	const detected = detectRoot(xml);
	const headerName = ROOTS[detected.kind][1];
	return {
		kind: detected.kind,
		headers: children(detected.root, headerName).map(parseHeader),
		rawXml: copy(detected.root),
	};
}

function prefixFor(node: XmlObject): string {
	const key = Object.keys(node).find((item) => !item.startsWith('@_') && item.includes(':'));
	if (key) {
		return key.slice(0, key.indexOf(':') + 1);
	}
	const namespace = Object.keys(node).find(
		(item) => item.startsWith('@_xmlns:') && node[item] === DGM_NAMESPACE,
	);
	return namespace ? `${namespace.slice('@_xmlns:'.length)}:` : 'dgm:';
}

function replaceChildren(node: XmlObject, name: string, values: XmlObject[]): void {
	const key = keyFor(node, name) ?? `${prefixFor(node)}${name}`;
	if (values.length === 0) {
		delete node[key];
	} else {
		node[key] = values.length === 1 ? values[0] : values;
	}
}

function textXml(values: PptxSmartArtHeaderText[]): XmlObject[] {
	return values.map((value) => {
		const node = value.rawXml ? copy(value.rawXml) : {};
		node['@_val'] = value.value;
		if (value.language === undefined) {
			delete node['@_lang'];
		} else {
			node['@_lang'] = value.language;
		}
		return node;
	});
}

function applyHeader(header: PptxSmartArtDefinitionHeader): XmlObject {
	const node = header.rawXml ? copy(header.rawXml) : {};
	node['@_uniqueId'] = header.uniqueId;
	if (header.minimumVersion === undefined) {
		delete node['@_minVer'];
	} else {
		node['@_minVer'] = header.minimumVersion;
	}
	if (header.defaultStyle === undefined) {
		delete node['@_defStyle'];
	} else {
		node['@_defStyle'] = header.defaultStyle;
	}
	if (header.resourceId === undefined) {
		delete node['@_resId'];
	} else {
		node['@_resId'] = String(header.resourceId);
	}
	replaceChildren(node, 'title', textXml(header.titles));
	replaceChildren(node, 'desc', textXml(header.descriptions));
	if (header.categories !== undefined) {
		const listKey = keyFor(node, 'catLst') ?? `${prefixFor(node)}catLst`;
		const list = children(node, 'catLst')[0] ?? {};
		const categories = header.categories.map((category) => ({
			...(category.rawXml ? copy(category.rawXml) : {}),
			'@_type': category.type,
			'@_pri': String(category.priority),
		}));
		replaceChildren(list, 'cat', categories);
		if (categories.length === 0) {
			delete node[listKey];
		} else {
			node[listKey] = list;
		}
	}
	return orderHeader(node);
}

function orderHeader(node: XmlObject): XmlObject {
	const result: XmlObject = {};
	for (const key of Object.keys(node).filter((attributeKey) => attributeKey.startsWith('@_'))) {
		result[key] = node[key];
	}
	for (const name of ['title', 'desc', 'catLst']) {
		const key = keyFor(node, name);
		if (key) {
			result[key] = node[key];
		}
	}
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_') && !['title', 'desc', 'catLst', 'extLst'].includes(localName(key))) {
			result[key] = node[key];
		}
	}
	const ext = keyFor(node, 'extLst');
	if (ext) {
		result[ext] = node[ext];
	}
	return result;
}

/** Build an XML object in schema order while retaining foreign markup. */
export function serializeSmartArtDefinitionHeaderList(
	list: PptxSmartArtDefinitionHeaderList,
): XmlObject {
	const root = list.rawXml ? copy(list.rawXml) : {};
	const [rootName, headerName] = ROOTS[list.kind];
	replaceChildren(root, headerName, list.headers.map(applyHeader));
	const prefix = prefixFor(root);
	if (!Object.keys(root).some((key) => key.startsWith('@_xmlns:'))) {
		root[`@_xmlns:${prefix.slice(0, -1)}`] = DGM_NAMESPACE;
	}
	return { [`${prefix}${rootName}`]: root } as XmlObject;
}

/** Validate required values and XML Schema integer ranges. */
export function validateSmartArtDefinitionHeaderList(
	list: PptxSmartArtDefinitionHeaderList,
): string[] {
	const issues: string[] = [];
	list.headers.forEach((header, index) => {
		const base = `headers[${index}]`;
		if (!header.uniqueId) {
			issues.push(`${base}.uniqueId is required`);
		}
		if (header.titles.length === 0) {
			issues.push(`${base}.titles requires at least one title`);
		}
		if (header.descriptions.length === 0) {
			issues.push(`${base}.descriptions requires at least one description`);
		}
		for (const [name, values] of [
			['titles', header.titles],
			['descriptions', header.descriptions],
		] as const) {
			values.forEach((value, valueIndex) => {
				if (!value.value) {
					issues.push(`${base}.${name}[${valueIndex}].value is required`);
				}
			});
		}
		if (
			header.resourceId !== undefined &&
			(!Number.isInteger(header.resourceId) ||
				header.resourceId < -2147483648 ||
				header.resourceId > 2147483647)
		) {
			issues.push(`${base}.resourceId must be a signed 32-bit integer`);
		}
		(header.categories ?? []).forEach((category, categoryIndex) => {
			if (!category.type) {
				issues.push(`${base}.categories[${categoryIndex}].type is required`);
			}
			if (
				!Number.isInteger(category.priority) ||
				category.priority < 0 ||
				category.priority > 4294967295
			) {
				issues.push(
					`${base}.categories[${categoryIndex}].priority must be an unsigned 32-bit integer`,
				);
			}
		});
		if (list.kind !== 'layout' && header.defaultStyle !== undefined) {
			issues.push(`${base}.defaultStyle is only valid for layout headers`);
		}
	});
	return issues;
}
