import type {
	PptxPresentationPrintProperties,
	PptxPrintColorMode,
	PptxPrintOutput,
	XmlObject,
} from '../../types';

const PRINT_OUTPUTS = new Set<PptxPrintOutput>([
	'slides',
	'handouts1',
	'handouts2',
	'handouts3',
	'handouts4',
	'handouts6',
	'handouts9',
	'notes',
	'outline',
]);
const COLOR_MODES = new Set<PptxPrintColorMode>(['bw', 'gray', 'clr']);
const ROOT_ORDER = ['htmlPubPr', 'webPr', 'prnPr', 'showPr', 'clrMru', 'extLst'] as const;

const localName = (key: string): string => key.replace(/^@_/u, '').replace(/^.*:/u, '');
const findKey = (node: XmlObject, name: string): string | undefined =>
	Object.keys(node).find((key) => localName(key) === name);

function parseBoolean(value: unknown): boolean | undefined {
	if (value === '1' || value === 'true' || value === true) {
		return true;
	}
	if (value === '0' || value === 'false' || value === false) {
		return false;
	}
	return undefined;
}

function readEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>): T | undefined {
	const text = typeof value === 'string' ? value : String(value ?? '');
	return allowed.has(text as T) ? (text as T) : undefined;
}

export function parsePrintProperties(node: XmlObject): PptxPresentationPrintProperties {
	return {
		printWhat: readEnum(node['@_prnWhat'], PRINT_OUTPUTS),
		colorMode: readEnum(node['@_clrMode'], COLOR_MODES),
		hiddenSlides: parseBoolean(node['@_hiddenSlides']),
		scaleToFitPaper: parseBoolean(node['@_scaleToFitPaper']),
		frameSlides: parseBoolean(node['@_frameSlides']),
		rawXml: node,
	};
}

function applyAttribute(
	node: XmlObject,
	name: string,
	value: string | boolean | null | undefined,
): void {
	const existingKey = findKey(node, name);
	if (value === null) {
		if (existingKey) {
			delete node[existingKey];
		}
	} else if (value !== undefined) {
		node[existingKey ?? `@_${name}`] = typeof value === 'boolean' ? (value ? '1' : '0') : value;
	}
}

export function serializePrintProperties(properties: PptxPresentationPrintProperties): XmlObject {
	if (
		properties.printWhat !== undefined &&
		properties.printWhat !== null &&
		!PRINT_OUTPUTS.has(properties.printWhat)
	) {
		throw new RangeError(`Invalid PresentationML print output: ${String(properties.printWhat)}`);
	}
	if (
		properties.colorMode !== undefined &&
		properties.colorMode !== null &&
		!COLOR_MODES.has(properties.colorMode)
	) {
		throw new RangeError(
			`Invalid PresentationML print color mode: ${String(properties.colorMode)}`,
		);
	}

	const source = { ...(properties.rawXml ?? {}) } as XmlObject;
	applyAttribute(source, 'prnWhat', properties.printWhat);
	applyAttribute(source, 'clrMode', properties.colorMode);
	applyAttribute(source, 'hiddenSlides', properties.hiddenSlides);
	applyAttribute(source, 'scaleToFitPaper', properties.scaleToFitPaper);
	applyAttribute(source, 'frameSlides', properties.frameSlides);

	const result: XmlObject = {};
	for (const [key, value] of Object.entries(source)) {
		if (key.startsWith('@_')) {
			result[key] = value;
		}
	}
	for (const [key, value] of Object.entries(source)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			result[key] = value;
		}
	}
	const extKey = findKey(source, 'extLst');
	if (extKey) {
		result[extKey] = source[extKey];
	}
	return result;
}

export function findChildByLocalName(parent: XmlObject, name: string): XmlObject | undefined {
	const key = findKey(parent, name);
	return key ? (parent[key] as XmlObject | undefined) : undefined;
}

export function setPresentationPropertiesChild(
	root: XmlObject,
	name: (typeof ROOT_ORDER)[number],
	value: XmlObject | null,
): XmlObject {
	const values = new Map<string, [string, XmlObject | XmlObject[] | string | undefined]>();
	for (const [key, child] of Object.entries(root)) {
		if (!key.startsWith('@_')) {
			values.set(localName(key), [key, child]);
		}
	}
	if (value === null) {
		values.delete(name);
	} else {
		values.set(name, [values.get(name)?.[0] ?? `p:${name}`, value]);
	}

	const result: XmlObject = {};
	for (const [key, child] of Object.entries(root)) {
		if (key.startsWith('@_')) {
			result[key] = child;
		}
	}
	for (const orderedName of ROOT_ORDER) {
		const entry = values.get(orderedName);
		if (entry) {
			result[entry[0]] = entry[1];
		}
		values.delete(orderedName);
	}
	for (const [, [key, child]] of values) {
		result[key] = child;
	}
	return result;
}

export function slidesPerPageToPrintOutput(value: number): PptxPrintOutput {
	if (![1, 2, 3, 4, 6, 9].includes(value)) {
		throw new RangeError('PresentationML handouts support 1, 2, 3, 4, 6, or 9 slides per page');
	}
	return `handouts${value}` as PptxPrintOutput;
}
