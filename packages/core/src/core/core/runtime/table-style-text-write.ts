/**
 * table-style-text-write.ts - write-side mirror of
 * `table-style-fill-parse.ts`'s `parseTableStyleSectionText` for a table-
 * style section's `a:tcTxStyle`.
 *
 * @module table-style-text-write
 */
import type { ParsedTableStyleText, XmlObject } from '../../types';
import { reorderObjectKeys } from '../../utils/xml-reorder';
import { COLOR_CHOICE_KEYS, colorChoiceXml, ensureChild } from './table-style-xml-helpers';

/** `CT_TableStyleTextStyle` child order (§21.1.3.15): font choice, colour choice, extLst. */
const TC_TX_STYLE_ORDER: readonly string[] = [
	'a:font',
	'a:fontRef',
	...COLOR_CHOICE_KEYS,
	'a:extLst',
];

/**
 * Write bold/italic/underline, typeface, and text colour onto a table-style
 * section's `a:tcTxStyle`. The colour is `CT_TableStyleTextStyle`'s OWN
 * `EG_ColorChoice` child, a sibling of `a:fontRef`: that is where PowerPoint
 * writes it (`<a:fontRef idx="minor"><a:prstClr val="black"/></a:fontRef>
 * <a:schemeClr val="lt1"/>` is a white header on every built-in style) and
 * where it reads it from. `a:fontRef` itself only carries the font-collection
 * index; whatever colour PowerPoint left inside it is preserved untouched. An
 * earlier version of this writer nested the colour inside `a:fontRef` and
 * deleted the top-level one, which PowerPoint ignores: the edited colour
 * never showed up in PowerPoint.
 */
export function writeTableStyleSectionText(section: XmlObject, text: ParsedTableStyleText): void {
	const tcTxStyle = ensureChild(section, 'a:tcTxStyle');

	if (text.bold !== undefined) {
		if (text.bold) {
			tcTxStyle['@_b'] = 'on';
		} else {
			delete tcTxStyle['@_b'];
		}
	}
	if (text.italic !== undefined) {
		if (text.italic) {
			tcTxStyle['@_i'] = 'on';
		} else {
			delete tcTxStyle['@_i'];
		}
	}
	if (text.underline !== undefined) {
		tcTxStyle['@_u'] = text.underline ? 'sng' : 'none';
	}
	if (text.fontFace !== undefined) {
		if (text.fontFace) {
			const font = ensureChild(tcTxStyle, 'a:font');
			font['@_typeface'] = text.fontFace;
		} else {
			delete tcTxStyle['a:font'];
		}
	}

	if (text.fontRefIdx !== undefined) {
		ensureChild(tcTxStyle, 'a:fontRef')['@_idx'] = text.fontRefIdx;
	}
	if (text.fontSchemeColor !== undefined || text.fontColor !== undefined) {
		const fontRef = ensureChild(tcTxStyle, 'a:fontRef');
		if (!fontRef['@_idx']) {
			fontRef['@_idx'] = 'minor';
		}
		// A scheme/sRGB colour the earlier writer nested inside `a:fontRef` is
		// the one being replaced; PowerPoint's own `a:prstClr` there stays.
		delete fontRef['a:schemeClr'];
		delete fontRef['a:srgbClr'];
		for (const key of COLOR_CHOICE_KEYS) {
			delete tcTxStyle[key];
		}
		Object.assign(
			tcTxStyle,
			text.fontSchemeColor !== undefined
				? colorChoiceXml({
						schemeColor: text.fontSchemeColor,
						tint: text.fontTint,
						shade: text.fontShade,
					})
				: { 'a:srgbClr': { '@_val': text.fontColor?.replace('#', '') } },
		);
	}
	const ordered = reorderObjectKeys(tcTxStyle, TC_TX_STYLE_ORDER);
	for (const key of Object.keys(tcTxStyle)) {
		delete tcTxStyle[key];
	}
	Object.assign(tcTxStyle, ordered);
}
