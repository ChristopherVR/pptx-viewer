import type { PptxPresentationProperties, XmlObject } from '../../types';
import { colorsEqual } from '../../utils/color-xml-preservation';

/**
 * `p:showPr` (`CT_ShowProperties`) serialization.
 *
 * The content model is a fixed sequence:
 *   attributes, (present|browse|kiosk)?, (sldAll|sldRg|custShow)?, penClr?,
 *   sldLst?, extLst?
 * fast-xml-parser serialises object keys in insertion order, so the node is
 * rebuilt from scratch in that order rather than patched in place.
 */

const SHOW_CHOICE_KEYS = ['p:present', 'p:browse', 'p:kiosk'] as const;
const RANGE_CHOICE_KEYS = ['p:sldAll', 'p:sldRg', 'p:custShow'] as const;

/**
 * Whether the caller supplied any field that belongs to `p:showPr`.
 *
 * A deck whose `presProps.xml` carries no `p:showPr` (the common PowerPoint
 * shape: `p:extLst` only) must not gain a fabricated one just because a host
 * passed the loaded `presentationProperties` object straight back to `save()`.
 */
export function hasShowPropertyEdits(properties: PptxPresentationProperties): boolean {
	return (
		properties.showType !== undefined ||
		properties.loopContinuously !== undefined ||
		properties.showWithNarration !== undefined ||
		properties.showWithAnimation !== undefined ||
		properties.advanceMode !== undefined ||
		properties.showSlidesMode !== undefined ||
		properties.showSlidesFrom !== undefined ||
		properties.showSlidesTo !== undefined ||
		properties.showSlidesCustomShowId !== undefined ||
		properties.kioskRestartTime !== undefined ||
		properties.penColor !== undefined ||
		properties.showScrollbar !== undefined
	);
}

const firstExisting = (
	node: XmlObject,
	keys: readonly string[],
): [string, XmlObject | XmlObject[] | string | undefined] | undefined => {
	for (const key of keys) {
		if (node[key] !== undefined) {
			return [key, node[key]];
		}
	}
	return undefined;
};

function applyShowChoice(
	target: XmlObject,
	existing: XmlObject,
	properties: PptxPresentationProperties,
): void {
	if (properties.showType === 'browsed') {
		// P1-G1: carry over `@showScrollbar` instead of unconditionally emitting
		// an empty `p:browse` (which silently dropped an authored `false` on
		// ANY show-property edit, e.g. toggling an unrelated `loopContinuously`,
		// since PowerPoint's schema default for the attribute is `true`).
		// Precedence: the caller's typed field, then the existing node's own
		// attribute (untouched edit), then omitted (schema default applies).
		const browse: XmlObject = {};
		const existingBrowse = existing['p:browse'] as XmlObject | undefined;
		if (properties.showScrollbar !== undefined) {
			browse['@_showScrollbar'] = properties.showScrollbar ? '1' : '0';
		} else if (existingBrowse?.['@_showScrollbar'] !== undefined) {
			browse['@_showScrollbar'] = existingBrowse['@_showScrollbar'];
		}
		target['p:browse'] = browse;
		return;
	}
	if (properties.showType === 'kiosk') {
		const kiosk: XmlObject = {};
		if (properties.kioskRestartTime !== undefined && properties.kioskRestartTime > 0) {
			kiosk['@_restart'] = String(properties.kioskRestartTime);
		}
		target['p:kiosk'] = kiosk;
		return;
	}
	if (properties.showType === 'presented') {
		target['p:present'] = {};
		return;
	}
	// No caller opinion: keep whichever choice the source file carried, and
	// only fall back to `p:present` when it carried none.
	const preserved = firstExisting(existing, SHOW_CHOICE_KEYS);
	if (preserved) {
		target[preserved[0]] = preserved[1];
	} else {
		target['p:present'] = {};
	}
}

function applyRangeChoice(
	target: XmlObject,
	existing: XmlObject,
	properties: PptxPresentationProperties,
): void {
	if (properties.showSlidesMode === 'range') {
		target['p:sldRg'] = {
			'@_st': String(properties.showSlidesFrom ?? 1),
			'@_end': String(properties.showSlidesTo ?? 1),
		};
		return;
	}
	if (properties.showSlidesMode === 'customShow' && properties.showSlidesCustomShowId) {
		target['p:custShow'] = { '@_id': properties.showSlidesCustomShowId };
		return;
	}
	if (properties.showSlidesMode === 'all') {
		target['p:sldAll'] = {};
		return;
	}
	const preserved = firstExisting(existing, RANGE_CHOICE_KEYS);
	if (preserved) {
		target[preserved[0]] = preserved[1];
	} else {
		target['p:sldAll'] = {};
	}
}

/**
 * Rebuild `p:showPr` in schema order from the existing node plus the caller's
 * overrides.
 *
 * Returns `undefined` when the source had no `p:showPr` and the caller supplied
 * no show-related field, so a plain load-save leaves `presProps.xml` alone.
 */
export function rebuildShowProperties(
	existingShowPr: XmlObject | undefined,
	properties: PptxPresentationProperties,
): XmlObject | undefined {
	if (!existingShowPr && !hasShowPropertyEdits(properties)) {
		return undefined;
	}
	const existing = existingShowPr ?? {};
	const result: XmlObject = {};

	// 1. Attributes: pass existing ones through, then apply overrides.
	for (const key of Object.keys(existing)) {
		if (key.startsWith('@_')) {
			result[key] = existing[key];
		}
	}
	if (properties.loopContinuously !== undefined) {
		result['@_loop'] = properties.loopContinuously ? '1' : '0';
	}
	if (properties.showWithNarration !== undefined) {
		result['@_showNarration'] = properties.showWithNarration ? '1' : '0';
	}
	if (properties.showWithAnimation !== undefined) {
		result['@_showAnimation'] = properties.showWithAnimation ? '1' : '0';
	}
	if (properties.advanceMode !== undefined) {
		result['@_useTimings'] = properties.advanceMode === 'useTimings' ? '1' : '0';
	}

	applyShowChoice(result, existing, properties);
	applyRangeChoice(result, existing, properties);

	if (properties.penColor) {
		// P1-G2: re-emit the original scheme/preset/system colour-choice XML
		// verbatim when the resolved colour is unchanged from what was parsed,
		// instead of always flattening to a fresh `a:srgbClr` (which would
		// silently downgrade `<a:schemeClr val="accent2"/>` to a baked RGB hex
		// on any save, even one that never touched the pen colour).
		const unchanged =
			properties.penColorXml !== undefined &&
			colorsEqual(properties.penColorOriginal, properties.penColor);
		result['p:penClr'] = unchanged
			? (properties.penColorXml as XmlObject)
			: { 'a:srgbClr': { '@_val': properties.penColor.replace('#', '') } };
	} else if (existing['p:penClr'] !== undefined) {
		result['p:penClr'] = existing['p:penClr'];
	}
	if (existing['p:sldLst'] !== undefined) {
		result['p:sldLst'] = existing['p:sldLst'];
	}
	if (existing['p:extLst'] !== undefined) {
		result['p:extLst'] = existing['p:extLst'];
	}
	return result;
}
