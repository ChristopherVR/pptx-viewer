/**
 * Serialize a {@link PlaceholderTextLevelStyle} back into an `a:lvlXpPr` /
 * `a:defPPr` node (CT_TextParagraphProperties, ECMA-376 §21.1.2.2.7), the
 * exact inverse of `parsePlaceholderLevelStyle`
 * (`PptxHandlerRuntimePlaceholderStyles.ts`).
 *
 * Every write merges into the existing node via {@link mergeOrderedXml}
 * rather than rebuilding it: only the fields explicitly set on the typed
 * style are touched, and any attribute, run-property, or child this model
 * does not cover (tab stops, extensions, ...) survives untouched, in its
 * original schema position.
 *
 * @module placeholder-level-style-serializer
 */
import type { PlaceholderTextLevelStyle, XmlObject } from '../types';
import { mergeOrderedXml } from './ordered-xml-merge';

const EMU_PER_PX = 9525;
/** px -> hundredths-of-a-point: px * (72/96) * 100. */
const PT_HUNDREDTHS_PER_PX = 75;

const ALIGN_TO_XML: Record<string, string> = {
	left: 'l',
	center: 'ctr',
	right: 'r',
	justify: 'just',
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
	if (style.indent !== undefined) {
		attrEdits.indent = String(Math.round(style.indent * EMU_PER_PX));
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
		childEdits.set('a:solidFill', { 'a:srgbClr': { '@_val': style.color.replace('#', '') } });
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
		childEdits.set('a:buClr', { 'a:srgbClr': { '@_val': style.bulletColor.replace('#', '') } });
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
