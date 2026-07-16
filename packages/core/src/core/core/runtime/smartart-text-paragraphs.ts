import { orderedXmlKey } from '../../geometry/custom-geometry-command-order';
import type {
	PptxSmartArtTextParagraph,
	PptxSmartArtTextParagraphItem,
	PptxSmartArtTextRun,
	XmlObject,
} from '../../types';
import { orderedSmartArtTextEntries } from './smartart-text-order';

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

function parseItem(key: string, raw: XmlObject): PptxSmartArtTextParagraphItem {
	const name = localName(key);
	if (name === 'r') {
		const run: PptxSmartArtTextRun = { text: directText(raw), rawXml: clone(raw) };
		const rPr = child(raw, 'rPr');
		if (rPr) {
			run.rPr = clone(rPr);
		}
		return { kind: 'run', run };
	}
	if (name === 'br') {
		const rPr = child(raw, 'rPr');
		return { kind: 'break', ...(rPr ? { rPr: clone(rPr) } : {}), rawXml: clone(raw) };
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
		};
	}
	return { kind: 'tab', rawXml: clone(raw) };
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
			items: orderedSmartArtTextEntries(paragraph).map(([key, item]) => parseItem(key, item)),
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
					return '\t';
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

function appendUnknownChildren(xml: XmlObject, raw: XmlObject | undefined, known: string[]): void {
	for (const [key, value] of Object.entries(raw ?? {})) {
		if (!key.startsWith('@_') && !known.includes(localName(key))) {
			xml[key] = clone(value) as XmlObject | XmlObject[] | string;
		}
	}
}

function appendChild(target: XmlObject, name: string, value: XmlObject, order: number): void {
	const seen = Object.keys(target).some((key) => key === name || key.startsWith(`${name}#`));
	target[seen ? orderedXmlKey(name, order) : name] = value;
}

function buildItem(item: PptxSmartArtTextParagraphItem): [string, XmlObject] {
	if (item.kind === 'run') {
		const xml = objectWithAttributes(item.run.rawXml as XmlObject | undefined);
		xml['a:rPr'] = (item.run.rPr as XmlObject | undefined) ?? { '@_lang': 'en-US' };
		xml['a:t'] = item.run.text;
		appendUnknownChildren(xml, item.run.rawXml as XmlObject | undefined, ['rPr', 't']);
		return ['a:r', xml];
	}
	if (item.kind === 'break') {
		const xml = objectWithAttributes(item.rawXml as XmlObject | undefined);
		if (item.rPr) {
			xml['a:rPr'] = item.rPr as XmlObject;
		}
		appendUnknownChildren(xml, item.rawXml as XmlObject | undefined, ['rPr']);
		return ['a:br', xml];
	}
	if (item.kind === 'field') {
		const xml = objectWithAttributes(item.rawXml as XmlObject | undefined);
		if (item.id) {
			xml['@_id'] = item.id;
		}
		if (item.fieldType) {
			xml['@_type'] = item.fieldType;
		}
		if (item.rPr) {
			xml['a:rPr'] = item.rPr as XmlObject;
		}
		if (item.pPr) {
			xml['a:pPr'] = item.pPr as XmlObject;
		}
		xml['a:t'] = item.text;
		appendUnknownChildren(xml, item.rawXml as XmlObject | undefined, ['rPr', 'pPr', 't']);
		return ['a:fld', xml];
	}
	const xml = objectWithAttributes(item.rawXml as XmlObject | undefined);
	appendUnknownChildren(xml, item.rawXml as XmlObject | undefined, []);
	return ['a:tab', xml];
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
	for (const [key, value] of Object.entries(paragraph.rawXml ?? {})) {
		if (
			!key.startsWith('@_') &&
			!['pPr', 'r', 'br', 'fld', 'tab', 'endParaRPr'].includes(localName(key))
		) {
			xml[key] = clone(value) as XmlObject | XmlObject[] | string;
		}
	}
	if (paragraph.endParaRPr) {
		xml['a:endParaRPr'] = paragraph.endParaRPr as XmlObject;
	}
	return xml;
}
