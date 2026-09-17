import type { PptxChartAxisFormatting, PptxChart3DSurface, XmlObject } from '../types';
import { parseChartAxisDisplayUnits } from './chart-axis-dispunits-serializer';
import { parseChartAxisLabelFormatting } from './chart-axis-label-formatting';
import { parseChartAxisScaling } from './chart-axis-scaling';
import { parseChartDateAxisUnits } from './chart-date-axis';
import { parseShapeProps } from './chart-series-detail-parser';
import { collectAllText } from './chart-title-xml-ops';

export { upsertChartAxisChild } from './chart-axis-scaling';

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

/**
 * Whether `node` has a child named `name`, by KEY existence rather than
 * `getChildByLocalName`'s "resolves to a non-array object" check. A childless,
 * attribute-less element (`<c:majorGridlines/>`) is a legal, common way to
 * mark a boolean flag present, but fast-xml-parser renders it as an empty
 * STRING, which `getChildByLocalName` cannot distinguish from "absent".
 */
export function hasLocalName(node: XmlObject, name: string): boolean {
	if (Object.hasOwn(node, name)) {
		return true;
	}
	const suffix = `:${name}`;
	return Object.keys(node).some((key) => key.endsWith(suffix));
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
	resolveTypeface?: (raw: string) => string,
): PptxChartAxisFormatting[] {
	const result: PptxChartAxisFormatting[] = [];

	for (const key of Object.keys(plotArea)) {
		const localName = getLocalName(key);
		const axisType = AXIS_TYPE_MAP[localName];
		if (!axisType) {
			continue;
		}

		const axisNodes = xmlLookup.getChildrenArrayByLocalName(plotArea, localName);
		for (const axisNode of axisNodes) {
			const axis = parseSingleAxis(
				axisNode,
				axisType,
				xmlLookup,
				colorParser,
				getLocalName,
				resolveTypeface,
			);
			if (axis) {
				result.push(axis);
			}
		}
	}

	return result;
}

