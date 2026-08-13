import type { PptxPresentationProperties, XmlObject } from '../../types';

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
		properties.penColor !== undefined
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
		target['p:browse'] = {};
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
		result['p:penClr'] = { 'a:srgbClr': { '@_val': properties.penColor.replace('#', '') } };
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
