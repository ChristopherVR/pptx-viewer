import { XmlObject } from '../../types';
import type { PptxPresentationProperties } from '../../types';

function parseXmlBoolean(value: unknown, defaultValue: boolean): boolean {
	if (value === true || value === 1) {
		return true;
	}
	if (value === false || value === 0) {
		return false;
	}
	const lexical = String(value ?? '')
		.trim()
		.toLowerCase();
	if (lexical === 'true' || lexical === '1') {
		return true;
	}
	if (lexical === 'false' || lexical === '0') {
		return false;
	}
	return defaultValue;
}

/**
 * Parse show properties (p:showPr) from presentation properties XML.
 * Returns partial presentation properties with show-related settings.
 *
 * @param showPr    The `p:showPr` node.
 * @param parseColor Optional colour resolver for `p:penClr`, matching the
 *                   generic `EG_ColorChoice` resolver (`srgbClr` / `schemeClr`
 *                   / `sysClr` / `prstClr` / `hslClr` / `scrgbClr`) the rest of
 *                   the codebase uses. Defaults to the legacy `a:srgbClr`-only
 *                   read when omitted, so existing single-argument call sites
 *                   (and this module's own tests) keep working; a caller that
 *                   has a theme-resolving `parseColor` available (the runtime
 *                   class does) should pass it to also resolve a scheme/preset
 *                   pen colour (P1-G2).
 */
export function parseShowProperties(
	showPr: XmlObject,
	parseColor?: (colorNode: XmlObject) => string | undefined,
): Partial<PptxPresentationProperties> {
	const props: Partial<PptxPresentationProperties> = {};

	// Show type
	if (showPr['p:present']) {
		props.showType = 'presented';
	} else if (showPr['p:browse']) {
		props.showType = 'browsed';
		const browseNode = showPr['p:browse'] as XmlObject;
		// P1-G1: `p:browse/@showScrollbar` (schema default true). Only read the
		// attribute when authored; an absent attribute leaves `showScrollbar`
		// undefined rather than forcing the spec default, matching this
		// module's convention elsewhere (see `embedTrueTypeFonts`).
		if (browseNode?.['@_showScrollbar'] !== undefined) {
			props.showScrollbar = parseXmlBoolean(browseNode['@_showScrollbar'], true);
		}
	} else if (showPr['p:kiosk']) {
		props.showType = 'kiosk';
		// Parse kiosk restart interval (in ms)
		const kioskNode = showPr['p:kiosk'] as XmlObject;
		const restartRaw = kioskNode?.['@_restart'];
		if (restartRaw !== undefined) {
			const restartMs = Number.parseInt(String(restartRaw), 10);
			if (Number.isFinite(restartMs) && restartMs > 0) {
				props.kioskRestartTime = restartMs;
			}
		}
	}

	props.loopContinuously = parseXmlBoolean(showPr['@_loop'], false);
	props.showWithNarration = parseXmlBoolean(showPr['@_showNarration'], true);
	props.showWithAnimation = parseXmlBoolean(showPr['@_showAnimation'], true);

	// Advance mode
	if (!parseXmlBoolean(showPr['@_useTimings'], true)) {
		props.advanceMode = 'manual';
	} else {
		props.advanceMode = 'useTimings';
	}

	// Pen colour (P1-G2: `p:penClr` is a full `a:CT_Color` / EG_ColorChoice,
	// not only `a:srgbClr` - a scheme swatch from the Set Up Show dialog's pen
	// colour picker parsed to `undefined` before this resolver was threaded in).
	const penClr = showPr['p:penClr'] as XmlObject | undefined;
	if (penClr) {
		const resolved = parseColor
			? parseColor(penClr)
			: (() => {
					const srgbClr = penClr['a:srgbClr'] as XmlObject | undefined;
					const val = String(srgbClr?.['@_val'] || '').trim();
					return val.length > 0 ? `#${val}` : undefined;
				})();
		if (resolved) {
			props.penColor = resolved;
			// Preserved for save (`rebuildShowProperties`): a scheme/preset
			// swatch re-emits verbatim when the caller never touches penColor,
			// instead of being flattened to a baked `a:srgbClr`.
			props.penColorOriginal = resolved;
			props.penColorXml = penClr;
		}
	}

	// Show slides range / custom show
	const sldRg = showPr['p:sldRg'] as XmlObject | undefined;
	const custShow = showPr['p:custShow'] as XmlObject | undefined;
	if (sldRg) {
		props.showSlidesMode = 'range';
		const st = Number.parseInt(String(sldRg['@_st'] ?? '1'), 10);
		const end = Number.parseInt(String(sldRg['@_end'] ?? '1'), 10);
		if (Number.isFinite(st)) {
			props.showSlidesFrom = st;
		}
		if (Number.isFinite(end)) {
			props.showSlidesTo = end;
		}
	} else if (custShow) {
		props.showSlidesMode = 'customShow';
		const csId = String(custShow['@_id'] ?? '').trim();
		if (csId.length > 0) {
			props.showSlidesCustomShowId = csId;
		}
	} else {
		props.showSlidesMode = 'all';
	}

	return props;
}
