/**
 * Serialize a {@link PlaceholderTextLevelStyle} back into an `a:lvlXpPr` /
 * `a:defPPr` node (CT_TextParagraphProperties, ECMA-376 §21.1.2.2.7), the
 * exact inverse of `parsePlaceholderLevelStyle`
 * (`PptxHandlerRuntimePlaceholderStyles.ts`).
 *
 * Every write merges into the existing node via {@link mergeOrderedXml}
 * rather than rebuilding it: only the fields explicitly set on the typed
 * style are touched, and any attribute, run-property, or child this model
 * does not cover (extensions, `a:buBlip`, ...) survives untouched, in its
 * original schema position. Preserved colour nodes (`colorChoiceXml`,
 * `bulletColorXml`) are re-emitted verbatim so theme aliases survive.
 *
 * @module placeholder-level-style-serializer
 */
import type { PlaceholderTextLevelStyle, XmlObject } from '../types';
import { colorsEqual } from './color-xml-preservation';
import { mergeOrderedXml } from './ordered-xml-merge';

const EMU_PER_PX = 9525;
/** px -> hundredths-of-a-point: px * (72/96) * 100. */
const PT_HUNDREDTHS_PER_PX = 75;

/** `TextStyle['align']` token -> `ST_TextAlignType`; the last three are spelled the same on both sides. */
const ALIGN_TO_XML: Record<string, string> = {
	left: 'l',
	center: 'ctr',
	right: 'r',
	justify: 'just',
	justLow: 'justLow',
	dist: 'dist',
	thaiDist: 'thaiDist',
};

/** CT_TextParagraphProperties child order (bullet group: buClr*, buSz*, buFont*, bu<type>). */
const LEVEL_PPR_CHILD_ORDER = [
	'a:lnSpc',
	'a:spcBef',
	'a:spcAft',
	'a:buClr',
	'a:buSzPct',
	'a:buSzPts',
	'a:buFont',
	'a:buNone',
	'a:buAutoNum',
	'a:buChar',
	'a:tabLst',
	'a:defRPr',
	'a:extLst',
] as const;

/** CT_TextCharacterProperties child order (only the fill-choice group needs mutual exclusion here). */
const DEF_RPR_CHILD_ORDER = [
	'a:ln',
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
	'a:effectLst',
	'a:effectDag',
	'a:highlight',
	'a:uLnTx',
	'a:uLn',
	'a:uFillTx',
	'a:uFill',
	'a:latin',
	'a:ea',
	'a:cs',
	'a:sym',
	'a:hlinkClick',
	'a:hlinkMouseOver',
	'a:rtl',
	'a:extLst',
] as const;

const FILL_VARIANTS = ['a:noFill', 'a:gradFill', 'a:blipFill', 'a:pattFill', 'a:grpFill'] as const;

export function serializePlaceholderLevelStyle(
	style: PlaceholderTextLevelStyle,
	existing?: XmlObject,
): XmlObject {
	const attrEdits: Record<string, string | null> = {};
	if (style.alignment !== undefined) {
		attrEdits.algn = ALIGN_TO_XML[style.alignment] ?? style.alignment;
	}
	if (style.marginLeft !== undefined) {
		attrEdits.marL = String(Math.round(style.marginLeft * EMU_PER_PX));
	}
	if (style.marginRight !== undefined) {
		attrEdits.marR = String(Math.round(style.marginRight * EMU_PER_PX));
	}
	if (style.indent !== undefined) {
		attrEdits.indent = String(Math.round(style.indent * EMU_PER_PX));
	}
	if (style.rtl !== undefined) {
		attrEdits.rtl = style.rtl ? '1' : '0';
	}
	if (style.defaultTabSize !== undefined) {
		attrEdits.defTabSz = String(Math.round(style.defaultTabSize * EMU_PER_PX));
	}
	if (style.eaLineBreak !== undefined) {
		attrEdits.eaLnBrk = style.eaLineBreak ? '1' : '0';
	}
	if (style.latinLineBreak !== undefined) {
		attrEdits.latinLnBrk = style.latinLineBreak ? '1' : '0';
	}
	if (style.fontAlignment !== undefined) {
		attrEdits.fontAlgn = style.fontAlignment;
	}
	if (style.hangingPunctuation !== undefined) {
		attrEdits.hangingPunct = style.hangingPunctuation ? '1' : '0';
	}

	const childEdits = new Map<string, XmlObject | null>();
	if (style.lineSpacing !== undefined) {
		childEdits.set('a:lnSpc', {
			'a:spcPct': { '@_val': String(Math.round(style.lineSpacing * 100000)) },
		});
	} else if (style.lineSpacingExactPt !== undefined) {
		childEdits.set('a:lnSpc', {
			'a:spcPts': { '@_val': String(Math.round(style.lineSpacingExactPt * 100)) },
		});
	}
	if (style.spaceBefore !== undefined) {
		childEdits.set('a:spcBef', {
			'a:spcPts': { '@_val': String(Math.round(style.spaceBefore * PT_HUNDREDTHS_PER_PX)) },
		});
	}
	if (style.spaceAfter !== undefined) {
		childEdits.set('a:spcAft', {
			'a:spcPts': { '@_val': String(Math.round(style.spaceAfter * PT_HUNDREDTHS_PER_PX)) },
		});
	}
	applyBulletGroup(childEdits, style);
	if (style.tabStops !== undefined) {
		childEdits.set(
			'a:tabLst',
			style.tabStops.length > 0 ? serializeTabStops(style.tabStops) : null,
		);
	}

	if (hasRunPropertyEdits(style)) {
		const existingDefRPr = existing?.['a:defRPr'] as XmlObject | undefined;
		childEdits.set('a:defRPr', serializeDefaultRunProperties(style, existingDefRPr));
	}

	return mergeOrderedXml(existing, attrEdits, childEdits, LEVEL_PPR_CHILD_ORDER);
}

