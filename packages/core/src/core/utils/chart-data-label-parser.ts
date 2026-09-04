import type {
	PptxChartDataLabel,
	PptxChartDataLabelPosition,
	PptxChartDataLabelOptions,
	XmlObject,
} from '../types';
import { parseChartManualLayout } from './chart-layout';

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

/** Recursively collect every object descendant (inclusive of `node` itself's children) whose local name is `target`. */
function collectByLocalName(node: XmlObject, target: string, out: XmlObject[]): void {
	for (const [key, child] of Object.entries(node)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		const items = Array.isArray(child) ? child : [child];
		for (const item of items) {
			if (item && typeof item === 'object') {
				if (localNameOf(key) === target) {
					out.push(item as XmlObject);
				}
				collectByLocalName(item as XmlObject, target, out);
			}
		}
	}
}

/**
 * Parse PowerPoint 2013+'s "Value From Cells" custom label text
 * (`c:dLbls/c:extLst/c:ext/c15:dlblFieldTable/c15:dlblFieldTableEntry`),
 * keyed by point index (`c:pt/@idx`).
 *
 * Distinct from the plain `c:dLbl/c:tx/c:rich` literal-text override: this
 * extension caches the linked cell range's text so a per-point label whose
 * `c15:showDataLabelsRange` flag is set can resolve straight to the cached
 * string, without needing the source workbook. Searched by local name only
 * (ignoring the exact `c15:`/`mc:AlternateContent` wrapping) since only the
 * idx -> text mapping matters here.
 */
function parseDataLabelFieldTable(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
): Map<number, string> | undefined {
	const extLst = xmlLookup.getChildByLocalName(group, 'extLst');
	if (!extLst) {
		return undefined;
	}
	const tables: XmlObject[] = [];
	collectByLocalName(extLst, 'dlblFieldTable', tables);
	if (tables.length === 0) {
		return undefined;
	}
	const points: XmlObject[] = [];
	for (const table of tables) {
		collectByLocalName(table, 'pt', points);
	}
	const map = new Map<number, string>();
	for (const pt of points) {
		const idx = Number.parseInt(String(pt['@_idx'] ?? ''), 10);
		if (!Number.isInteger(idx) || idx < 0) {
			continue;
		}
		const value = scalar(pt, 'v', xmlLookup);
		if (value !== undefined) {
			map.set(idx, value);
		}
	}
	return map.size > 0 ? map : undefined;
}

/** Whether a `c:dLbl`'s `c:extLst` carries a `c15:showDataLabelsRange` flag set to true. */
function showsDataLabelsRange(dLblNode: XmlObject, xmlLookup: XmlLookupLike): boolean {
	const extLst = xmlLookup.getChildByLocalName(dLblNode, 'extLst');
	if (!extLst) {
		return false;
	}
	const flags: XmlObject[] = [];
	collectByLocalName(extLst, 'showDataLabelsRange', flags);
	return flags.some((flag) => flag['@_val'] === '1' || flag['@_val'] === 'true');
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
		const numberFormat = numberFormatCode(node, xmlLookup);
		if (numberFormat !== undefined) {
			result.numberFormat = numberFormat;
		}
		const layout = parseChartManualLayout(node, localNameOf);
		if (layout) {
			result.layout = layout;
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
	const numberFormat = numberFormatCode(group, xmlLookup);
	if (numberFormat !== undefined) {
		result.numberFormat = numberFormat;
	}
	return result;
}
