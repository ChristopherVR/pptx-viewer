import type {
	PptxChartDataLabel,
	PptxChartDataLabelPosition,
	PptxChartDataLabelOptions,
	XmlObject,
} from '../types';
import {
	findChart15Ext,
	parseDataLabelFieldTable,
	showsDataLabelsRange,
} from './chart-data-label-field-table';
import {
	groupShowsDataLabelsRange,
	parseDataLabelsRange,
	parseXForSave,
} from './chart-data-labels-range';
import { parseDefRPrTextStyle, resolveTxPrDefRPr } from './chart-def-rpr-style';
import { parseChartManualLayout } from './chart-layout';
import { parseShapeProps } from './chart-series-detail-parser';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/**
 * Resolve a `c:dLbls` group's leader-line stroke styling for offset
 * (pie/doughnut `outEnd`/`bestFit`) labels. PowerPoint writes the style twice:
 * once as a plain `c:leaderLines/c:spPr` (the transitional-schema form) and
 * again, identically, inside the chart15 extension
 * (`c:extLst/c:ext/c15:leaderLines/c:spPr`) for readers that only look there.
 * Office itself treats the extension copy as authoritative when both are
 * present, so it is checked first; the base element is the fallback for
 * strict-schema files that omit the extension.
 */
function parseLeaderLineStyle(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): ReturnType<typeof parseShapeProps> {
	const ext = findChart15Ext(group, xmlLookup);
	const extLeaderLines = ext ? xmlLookup.getChildByLocalName(ext, 'leaderLines') : undefined;
	const extSpPr = extLeaderLines
		? xmlLookup.getChildByLocalName(extLeaderLines, 'spPr')
		: undefined;
	if (extSpPr) {
		return parseShapeProps(extSpPr, xmlLookup, colorParser);
	}

	const baseLeaderLines = xmlLookup.getChildByLocalName(group, 'leaderLines');
	const baseSpPr = baseLeaderLines
		? xmlLookup.getChildByLocalName(baseLeaderLines, 'spPr')
		: undefined;
	return baseSpPr ? parseShapeProps(baseSpPr, xmlLookup, colorParser) : undefined;
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

/** Resolve a possibly-prefixed XML key to its local name (`c:layout` -> `layout`). */
function localNameOf(key: string): string {
	const colonIndex = key.lastIndexOf(':');
	return colonIndex >= 0 ? key.slice(colonIndex + 1) : key;
}

function numberFormatCode(
	node: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): string | undefined {
	const numFmtNode = xmlLookup.getChildByLocalName(node, 'numFmt');
	const formatCode = String(numFmtNode?.['@_formatCode'] ?? '').trim();
	return formatCode.length > 0 ? formatCode : undefined;
}

/** Parse individual `c:dLbl` overrides and validate their simple-type values. */
export function parseSeriesDataLabels(
	seriesNode: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
): PptxChartDataLabel[] {
	const group = xmlLookup.getChildByLocalName(seriesNode, 'dLbls');
	const nodes = group
		? xmlLookup.getChildrenArrayByLocalName(group, 'dLbl')
		: xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dLbl');
	const fieldTable = group ? parseDataLabelFieldTable(group, xmlLookup) : undefined;
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
		// PowerPoint 2013+ "Value From Cells": when enabled for this point AND
		// no literal c:tx/c:rich override already won above, resolve straight to
		// the linked range's cached text (see parseDataLabelFieldTable).
		if (result.text === undefined && fieldTable && showsDataLabelsRange(node, xmlLookup)) {
			const cellText = fieldTable.get(idx);
			if (cellText !== undefined) {
				result.text = cellText;
			}
		}
		// `c15:xForSave`: this override exists only to survive a save/reload
		// round trip (see chart-data-labels-range.ts's doc). Round-tripped for
		// introspection; the save path preserves the point's whole extLst.
		const forSave = parseXForSave(node, xmlLookup);
		if (forSave !== undefined) {
			result.savedForCompatibilityOnly = forSave;
		}
		const numberFormat = numberFormatCode(node, xmlLookup);
		if (numberFormat !== undefined) {
			result.numberFormat = numberFormat;
		}
		const layout = parseChartManualLayout(node, localNameOf);
		if (layout) {
			result.layout = layout;
		}
		if (colorParser) {
			const txPrStyle = parseDefRPrTextStyle(
				resolveTxPrDefRPr(xmlLookup.getChildByLocalName(node, 'txPr'), xmlLookup),
				xmlLookup,
				colorParser,
				resolveTypeface,
			);
			if (txPrStyle) {
				result.txPr = txPrStyle;
			}
			const spPr = parseShapeProps(
				xmlLookup.getChildByLocalName(node, 'spPr'),
				xmlLookup,
				colorParser,
			);
			if (spPr) {
				result.spPr = spPr;
			}
		}
		return [result];
	});
}

/** Parse the common typed children of a chart-type `c:dLbls`. */
export function parseChartDataLabelOptions(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
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
	const numberFormat = numberFormatCode(group, xmlLookup);
	if (numberFormat !== undefined) {
		result.numberFormat = numberFormat;
	}
	// PowerPoint 2013+ "Value From Cells", series-wide form: one cell range
	// supplies every label in this group (see chart-data-labels-range.ts).
	const dataLabelsRange = parseDataLabelsRange(group, xmlLookup);
	if (dataLabelsRange) {
		result.dataLabelsRange = dataLabelsRange;
		result.showDataLabelsRange = groupShowsDataLabelsRange(group, xmlLookup);
	}
	if (colorParser) {
		const txPrStyle = parseDefRPrTextStyle(
			resolveTxPrDefRPr(xmlLookup.getChildByLocalName(group, 'txPr'), xmlLookup),
			xmlLookup,
			colorParser,
			resolveTypeface,
		);
		if (txPrStyle) {
			result.txPr = txPrStyle;
		}
		const leaderLineStyle = parseLeaderLineStyle(group, xmlLookup, colorParser);
		if (leaderLineStyle) {
			result.leaderLineStyle = leaderLineStyle;
		}
	}
	return result;
}