function hasRunPropertyEdits(style: PlaceholderTextLevelStyle): boolean {
	return (
		style.fontSize !== undefined ||
		style.bold !== undefined ||
		style.italic !== undefined ||
		style.color !== undefined ||
		style.fontFamily !== undefined
	);
}

function serializeDefaultRunProperties(
	style: PlaceholderTextLevelStyle,
	existing: XmlObject | undefined,
): XmlObject {
	const attrEdits: Record<string, string | null> = {};
	if (style.fontSize !== undefined) {
		attrEdits.sz = String(Math.round(style.fontSize * PT_HUNDREDTHS_PER_PX));
	}
	if (style.bold !== undefined) {
		attrEdits.b = style.bold ? '1' : '0';
	}
	if (style.italic !== undefined) {
		attrEdits.i = style.italic ? '1' : '0';
	}

	const childEdits = new Map<string, XmlObject | null>();
	if (style.color !== undefined) {
		// `colorChoiceXml` is the whole authored `a:solidFill`; keep it (theme
		// alias + transforms) unless the hex was edited away from it.
		const preserved = preservedIfStillCurrent(style.colorChoiceXml, style.color);
		childEdits.set('a:solidFill', preserved ?? srgbChoice(style.color));
		for (const variant of FILL_VARIANTS) {
			childEdits.set(variant, null);
		}
	}
	if (style.fontFamily !== undefined) {
		const latin: XmlObject = { ...((existing?.['a:latin'] as XmlObject | undefined) ?? {}) };
		latin['@_typeface'] = style.fontFamily;
		childEdits.set('a:latin', latin);
	}

	return mergeOrderedXml(existing, attrEdits, childEdits, DEF_RPR_CHILD_ORDER);
}

function applyBulletGroup(
	childEdits: Map<string, XmlObject | null>,
	style: PlaceholderTextLevelStyle,
): void {
	if (style.bulletColor !== undefined) {
		// A themed `a:schemeClr` bullet is re-emitted as authored; only a hex
		// edited away from the preserved node falls back to a literal srgb.
		const preserved = preservedIfStillCurrent(style.bulletColorXml, style.bulletColor);
		childEdits.set('a:buClr', preserved ?? srgbChoice(style.bulletColor));
	} else if (style.bulletColorXml !== undefined) {
		childEdits.set('a:buClr', style.bulletColorXml);
	}
	if (style.bulletSizePercent !== undefined) {
		childEdits.set('a:buSzPct', { '@_val': String(Math.round(style.bulletSizePercent * 1000)) });
		childEdits.set('a:buSzPts', null);
	} else if (style.bulletSizePts !== undefined) {
		childEdits.set('a:buSzPts', { '@_val': String(Math.round(style.bulletSizePts * 100)) });
		childEdits.set('a:buSzPct', null);
	}
	if (style.bulletFontFamily !== undefined) {
		childEdits.set('a:buFont', { '@_typeface': style.bulletFontFamily });
	}

	const touchesType =
		style.bulletNone !== undefined ||
		style.bulletChar !== undefined ||
		style.bulletAutoNumType !== undefined;
	if (!touchesType) {
		return;
	}
	childEdits.set('a:buNone', style.bulletNone ? {} : null);
	childEdits.set(
		'a:buAutoNum',
		style.bulletAutoNumType !== undefined ? { '@_type': style.bulletAutoNumType } : null,
	);
	childEdits.set(
		'a:buChar',
		style.bulletChar !== undefined ? { '@_char': style.bulletChar } : null,
	);
}

/** `a:tabLst` from typed tab stops (positions px -> EMU); mirrors the paragraph writer. */
function serializeTabStops(
	tabStops: NonNullable<PlaceholderTextLevelStyle['tabStops']>,
): XmlObject {
	return {
		'a:tab': tabStops.map((tab) => {
			const node: XmlObject = { '@_pos': String(Math.round(tab.position * EMU_PER_PX)) };
			if (tab.align && tab.align !== 'l') {
				node['@_algn'] = tab.align;
			}
			if (tab.leader && tab.leader !== 'none') {
				node['@_leader'] = tab.leader;
			}
			return node;
		}),
	};
}

function srgbChoice(hex: string): XmlObject {
	return { 'a:srgbClr': { '@_val': hex.replace('#', '') } };
}

/**
 * Decide whether a preserved colour node still describes `hex`.
 *
 * A themed choice (`a:schemeClr`, `a:sysClr`, ...) cannot be resolved here
 * (no theme in scope), so it is trusted and re-emitted as authored: an
 * editor that changes the colour is expected to clear the preserved node.
 * A literal `a:srgbClr` can be compared, so a hex that moved away from it
 * wins over the stale node.
 */
function preservedIfStillCurrent(
	preserved: XmlObject | undefined,
	hex: string,
): XmlObject | undefined {
	if (!preserved) {
		return undefined;
	}
	const srgb = preserved['a:srgbClr'] as XmlObject | undefined;
	if (srgb && !colorsEqual(String(srgb['@_val'] ?? ''), hex)) {
		return undefined;
	}
	return preserved;
}
