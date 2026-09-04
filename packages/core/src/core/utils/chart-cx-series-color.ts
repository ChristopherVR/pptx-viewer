/**
 * Resolve a ChartEx (`cx:`) series' fill colour (`cx:series/cx:spPr`) to a
 * hex string.
 *
 * The original implementation only ever read a literal `a:srgbClr` under
 * `a:solidFill`, so a series coloured through a theme accent
 * (`a:schemeClr`, the default PowerPoint's own ChartEx authoring UI writes)
 * silently parsed to no colour at all. When a colour parser is supplied
 * (the same `ColorParserLike` shape classic chart parsers thread through,
 * resolving `a:schemeClr`/`a:sysClr`/`a:prstClr` against the deck's theme),
 * this also falls back to a gradient's first stop or a pattern's foreground
 * when there is no solid fill, matching the fallback classic chart data
 * points and user-shape overlays use for the same "single representative
 * colour" need.
 *
 * @module utils/chart-cx-series-color
 */

import type { XmlObject } from '../types';
import type { ColorParserLike, XmlLookupLike } from './chart-cx-parser';

/** Extract a hex color from a cx:spPr fill (solid, then gradient/pattern fallback). */
export function extractCxSeriesColor(
	ser: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
): string | undefined {
	const spPr = xmlLookup.getChildByLocalName(ser, 'spPr');
	if (!spPr) {
		return undefined;
	}

	const solidFill = xmlLookup.getChildByLocalName(spPr, 'solidFill');
	if (solidFill) {
		const resolved = colorParser?.parseColor(solidFill);
		if (resolved) {
			return resolved;
		}
		// No colour parser (or it could not resolve the choice): fall back to
		// the original behaviour of reading a literal a:srgbClr only, so
		// callers that never pass a colorParser keep working unchanged.
		const srgb = xmlLookup.getChildByLocalName(solidFill, 'srgbClr');
		const val = String(srgb?.['@_val'] || '').trim();
		return val.length === 6 ? `#${val}` : undefined;
	}

	if (!colorParser) {
		return undefined;
	}

	const gradFill = xmlLookup.getChildByLocalName(spPr, 'gradFill');
	if (gradFill) {
		const gsLst = xmlLookup.getChildByLocalName(gradFill, 'gsLst');
		const firstStop = xmlLookup.getChildrenArrayByLocalName(gsLst, 'gs')[0];
		const resolved = firstStop ? colorParser.parseColor(firstStop) : undefined;
		if (resolved) {
			return resolved;
		}
	}

	const pattFill = xmlLookup.getChildByLocalName(spPr, 'pattFill');
	if (pattFill) {
		const fgClr = xmlLookup.getChildByLocalName(pattFill, 'fgClr');
		return colorParser.parseColor(fgClr);
	}

	return undefined;
}
