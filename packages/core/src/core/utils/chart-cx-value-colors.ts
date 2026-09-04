/**
 * Parser for ChartEx (`cx:`) "colour by value" gradient scales
 * (`cx:valueColors` + `cx:valueColorPositions`), used by region-map
 * (choropleth), treemap, and sunburst series to tint leaves/regions by
 * magnitude rather than by category (C2-G6).
 *
 * `cx:valueColorPositions/cx:pos/@type` mirrors Excel conditional
 * formatting's colour-scale breakpoint kinds (`min`/`max`/`num`/`percent`,
 * ST_ColorPositionType); `num` is normalised to `'number'` here to read as a
 * word rather than an abbreviation, matching this codebase's style
 * elsewhere (e.g. `showValue` vs. OOXML's `showVal`).
 *
 * `cx:valueColors`'s own child element names are read structurally rather
 * than by a specific expected name: each direct child is tried as a colour
 * wrapper (the same shape `a:solidFill` is, so `ColorParserLike.parseColor`
 * resolves it directly), in document order. This is deliberately resilient
 * to whichever exact names (`cx:minColor`/`cx:maxColor` vs. a repeated
 * `cx:color`) real ChartEx XML uses, since only the resolved colours (in
 * order, aligned with `valueColorPositions`) matter to the caller.
 *
 * @module utils/chart-cx-value-colors
 */

import type { PptxCxValueColorPosition, XmlObject } from '../types';
import type { ColorParserLike, XmlLookupLike } from './chart-cx-parser';

const POSITION_KIND_MAP: Record<string, PptxCxValueColorPosition['kind']> = {
	min: 'min',
	max: 'max',
	num: 'number',
	percent: 'percent',
};

function parseValueColors(node: XmlObject, colorParser: ColorParserLike): string[] | undefined {
	const colors: string[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		const items = Array.isArray(value) ? value : [value];
		for (const item of items) {
			if (item && typeof item === 'object') {
				const color = colorParser.parseColor(item as XmlObject);
				if (color) {
					colors.push(color);
				}
			}
		}
	}
	return colors.length > 0 ? colors : undefined;
}

function parseValueColorPositions(
	node: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxCxValueColorPosition[] | undefined {
	const positions: PptxCxValueColorPosition[] = [];
	for (const posNode of xmlLookup.getChildrenArrayByLocalName(node, 'pos')) {
		const kind = POSITION_KIND_MAP[String(posNode['@_type'] ?? '').trim()];
		if (!kind) {
			continue;
		}
		const entry: PptxCxValueColorPosition = { kind };
		const rawVal = posNode['@_val'];
		if (rawVal !== undefined) {
			const num = Number.parseFloat(String(rawVal));
			if (Number.isFinite(num)) {
				entry.value = num;
			}
		}
		positions.push(entry);
	}
	return positions.length > 0 ? positions : undefined;
}

/**
 * Parse a `cx:series`'s `cx:valueColors`/`cx:valueColorPositions` colour
 * scale. Colours are only resolved when a `colorParser` is supplied
 * (mirroring `extractCxSeriesColor`); positions parse either way since they
 * carry no colour choice of their own.
 */
export function parseCxValueColors(
	series: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
): { valueColors?: string[]; valueColorPositions?: PptxCxValueColorPosition[] } | undefined {
	const valueColorsNode = xmlLookup.getChildByLocalName(series, 'valueColors');
	const valueColorPositionsNode = xmlLookup.getChildByLocalName(series, 'valueColorPositions');
	if (!valueColorsNode && !valueColorPositionsNode) {
		return undefined;
	}

	const result: { valueColors?: string[]; valueColorPositions?: PptxCxValueColorPosition[] } = {};
	if (valueColorsNode && colorParser) {
		const colors = parseValueColors(valueColorsNode, colorParser);
		if (colors) {
			result.valueColors = colors;
		}
	}
	if (valueColorPositionsNode) {
		const positions = parseValueColorPositions(valueColorPositionsNode, xmlLookup);
		if (positions) {
			result.valueColorPositions = positions;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}