function parseSingleAxis(
	axisNode: XmlObject,
	axisType: PptxChartAxisFormatting['axisType'],
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	getLocalName: (key: string) => string,
	resolveTypeface?: (raw: string) => string,
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

	const numFmtNode = xmlLookup.getChildByLocalName(axisNode, 'numFmt');
	if (numFmtNode) {
		const formatCode = String(numFmtNode['@_formatCode'] || '').trim();
		if (formatCode) {
			result.numFmt = {
				formatCode,
				sourceLinked: numFmtNode['@_sourceLinked'] === '1',
			};
		}
	}

	const titleNode = xmlLookup.getChildByLocalName(axisNode, 'title');
	if (titleNode) {
		const texts: string[] = [];
		collectAllText(titleNode, getLocalName, texts);
		if (texts.length > 0) {
			result.titleText = texts.join('');
		}
	}

	// Shape properties on the axis itself
	const spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(axisNode, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (spPr) {
		result.spPr = spPr;
	}

	// Font properties from txPr
	parseTxPr(
		xmlLookup.getChildByLocalName(axisNode, 'txPr'),
		xmlLookup,
		colorParser,
		result,
		resolveTypeface,
	);
	Object.assign(result, parseChartAxisLabelFormatting(axisNode, axisType, getLocalName));

	// Axis ID and cross-axis ID
	const axIdNode = xmlLookup.getChildByLocalName(axisNode, 'axId');
	if (axIdNode) {
		const axId = safeInt(axIdNode['@_val']);
		if (axId !== undefined) {
			result.axisId = axId;
		}
	}

	const crossAxNode = xmlLookup.getChildByLocalName(axisNode, 'crossAx');
	if (crossAxNode) {
		const crossId = safeInt(crossAxNode['@_val']);
		if (crossId !== undefined) {
			result.crossAxisId = crossId;
		}
	}

	// Deleted/hidden axis (c:delete/@val)
	const deleteNode = xmlLookup.getChildByLocalName(axisNode, 'delete');
	if (deleteNode) {
		const delVal = deleteNode['@_val'];
		if (delVal === '1') {
			result.deleted = true;
		}
	}

	// Scaling: range, logarithm, and direction.
	const scalingNode = xmlLookup.getChildByLocalName(axisNode, 'scaling');
	parseChartAxisScaling(scalingNode, result, (parent, name) =>
		xmlLookup.getChildByLocalName(parent, name),
	);

	// Gridlines. Presence alone means "shown" (`c:majorGridlines`/`c:minorGridlines`
	// carry no `@val`): a childless, attribute-less `<c:majorGridlines/>` parses
	// to an empty STRING via fast-xml-parser (the same quirk `<a:noFill/>` has
	// elsewhere in this codebase), which `getChildByLocalName`'s
	// "must be a non-array object" guard treats as absent. That silently
	// dropped gridlines on any chart whose `c:majorGridlines` has no `c:spPr`
	// child (PowerPoint writes this bare form constantly), while a styled
	// `<c:majorGridlines><c:spPr>...</c:spPr></c:majorGridlines>` happened to
	// parse as a real object and kept working. Check key existence directly
	// instead, mirroring `IPptxXmlLookupService.hasChildByLocalName` (not on
	// the narrower `XmlLookupLike` this module accepts).
	if (hasLocalName(axisNode, 'majorGridlines')) {
		result.majorGridlines = true;
		result.majorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(
				xmlLookup.getChildByLocalName(axisNode, 'majorGridlines'),
				'spPr',
			),
			xmlLookup,
			colorParser,
		);
	}

	if (hasLocalName(axisNode, 'minorGridlines')) {
		result.minorGridlines = true;
		result.minorGridlinesSpPr = parseShapeProps(
			xmlLookup.getChildByLocalName(
				xmlLookup.getChildByLocalName(axisNode, 'minorGridlines'),
				'spPr',
			),
			xmlLookup,
			colorParser,
		);
	}

	// Display units (c:dispUnits) — applies to value axes
	const dispUnitsNode = xmlLookup.getChildByLocalName(axisNode, 'dispUnits');
	if (dispUnitsNode) {
		parseChartAxisDisplayUnits(dispUnitsNode, xmlLookup, colorParser, result, getLocalName);
	}

	// Major/minor unit intervals (c:majorUnit/@val, c:minorUnit/@val)
	const majorUnitNode = xmlLookup.getChildByLocalName(axisNode, 'majorUnit');
	if (majorUnitNode) {
		const majorVal = parseFloat(String(majorUnitNode['@_val']));
		if (Number.isFinite(majorVal)) {
			result.majorUnit = majorVal;
		}
	}
	const minorUnitNode = xmlLookup.getChildByLocalName(axisNode, 'minorUnit');
	if (minorUnitNode) {
		const minorVal = parseFloat(String(minorUnitNode['@_val']));
		if (Number.isFinite(minorVal)) {
			result.minorUnit = minorVal;
		}
	}
	parseChartDateAxisUnits(axisNode, result, (parent, name) =>
		xmlLookup.getChildByLocalName(parent, name),
	);

	return result;
}

function parseTxPr(
	txPrNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	target: PptxChartAxisFormatting,
	resolveTypeface?: (raw: string) => string,
): void {
	if (!txPrNode) {
		return;
	}

	const pNode = xmlLookup.getChildByLocalName(txPrNode, 'p');
	if (!pNode) {
		return;
	}

	const pPr = xmlLookup.getChildByLocalName(pNode, 'pPr');
	const defRPr = xmlLookup.getChildByLocalName(pPr, 'defRPr');
	if (!defRPr) {
		return;
	}

	const sz = safeInt(defRPr['@_sz']);
	if (sz !== undefined) {
		target.fontSize = sz / 100;
	}

	if (defRPr['@_b'] === '1') {
		target.fontBold = true;
	}

	const latin = xmlLookup.getChildByLocalName(defRPr, 'latin');
	if (latin?.['@_typeface']) {
		const raw = String(latin['@_typeface']);
		target.fontFamily = resolveTypeface ? resolveTypeface(raw) : raw;
	}

	const solidFill = xmlLookup.getChildByLocalName(defRPr, 'solidFill');
	const fontColor = colorParser.parseColor(solidFill);
	if (fontColor) {
		target.fontColor = fontColor;
	}
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
		if (!node) {
			continue;
		}

		const surface: PptxChart3DSurface = {};
		let hasSurface = false;

		const thickness = safeInt(xmlLookup.getChildByLocalName(node, 'thickness')?.['@_val']);
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

		if (hasSurface) {
			result[name] = surface;
		}
	}

	return result;
}
