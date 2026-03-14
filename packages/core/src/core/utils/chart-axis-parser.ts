import type {
	PptxChartAxisFormatting,
	PptxChart3DSurface,
	XmlObject,
} from '../types';
import { parseShapeProps } from './chart-series-detail-parser';

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

const AXIS_TYPE_MAP: Record<string, PptxChartAxisFormatting['axisType']> = {
	catAx: 'catAx',
	valAx: 'valAx',
	dateAx: 'dateAx',
	serAx: 'serAx',
};

/** Parse all axes (c:catAx, c:valAx, c:dateAx, c:serAx) from plot area. */
export function parseChartAxes(
	plotArea: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	getLocalName: (key: string) => string,
): PptxChartAxisFormatting[] {
	const result: PptxChartAxisFormatting[] = [];

	for (const key of Object.keys(plotArea)) {
		const localName = getLocalName(key);
		const axisType = AXIS_TYPE_MAP[localName];
		if (!axisType) continue;

		const axisNodes = xmlLookup.getChildrenArrayByLocalName(
			plotArea,
			localName,
		);
		for (const axisNode of axisNodes) {
			const axis = parseSingleAxis(
				axisNode,
				axisType,
				xmlLookup,
				colorParser,
			);
			if (axis) result.push(axis);
		}
	}

	return result;
}

function parseSingleAxis(
	axisNode: XmlObject,
	axisType: PptxChartAxisFormatting['axisType'],
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartAxisFormatting | undefined {
	const result: PptxChartAxisFormatting = { axisType };

	// Axis position (c:axPos/@val)
	const axPosNode = xmlLookup.getChildByLocalName(axisNode, 'axPos');
	if (axPosNode) {
		const posVal = String(axPosNode['@_val'] || '').trim();
		if (posVal === 'b' || posVal === 'l' || posVal === 'r' || posVal === 't') {
			result.axPos = posVal;
		}
	}

	// Number format
	const numFmtNode = xmlLookup.getChildByLocalName(axisNode, 'numFmt');
	if (numFmtNode) {
		const formatCode = String(numFmtNode['@_formatCode'] || '').trim();
		if (formatCode) {
			result.numFmt = {
				formatCode,
				sourceLinked:
					numFmtNode['@_sourceLinked'] === '1' ||
					numFmtNode['@_sourceLinked'] === true,
			};
		}
	}

	// Axis title
	const titleNode = xmlLookup.getChildByLocalName(axisNode, 'title');
	if (titleNode) {
		const texts: string[] = [];
		collectAxisTextValues(titleNode, texts);
		if (texts.length > 0) result.titleText = texts.join('');
	}

	// Shape properties on the axis itself
	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(axisNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) result.spPr = spPr;

	// Font properties from txPr
	parseTxPr(
		xmlLookup.getChildByLocalName(axisNode, 'txPr'),
		xmlLookup,
		colorParser,
		result,
	);

	// Gridlines
	const majorGrid = xmlLookup.getChildByLocalName(
		axisNode,
		'majorGridlines',
	);
	if (majorGrid) {
		result.majorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(majorGrid, 'spPr'),
			xmlLookup,
			colorParser,
		);
	}

	const minorGrid = xmlLookup.getChildByLocalName(
		axisNode,
		'minorGridlines',
	);
	if (minorGrid) {
		result.minorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(minorGrid, 'spPr'),
			xmlLookup,
			colorParser,
		);
	}

	return result;
}

function parseTxPr(
	txPrNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	target: PptxChartAxisFormatting,
): void {
	if (!txPrNode) return;

	const pNode = xmlLookup.getChildByLocalName(txPrNode, 'p');
	if (!pNode) return;

	const pPr = xmlLookup.getChildByLocalName(pNode, 'pPr');
	const defRPr = xmlLookup.getChildByLocalName(pPr, 'defRPr');
	if (!defRPr) return;

	const sz = safeInt(defRPr['@_sz']);
	if (sz !== undefined) target.fontSize = sz / 100;

	if (defRPr['@_b'] === '1' || defRPr['@_b'] === true) {
		target.fontBold = true;
	}

	const latin = xmlLookup.getChildByLocalName(defRPr, 'latin');
	if (latin?.['@_typeface']) {
		target.fontFamily = String(latin['@_typeface']);
	}

	const solidFill = xmlLookup.getChildByLocalName(defRPr, 'solidFill');
	const fontColor = colorParser.parseColor(solidFill);
	if (fontColor) target.fontColor = fontColor;
}

/** Parse 3D chart surfaces (c:floor, c:sideWall, c:backWall). */
export function parseChart3DSurfaces(
	chartRoot: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): {
	floor?: PptxChart3DSurface;
	sideWall?: PptxChart3DSurface;
	backWall?: PptxChart3DSurface;
} {
	const result: {
		floor?: PptxChart3DSurface;
		sideWall?: PptxChart3DSurface;
		backWall?: PptxChart3DSurface;
	} = {};

	const surfaceNames = ['floor', 'sideWall', 'backWall'] as const;
	for (const name of surfaceNames) {
		const node = xmlLookup.getChildByLocalName(chartRoot, name);
		if (!node) continue;

		const surface: PptxChart3DSurface = {};
		let hasSurface = false;

		const thickness = safeInt(
			xmlLookup.getChildByLocalName(node, 'thickness')?.['@_val'],
		);
		if (thickness !== undefined) {
			surface.thickness = thickness;
			hasSurface = true;
		}

		const spPr = parseShapeProps(
			xmlLookup.getChildByLocalName(node, 'spPr'),
			xmlLookup,
			colorParser,
		);
		if (spPr) {
			surface.spPr = spPr;
			hasSurface = true;
		}

		if (hasSurface) result[name] = surface;
	}

	return result;
}

/** Recursively collect text values from axis title nodes. */
function collectAxisTextValues(node: XmlObject, results: string[]): void {
	if (node['a:t'] !== undefined) {
		results.push(String(node['a:t']));
	}
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) continue;
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === 'object') {
					collectAxisTextValues(item as XmlObject, results);
				}
			}
		} else if (child && typeof child === 'object') {
			collectAxisTextValues(child as XmlObject, results);
		}
	}
}
