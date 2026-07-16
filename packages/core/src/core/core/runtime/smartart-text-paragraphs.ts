import { orderedXmlKey } from '../../geometry/custom-geometry-command-order';
import type {
	PptxSmartArtTextParagraph,
	PptxSmartArtTextParagraphItem,
	PptxSmartArtTextRun,
	XmlObject,
} from '../../types';
import { orderedSmartArtTextEntries, smartArtChildOrder } from './smartart-text-order';

type XmlValue = XmlObject | XmlObject[] | string;

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
}

function keyFor(node: XmlObject, name: string): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function child(node: XmlObject, name: string): XmlObject | undefined {
	const key = keyFor(node, name);
	const value = key ? node[key] : undefined;
	if (key && (value === '' || value === undefined)) {
		return {};
	}
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function directText(node: XmlObject): string {
	const key = keyFor(node, 't');
	const value = key ? node[key] : undefined;
	return value === undefined || value === null ? '' : String(value);
}

function parseItem(key: string, rawValue: unknown): PptxSmartArtTextParagraphItem {
	const name = localName(key);
	if (!['r', 'br', 'fld', 'tab'].includes(name)) {
		return { kind: 'raw', name: key, value: clone(rawValue) };
	}
	const raw =
		rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
			? (rawValue as XmlObject)
			: {};
	if (name === 'r') {
		const run: PptxSmartArtTextRun = {
			text: directText(raw),
			rawXml: clone(raw),
			childOrder: smartArtChildOrder(raw),
		};
		const rPr = child(raw, 'rPr');
		if (rPr) {
			run.rPr = clone(rPr);
		}
		return { kind: 'run', run };
	}
	if (name === 'br') {
		const rPr = child(raw, 'rPr');
		return {
			kind: 'break',
			...(rPr ? { rPr: clone(rPr) } : {}),
			rawXml: clone(raw),
			childOrder: smartArtChildOrder(raw),
		};
	}
	if (name === 'fld') {
		const rPr = child(raw, 'rPr');
		const pPr = child(raw, 'pPr');
		return {
			kind: 'field',
			...(raw['@_id'] ? { id: String(raw['@_id']) } : {}),
			...(raw['@_type'] ? { fieldType: String(raw['@_type']) } : {}),
			text: directText(raw),
			...(rPr ? { rPr: clone(rPr) } : {}),
			...(pPr ? { pPr: clone(pPr) } : {}),
			rawXml: clone(raw),
			childOrder: smartArtChildOrder(raw),
		};
	}
	if (name === 'tab') {
		return { kind: 'tab', rawXml: clone(raw), childOrder: smartArtChildOrder(raw) };
	}
	return { kind: 'raw', name: key, value: clone(rawValue) };
}

/** Parse every paragraph of a SmartArt point into an ordered typed model. */
export function parseSmartArtTextParagraphs(
	point: XmlObject,
): PptxSmartArtTextParagraph[] | undefined {
	const body = child(point, 't');
	if (!body) {
		return undefined;
	}
	const pKey = keyFor(body, 'p');
	const raw = pKey ? body[pKey] : undefined;
	const paragraphNodes = (Array.isArray(raw) ? raw : raw ? [raw] : []) as XmlObject[];
	if (paragraphNodes.length === 0) {
		return undefined;
	}
	return paragraphNodes.map((paragraph) => {
		const pPr = child(paragraph, 'pPr');
		const endParaRPr = child(paragraph, 'endParaRPr');
		return {
			...(pPr ? { pPr: clone(pPr) } : {}),
			items: orderedSmartArtTextEntries(paragraph).flatMap(([key, item]) =>
				['pPr', 'endParaRPr'].includes(localName(key)) ? [] : [parseItem(key, item)],
			),
			...(endParaRPr ? { endParaRPr: clone(endParaRPr) } : {}),
			rawXml: clone(paragraph),
		};
	});
}

/** Flatten typed SmartArt paragraphs into the legacy node text value. */
export function smartArtParagraphsText(paragraphs: PptxSmartArtTextParagraph[]): string {
	return paragraphs
		.map((paragraph) =>
			paragraph.items
				.map((item) => {
					if (item.kind === 'run') {
						return item.run.text;
					}
					if (item.kind === 'field') {
						return item.text;
					}
					if (item.kind === 'break') {
						return '\n';
					}
					return item.kind === 'tab' ? '\t' : '';
				})
				.join(''),
		)
		.join('\n');
}

/** Project first-paragraph regular runs for the legacy `node.runs` API. */
export function firstParagraphRuns(
	paragraphs: PptxSmartArtTextParagraph[] | undefined,
): PptxSmartArtTextRun[] | undefined {
	const runs = paragraphs?.[0]?.items.flatMap((item) => (item.kind === 'run' ? [item.run] : []));
	return runs && runs.length > 0 ? runs : undefined;
}

function objectWithAttributes(raw: XmlObject | undefined): XmlObject {
	return Object.fromEntries(
		Object.entries(raw ?? {}).filter(([key]) => key.startsWith('@_')),
	) as XmlObject;
}

function appendChild(target: XmlObject, name: string, value: XmlValue, order: number): void {
	const seen = Object.keys(target).some((key) => key === name || key.startsWith(`${name}#`));
	target[seen ? orderedXmlKey(name, order) : name] = value;
}

function buildOrderedContainer(
	raw: XmlObject | undefined,
	order: string[] | undefined,
	replacements: Array<[string, XmlValue]>,
): XmlObject {
	const xml = objectWithAttributes(raw);
	const keys = new Map<string, string>();
	for (const key of Object.keys(raw ?? {})) {
		if (!key.startsWith('@_')) {
			keys.set(localName(key), key);
		}
	}
	const values = (name: string): XmlValue[] => {
		const key = keys.get(name);
		const value = key ? raw?.[key] : undefined;
		return (Array.isArray(value) ? value : value === undefined ? [] : [value]) as XmlValue[];
	};
	const derivedOrder = order ?? [...keys.keys()].flatMap((name) => values(name).map(() => name));
	const replacementMap = new Map(
		replacements.map(([name, value]) => [localName(name), [name, value]]),
	);
	const emittedReplacements = new Set<string>();
	const consumed = new Map<string, number>();
	let outputOrder = 0;
	for (const name of derivedOrder) {
		const replacement = replacementMap.get(name);
		if (replacement && !emittedReplacements.has(name)) {
			appendChild(xml, replacement[0] as string, replacement[1] as XmlValue, outputOrder++);
			emittedReplacements.add(name);
			continue;
		}
		const index = consumed.get(name) ?? 0;
		const value = values(name)[index];
		consumed.set(name, index + 1);
		const key = keys.get(name);
		if (key && value !== undefined) {
			appendChild(xml, key, clone(value), outputOrder++);
		}
	}
	for (const [name, value] of replacements) {
		if (!emittedReplacements.has(localName(name))) {
			appendChild(xml, name, value, outputOrder++);
		}
	}
	return xml;
}

function buildItem(item: PptxSmartArtTextParagraphItem): [string, XmlValue] {
	if (item.kind === 'run') {
		return [
			'a:r',
			buildOrderedContainer(item.run.rawXml as XmlObject | undefined, item.run.childOrder, [
				['a:rPr', (item.run.rPr as XmlObject | undefined) ?? { '@_lang': 'en-US' }],
				['a:t', item.run.text],
			]),
		];
	}
	if (item.kind === 'break') {
		return [
			'a:br',
			buildOrderedContainer(
				item.rawXml as XmlObject | undefined,
				item.childOrder,
				item.rPr ? [['a:rPr', item.rPr as XmlObject]] : [],
			),
		];
	}
	if (item.kind === 'field') {
		const replacements: Array<[string, XmlValue]> = [];
		if (item.rPr) {
			replacements.push(['a:rPr', item.rPr as XmlObject]);
		}
		if (item.pPr) {
			replacements.push(['a:pPr', item.pPr as XmlObject]);
		}
		replacements.push(['a:t', item.text]);
		const xml = buildOrderedContainer(
			item.rawXml as XmlObject | undefined,
			item.childOrder,
			replacements,
		);
		if (item.id) {
			xml['@_id'] = item.id;
		}
		if (item.fieldType) {
			xml['@_type'] = item.fieldType;
		}
		return ['a:fld', xml];
	}
	if (item.kind === 'tab') {
		return [
			'a:tab',
			buildOrderedContainer(item.rawXml as XmlObject | undefined, item.childOrder, []),
		];
	}
	return [item.name, clone(item.value) as XmlValue];
}

/** Build ordered `a:p` XML while retaining unmodelled paragraph children. */
export function buildSmartArtTextParagraph(paragraph: PptxSmartArtTextParagraph): XmlObject {
	const xml = objectWithAttributes(paragraph.rawXml as XmlObject | undefined);
	if (paragraph.pPr) {
		xml['a:pPr'] = paragraph.pPr as XmlObject;
	}
	let order = 0;
	for (const item of paragraph.items) {
		const [name, value] = buildItem(item);
		appendChild(xml, name, value, order++);
	}
	if (paragraph.endParaRPr) {
		xml['a:endParaRPr'] = paragraph.endParaRPr as XmlObject;
	}
	return xml;
}
