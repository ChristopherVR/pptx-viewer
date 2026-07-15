import type {
	PptxChartTrendline,
	PptxChartTrendlineType,
	PptxChartErrBars,
	PptxChartErrBarDir,
	PptxChartErrBarType,
	PptxChartErrValType,
	PptxChartDataTable,
	PptxChartLineStyle,
	XmlObject,
} from '../types';
import { parseTrendlineLabel } from './chart-trendline-label';

interface XmlLookupLike {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined;
	getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[];
}

interface ColorParserLike {
	parseColor(fillNode: XmlObject | undefined, placeholderColor?: string): string | undefined;
}

const TRENDLINE_TYPE_MAP: Record<string, PptxChartTrendlineType> = {
	linear: 'linear',
	exp: 'exponential',
	log: 'logarithmic',
	poly: 'polynomial',
	power: 'power',
	movingAvg: 'movingAvg',
};

const ERR_BAR_TYPE_MAP: Record<string, PptxChartErrBarType> = {
	both: 'both',
	minus: 'minus',
	plus: 'plus',
};

const ERR_VAL_TYPE_MAP: Record<string, PptxChartErrValType> = {
	cust: 'cust',
	fixedVal: 'fixedVal',
	percentage: 'percentage',
	stdDev: 'stdDev',
	stdErr: 'stdErr',
};

function safeInt(val: unknown): number | undefined {
	const n = parseInt(String(val), 10);
	return Number.isFinite(n) ? n : undefined;
}

function safeFloat(val: unknown): number | undefined {
	const n = parseFloat(String(val));
	return Number.isFinite(n) ? n : undefined;
}

function booleanValue(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = node['@_val'];
	return value === undefined || value === '1' ? true : value === '0' ? false : undefined;
}

export function parseSeriesTrendlines(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartTrendline[] {
	const trendlineNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'trendline');
	if (trendlineNodes.length === 0) {
		return [];
	}

	return trendlineNodes
		.map((node): PptxChartTrendline | undefined => {
			const typeNode = xmlLookup.getChildByLocalName(node, 'trendlineType');
			const rawType = String(typeNode?.['@_val'] || '').trim();
			const trendlineType = TRENDLINE_TYPE_MAP[rawType];
			if (!trendlineType) {
				return undefined;
			}

			const result: PptxChartTrendline = { trendlineType };
			const name = xmlLookup.getChildByLocalName(node, 'name');
			const nameText = typeof name === 'string' ? name : name?.['#text'];
			if (typeof nameText === 'string') {
				result.name = nameText;
			}

			const orderVal = safeInt(xmlLookup.getChildByLocalName(node, 'order')?.['@_val']);
			if (orderVal !== undefined && orderVal >= 2 && orderVal <= 6) {
				result.order = orderVal;
			}

			const periodVal = safeInt(xmlLookup.getChildByLocalName(node, 'period')?.['@_val']);
			if (periodVal !== undefined && periodVal >= 2) {
				result.period = periodVal;
			}

			const fwdVal = safeFloat(xmlLookup.getChildByLocalName(node, 'forward')?.['@_val']);
			if (fwdVal !== undefined) {
				result.forward = fwdVal;
			}

			const bkwdVal = safeFloat(xmlLookup.getChildByLocalName(node, 'backward')?.['@_val']);
			if (bkwdVal !== undefined) {
				result.backward = bkwdVal;
			}

			const interceptVal = safeFloat(xmlLookup.getChildByLocalName(node, 'intercept')?.['@_val']);
			if (interceptVal !== undefined) {
				result.intercept = interceptVal;
			}

			result.displayRSq = booleanValue(xmlLookup.getChildByLocalName(node, 'dispRSqr'));
			result.displayEq = booleanValue(xmlLookup.getChildByLocalName(node, 'dispEq'));
			if (result.displayRSq === undefined) {
				delete result.displayRSq;
			}
			if (result.displayEq === undefined) {
				delete result.displayEq;
			}

			const spPr = xmlLookup.getChildByLocalName(node, 'spPr');
			const lineColor = colorParser.parseColor(xmlLookup.getChildByLocalName(spPr, 'solidFill'));
			if (lineColor) {
				result.color = lineColor;
			}
			const labelNode = xmlLookup.getChildByLocalName(node, 'trendlineLbl');
			if (labelNode) {
				result.label = parseTrendlineLabel(labelNode, (key) => key.replace(/^.*:/u, ''));
			}

			return result;
		})
		.filter((t): t is PptxChartTrendline => t !== undefined);
}

