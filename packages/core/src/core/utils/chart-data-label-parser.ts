import type {
	PptxChartDataLabel,
	PptxChartDataLabelPosition,
	PptxChartDataLabelOptions,
	XmlObject,
} from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

const POSITIONS = new Set<PptxChartDataLabelPosition>([
	'bestFit',
	'b',
	'ctr',
	'inBase',
	'inEnd',
	'l',
	'outEnd',
	'r',
	't',
]);

function uint32(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffffffff ? parsed : undefined;
}

function bool(node: XmlObject | undefined): boolean | undefined {
	const value = node?.['@_val'];
	if (value === '1' || value === 'true') {
		return true;
	}
	if (value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

function text(node: XmlObject, results: string[]): void {
	for (const [key, child] of Object.entries(node)) {
		if (key === 'a:t' || key.endsWith(':t')) {
			results.push(String(child));
		} else if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === 'object') {
					text(item, results);
				}
			}
		} else if (child && typeof child === 'object') {
			text(child as XmlObject, results);
		}
	}
}

function position(node: XmlObject | undefined): PptxChartDataLabelPosition | undefined {
	const value = node?.['@_val'];
	return POSITIONS.has(value as PptxChartDataLabelPosition)
		? (value as PptxChartDataLabelPosition)
		: undefined;
}

function scalar(parent: XmlObject, name: string, xmlLookup: XmlLookupLike): string | undefined {
	const value = xmlLookup.getScalarChildByLocalName?.(parent, name);
	if (value !== undefined) {
		return value;
	}
	const node = xmlLookup.getChildByLocalName(parent, name);
	return node?.['#text'] === undefined ? undefined : String(node['#text']);
}

/** Parse individual `c:dLbl` overrides and validate their simple-type values. */
export function parseSeriesDataLabels(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartDataLabel[] {
	const group = xmlLookup.getChildByLocalName(seriesNode, 'dLbls');
	const nodes = group
		? xmlLookup.getChildrenArrayByLocalName(group, 'dLbl')
		: xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dLbl');
	return nodes.flatMap((node) => {
		const idx = uint32(xmlLookup.getChildByLocalName(node, 'idx')?.['@_val']);
		if (idx === undefined) {
			return [];
		}
		const result: PptxChartDataLabel = { idx };
		const deleted = bool(xmlLookup.getChildByLocalName(node, 'delete'));
		if (deleted !== undefined) {
			result.deleted = deleted;
		}
		const fields = [
			['showVal', 'showVal'],
			['showCatName', 'showCatName'],
			['showSerName', 'showSerName'],
			['showPercent', 'showPercent'],
			['showLegendKey', 'showLegendKey'],
			['showBubbleSize', 'showBubbleSize'],
			['showLeaderLines', 'showLeaderLines'],
		] as const;
		for (const [xmlName, property] of fields) {
			const value = bool(xmlLookup.getChildByLocalName(node, xmlName));
			if (value !== undefined) {
				result[property] = value;
			}
		}
		const pos = position(xmlLookup.getChildByLocalName(node, 'dLblPos'));
		if (pos) {
			result.position = pos;
		}
		const separator = scalar(node, 'separator', xmlLookup);
		if (separator !== undefined) {
			result.separator = separator;
		}
		const rich = xmlLookup.getChildByLocalName(xmlLookup.getChildByLocalName(node, 'tx'), 'rich');
		if (rich) {
			const values: string[] = [];
			text(rich, values);
			if (values.length) {
				result.text = values.join('');
			}
		}
		return [result];
	});
}

/** Parse the common typed children of a chart-type `c:dLbls`. */
export function parseChartDataLabelOptions(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartDataLabelOptions {
	const result: PptxChartDataLabelOptions = {};
	const fields = [
		['showVal', 'showValue'],
		['showCatName', 'showCategory'],
		['showSerName', 'showSeriesName'],
		['showPercent', 'showPercent'],
		['showLegendKey', 'showLegendKey'],
		['showBubbleSize', 'showBubbleSize'],
		['showLeaderLines', 'showLeaderLines'],
	] as const;
	for (const [xmlName, property] of fields) {
		const value = bool(xmlLookup.getChildByLocalName(group, xmlName));
		if (value !== undefined) {
			result[property] = value;
		}
	}
	const pos = position(xmlLookup.getChildByLocalName(group, 'dLblPos'));
	if (pos) {
		result.position = pos;
	}
	const separator = scalar(group, 'separator', xmlLookup);
	if (separator !== undefined) {
		result.separator = separator;
	}
	return result;
}
