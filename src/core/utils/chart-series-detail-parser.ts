import type {
	PptxChartDataPoint,
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartDataLabel,
	PptxChartShapeProps,
	XmlObject,
} from '../types';

interface XmlLookupLike {
	getChildByLocalName(
		parent: XmlObject | undefined,
		name: string,
	): XmlObject | undefined;
	getChildrenArrayByLocalName(
		parent: XmlObject | undefined,
		name: string,
	): XmlObject[];
}

interface ColorParserLike {
	parseColor(
		fillNode: XmlObject | undefined,
		placeholderColor?: string,
	): string | undefined;
}

function safeInt(val: unknown): number | undefined {
	const n = parseInt(String(val), 10);
	return Number.isFinite(n) ? n : undefined;
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
	if (!spPrNode) return undefined;
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
	}

	return hasProps ? result : undefined;
}

/** Parse a marker element (c:marker). */
export function parseMarker(
	markerNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartMarker | undefined {
	if (!markerNode) return undefined;

	const symbolNode = xmlLookup.getChildByLocalName(markerNode, 'symbol');
	const rawSymbol = String(symbolNode?.['@_val'] || '').trim();
	const symbol = MARKER_SYMBOL_MAP[rawSymbol];
	if (!symbol) return undefined;

	const result: PptxChartMarker = { symbol };

	const sizeNode = xmlLookup.getChildByLocalName(markerNode, 'size');
	const size = safeInt(sizeNode?.['@_val']);
	if (size !== undefined) result.size = size;

	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(markerNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) result.spPr = spPr;

	return result;
}

/** Parse per-data-point formatting overrides (c:dPt). */
export function parseSeriesDataPoints(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartDataPoint[] {
	const dPtNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dPt');
	if (dPtNodes.length === 0) return [];

	return dPtNodes
		.map((node): PptxChartDataPoint | undefined => {
			const idxNode = xmlLookup.getChildByLocalName(node, 'idx');
			const idx = safeInt(idxNode?.['@_val']);
			if (idx === undefined) return undefined;

			const result: PptxChartDataPoint = { idx };

			const spPr = parseShapeProps(
				xmlLookup.getChildByLocalName(node, 'spPr'),
				xmlLookup,
				colorParser,
			);
			if (spPr) result.spPr = spPr;

			const explosionNode = xmlLookup.getChildByLocalName(node, 'explosion');
			const explosion = safeInt(explosionNode?.['@_val']);
			if (explosion !== undefined) result.explosion = explosion;

			const invertNode = xmlLookup.getChildByLocalName(
				node,
				'invertIfNegative',
			);
			if (
				invertNode?.['@_val'] === '1' ||
				invertNode?.['@_val'] === true
			) {
				result.invertIfNegative = true;
			}

			const markerResult = parseMarker(
				xmlLookup.getChildByLocalName(node, 'marker'),
				xmlLookup,
				colorParser,
			);
			if (markerResult) result.marker = markerResult;

			return result;
		})
		.filter((dp): dp is PptxChartDataPoint => dp !== undefined);
}

/** Parse individual data label overrides (c:dLbl). */
export function parseSeriesDataLabels(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartDataLabel[] {
	const dLblNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dLbl');
	if (dLblNodes.length === 0) return [];

	return dLblNodes
		.map((node): PptxChartDataLabel | undefined => {
			const idxNode = xmlLookup.getChildByLocalName(node, 'idx');
			const idx = safeInt(idxNode?.['@_val']);
			if (idx === undefined) return undefined;

			const result: PptxChartDataLabel = { idx };

			const boolFields = [
				['showVal', 'showVal'],
				['showCatName', 'showCatName'],
				['showSerName', 'showSerName'],
				['showPercent', 'showPercent'],
				['showLegendKey', 'showLegendKey'],
				['showBubbleSize', 'showBubbleSize'],
			] as const;

			for (const [xmlName, propName] of boolFields) {
				const child = xmlLookup.getChildByLocalName(node, xmlName);
				if (child?.['@_val'] === '1' || child?.['@_val'] === true) {
					result[propName] = true;
				} else if (child?.['@_val'] === '0' || child?.['@_val'] === false) {
					result[propName] = false;
				}
			}

			const layoutNode = xmlLookup.getChildByLocalName(node, 'dLblPos');
			if (layoutNode?.['@_val']) {
				result.position = String(layoutNode['@_val']);
			}

			const txNode = xmlLookup.getChildByLocalName(node, 'tx');
			if (txNode) {
				const richNode = xmlLookup.getChildByLocalName(txNode, 'rich');
				if (richNode) {
					const texts: string[] = [];
					collectTextValues(richNode, texts);
					if (texts.length > 0) {
						result.text = texts.join('');
					}
				}
			}

			return result;
		})
		.filter((dl): dl is PptxChartDataLabel => dl !== undefined);
}

/** Parse series-level explosion attribute (c:explosion). */
export function parseSeriesExplosion(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
): number | undefined {
	const explosionNode = xmlLookup.getChildByLocalName(
		seriesNode,
		'explosion',
	);
	return safeInt(explosionNode?.['@_val']);
}

/** Recursively collect text values from rich-text XML nodes. */
function collectTextValues(node: XmlObject, results: string[]): void {
	if (node['a:t'] !== undefined) {
		results.push(String(node['a:t']));
	}
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) continue;
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === 'object') {
					collectTextValues(item as XmlObject, results);
				}
			}
		} else if (child && typeof child === 'object') {
			collectTextValues(child as XmlObject, results);
		}
	}
}