export function parseSeriesErrBars(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
	extractPointValues: (container: XmlObject | undefined, preferNumeric: boolean) => string[],
	colorParser?: ColorParserLike,
): PptxChartErrBars[] {
	const errBarsNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'errBars');
	if (errBarsNodes.length === 0) {
		return [];
	}

	return errBarsNodes
		.map((node): PptxChartErrBars | undefined => {
			const errDirNode = xmlLookup.getChildByLocalName(node, 'errDir');
			const rawDir = String(errDirNode?.['@_val'] || 'y').trim();
			const direction: PptxChartErrBarDir = rawDir === 'x' ? 'x' : 'y';

			const errBarTypeNode = xmlLookup.getChildByLocalName(node, 'errBarType');
			const rawBarType = String(errBarTypeNode?.['@_val'] || 'both').trim();
			const barType = ERR_BAR_TYPE_MAP[rawBarType] ?? 'both';

			const errValTypeNode = xmlLookup.getChildByLocalName(node, 'errValType');
			const rawValType = String(errValTypeNode?.['@_val'] || '').trim();
			const valType = ERR_VAL_TYPE_MAP[rawValType];
			if (!valType) {
				return undefined;
			}

			const result: PptxChartErrBars = { direction, barType, valType };
			const noEndCap = booleanValue(xmlLookup.getChildByLocalName(node, 'noEndCap'));
			if (noEndCap !== undefined) {
				result.noEndCap = noEndCap;
			}

			const valNode = xmlLookup.getChildByLocalName(node, 'val');
			const numVal = safeFloat(valNode?.['@_val']);
			if (numVal !== undefined) {
				result.val = numVal;
			}

			if (valType === 'cust') {
				const plusNode = xmlLookup.getChildByLocalName(node, 'plus');
				const plusValues = extractPointValues(plusNode, true)
					.map((v) => parseFloat(v))
					.filter((v) => Number.isFinite(v));
				if (plusValues.length > 0) {
					result.customPlus = plusValues;
				}

				const minusNode = xmlLookup.getChildByLocalName(node, 'minus');
				const minusValues = extractPointValues(minusNode, true)
					.map((v) => parseFloat(v))
					.filter((v) => Number.isFinite(v));
				if (minusValues.length > 0) {
					result.customMinus = minusValues;
				}
			}
			const spPr = xmlLookup.getChildByLocalName(node, 'spPr');
			const lineColor = colorParser?.parseColor(
				xmlLookup.getChildByLocalName(xmlLookup.getChildByLocalName(spPr, 'ln'), 'solidFill'),
			);
			if (lineColor) {
				result.color = lineColor;
			}

			return result;
		})
		.filter((e): e is PptxChartErrBars => e !== undefined);
}

export function parseDataTable(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartDataTable | undefined {
	const dTable = xmlLookup.getChildByLocalName(plotArea, 'dTable');
	if (!dTable) {
		return undefined;
	}

	const result: PptxChartDataTable = {};
	const flags = ['showHorzBorder', 'showVertBorder', 'showOutline', 'showKeys'] as const;
	for (const flag of flags) {
		const node = xmlLookup.getChildByLocalName(dTable, flag);
		if (!node) {
			continue;
		}
		const value = node['@_val'];
		// CT_Boolean defaults val to true when the attribute is omitted.
		if (value === undefined || value === 'true' || value === '1') {
			result[flag] = true;
		} else if (value === 'false' || value === '0') {
			result[flag] = false;
		}
	}
	return result;
}

export function parseLineStyle(
	container: XmlObject | undefined,
	elementName: string,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartLineStyle | undefined {
	if (!container) {
		return undefined;
	}
	const lineNode = xmlLookup.getChildByLocalName(container, elementName);
	if (!lineNode) {
		return undefined;
	}

	const result: PptxChartLineStyle = {};
	const spPr = xmlLookup.getChildByLocalName(lineNode, 'spPr');
	if (spPr) {
		const lnNode = xmlLookup.getChildByLocalName(spPr, 'ln');
		if (lnNode) {
			const solidFill = xmlLookup.getChildByLocalName(lnNode, 'solidFill');
			const lineColor = colorParser.parseColor(solidFill);
			if (lineColor) {
				result.color = lineColor;
			}

			const widthEmu = safeInt(lnNode['@_w']);
			if (widthEmu !== undefined) {
				result.width = widthEmu / 12700;
			}

			const prstDash = xmlLookup.getChildByLocalName(lnNode, 'prstDash');
			if (prstDash?.['@_val']) {
				result.dashStyle = String(prstDash['@_val']);
			}
		}
	}

	return result;
}
