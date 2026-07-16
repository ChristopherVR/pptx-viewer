import type {
	PptxChartDataPoint,
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartShapeProps,
	XmlObject,
} from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

function safeInt(val: unknown): number | undefined {
	const n = parseInt(String(val), 10);
	return Number.isFinite(n) ? n : undefined;
}

function safeUnsignedInt(val: unknown): number | undefined {
	const n = Number(val);
	return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : undefined;
}

function booleanValue(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = node['@_val'];
	if (value === undefined) {
		return true;
	}
	const normalized = String(value);
	if (normalized === 'true' || normalized === '1') {
		return true;
	}
	if (normalized === 'false' || normalized === '0') {
		return false;
	}
	return undefined;
}

const MARKER_SYMBOL_MAP: Record<string, PptxChartMarkerSymbol> = {
	circle: 'circle',
	dash: 'dash',
	diamond: 'diamond',
	dot: 'dot',
	none: 'none',
	picture: 'picture',
	plus: 'plus',
	square: 'square',
	star: 'star',
	triangle: 'triangle',
	x: 'x',
	auto: 'auto',
};

/** Parse shape properties (c:spPr) into a flat object. */
export function parseShapeProps(
	spPrNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartShapeProps | undefined {
	if (!spPrNode) {
		return undefined;
	}
	const result: PptxChartShapeProps = {};
	let hasProps = false;

	const solidFill = xmlLookup.getChildByLocalName(spPrNode, 'solidFill');
	const fillColor = colorParser.parseColor(solidFill);
	if (fillColor) {
		result.fillColor = fillColor;
		hasProps = true;
	}

	const ln = xmlLookup.getChildByLocalName(spPrNode, 'ln');
	if (ln) {
		const lnFill = xmlLookup.getChildByLocalName(ln, 'solidFill');
		const strokeColor = colorParser.parseColor(lnFill);
		if (strokeColor) {
			result.strokeColor = strokeColor;
			hasProps = true;
		}
		const w = safeInt(ln['@_w']);
		if (w !== undefined) {
			result.strokeWidth = w / 12700;
			hasProps = true;
		}
		const prstDash = xmlLookup.getChildByLocalName(ln, 'prstDash');
		const dash = prstDash?.['@_val'];
		if (dash !== undefined && dash !== null && String(dash).length > 0) {
			result.strokeDashStyle = String(dash);
			hasProps = true;
		}
	}

	return hasProps ? result : undefined;
}

/** Parse a marker element (c:marker). */
export function parseMarker(
	markerNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartMarker | undefined {
	if (!markerNode) {
		return undefined;
	}

	const symbolNode = xmlLookup.getChildByLocalName(markerNode, 'symbol');
	const rawSymbol = String(symbolNode?.['@_val'] || '').trim();
	const symbol = MARKER_SYMBOL_MAP[rawSymbol];
	if (!symbol) {
		return undefined;
	}

	const result: PptxChartMarker = { symbol };

	const sizeNode = xmlLookup.getChildByLocalName(markerNode, 'size');
	const size = Number(sizeNode?.['@_val']);
	if (Number.isInteger(size) && size >= 2 && size <= 72) {
		result.size = size;
	}

	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(markerNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) {
		result.spPr = spPr;
	}

	return result;
}

/** Parse per-data-point formatting overrides (c:dPt). */
export function parseSeriesDataPoints(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartDataPoint[] {
	const dPtNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dPt');
	if (dPtNodes.length === 0) {
		return [];
	}

	return dPtNodes
		.map((node): PptxChartDataPoint | undefined => {
			const idxNode = xmlLookup.getChildByLocalName(node, 'idx');
			const idx = safeUnsignedInt(idxNode?.['@_val']);
			if (idx === undefined) {
				return undefined;
			}

			const result: PptxChartDataPoint = { idx };

			const spPr = parseShapeProps(
				xmlLookup.getChildByLocalName(node, 'spPr'),
				xmlLookup,
				colorParser,
			);
			if (spPr) {
				result.spPr = spPr;
			}

			const explosionNode = xmlLookup.getChildByLocalName(node, 'explosion');
			const explosion = safeUnsignedInt(explosionNode?.['@_val']);
			if (explosion !== undefined) {
				result.explosion = explosion;
			}

			const invertIfNegative = booleanValue(
				xmlLookup.getChildByLocalName(node, 'invertIfNegative'),
			);
			if (invertIfNegative !== undefined) {
				result.invertIfNegative = invertIfNegative;
			}

			const markerResult = parseMarker(
				xmlLookup.getChildByLocalName(node, 'marker'),
				xmlLookup,
				colorParser,
			);
			if (markerResult) {
				result.marker = markerResult;
			}

			const bubble3D = booleanValue(xmlLookup.getChildByLocalName(node, 'bubble3D'));
			if (bubble3D !== undefined) {
				result.bubble3D = bubble3D;
			}

			return result;
		})
		.filter((dp): dp is PptxChartDataPoint => dp !== undefined);
}

/** Parse series-level explosion attribute (c:explosion). */
export function parseSeriesExplosion(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
): number | undefined {
	const explosionNode = xmlLookup.getChildByLocalName(seriesNode, 'explosion');
	return safeInt(explosionNode?.['@_val']);
}

export { parseSeriesDataLabels } from './chart-data-label-parser';
