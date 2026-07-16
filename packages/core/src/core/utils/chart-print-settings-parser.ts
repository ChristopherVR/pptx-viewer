import type {
	PptxChartPageMargins,
	PptxChartPageSetup,
	PptxChartPrintHeaderFooter,
	PptxChartPrintSettings,
	XmlObject,
} from '../types';
import { cloneXmlObject } from './clone-utils';

type LocalName = (key: string) => string;
const HEADER_CHILDREN = [
	'oddHeader',
	'oddFooter',
	'evenHeader',
	'evenFooter',
	'firstHeader',
	'firstFooter',
] as const;
const ORIENTATIONS = new Set(['default', 'portrait', 'landscape']);

function keyOf(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): string | undefined {
	return node ? Object.keys(node).find((key) => localName(key) === name) : undefined;
}

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	const key = keyOf(node, name, localName);
	const value = key ? node?.[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function childText(node: XmlObject, name: string, localName: LocalName): string | undefined {
	const key = keyOf(node, name, localName);
	if (!key) {
		return undefined;
	}
	const value = node[key];
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const text = (value as XmlObject)['#text'];
		return text === undefined ? undefined : String(text);
	}
	return value === undefined || value === null ? undefined : String(value);
}

function boolAttr(node: XmlObject, name: string): boolean | undefined {
	const value = String(node[`@_${name}`] ?? '');
	if (value === '1' || value === 'true') {
		return true;
	}
	if (value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

function numberAttr(node: XmlObject, name: string): number | undefined {
	const raw = node[`@_${name}`];
	if (raw === undefined || raw === null || String(raw).trim() === '') {
		return undefined;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

function integerAttr(node: XmlObject, name: string, min: number, max: number): number | undefined {
	const value = numberAttr(node, name);
	return value !== undefined && Number.isInteger(value) && value >= min && value <= max
		? value
		: undefined;
}

function parseHeaderFooter(node: XmlObject, localName: LocalName): PptxChartPrintHeaderFooter {
	const result: PptxChartPrintHeaderFooter = { rawXml: cloneXmlObject(node) };
	for (const name of HEADER_CHILDREN) {
		const value = childText(node, name, localName);
		if (value !== undefined) {
			result[name] = value;
		}
	}
	for (const name of ['alignWithMargins', 'differentOddEven', 'differentFirst'] as const) {
		const value = boolAttr(node, name);
		if (value !== undefined) {
			result[name] = value;
		}
	}
	return result;
}

function parseMargins(node: XmlObject): PptxChartPageMargins | undefined {
	const values = ['l', 'r', 't', 'b', 'header', 'footer'].map((name) => numberAttr(node, name));
	if (values.some((value) => value === undefined)) {
		return undefined;
	}
	return {
		left: values[0]!,
		right: values[1]!,
		top: values[2]!,
		bottom: values[3]!,
		header: values[4]!,
		footer: values[5]!,
		rawXml: cloneXmlObject(node),
	};
}

function parsePageSetup(node: XmlObject): PptxChartPageSetup {
	const result: PptxChartPageSetup = { rawXml: cloneXmlObject(node) };
	for (const name of ['paperSize', 'firstPageNumber', 'copies'] as const) {
		const value = integerAttr(node, name, 0, 0xffffffff);
		if (value !== undefined) {
			result[name] = value;
		}
	}
	for (const name of ['horizontalDpi', 'verticalDpi'] as const) {
		const value = integerAttr(node, name, -0x80000000, 0x7fffffff);
		if (value !== undefined) {
			result[name] = value;
		}
	}
	for (const name of ['blackAndWhite', 'draft', 'useFirstPageNumber'] as const) {
		const value = boolAttr(node, name);
		if (value !== undefined) {
			result[name] = value;
		}
	}
	const orientation = String(node['@_orientation'] ?? '');
	if (ORIENTATIONS.has(orientation)) {
		result.orientation = orientation as PptxChartPageSetup['orientation'];
	}
	return result;
}

/** Parse classic ChartML CT_PrintSettings without depending on the `c` prefix. */
export function parseChartPrintSettings(
	chartSpace: XmlObject | undefined,
	localName: LocalName,
): PptxChartPrintSettings | undefined {
	const node = child(chartSpace, 'printSettings', localName);
	if (!node) {
		return undefined;
	}
	const header = child(node, 'headerFooter', localName);
	const margins = child(node, 'pageMargins', localName);
	const parsedMargins = margins ? parseMargins(margins) : undefined;
	const setup = child(node, 'pageSetup', localName);
	const legacy = child(node, 'legacyDrawingHF', localName);
	const relationshipId = legacy
		? Object.entries(legacy).find(([key]) => key.startsWith('@_') && localName(key) === 'id')?.[1]
		: undefined;
	return {
		...(header ? { headerFooter: parseHeaderFooter(header, localName) } : {}),
		...(parsedMargins ? { pageMargins: parsedMargins } : {}),
		...(setup ? { pageSetup: parsePageSetup(setup) } : {}),
		...(relationshipId !== undefined
			? { legacyDrawingHeaderFooterRelationshipId: String(relationshipId) }
			: {}),
		rawXml: cloneXmlObject(node),
	};
}
