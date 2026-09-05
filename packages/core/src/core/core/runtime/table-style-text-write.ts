/**
 * table-style-text-write.ts - write-side mirror of
 * `table-style-fill-parse.ts`'s `parseTableStyleSectionText` for a table-
 * style section's `a:tcTxStyle`.
 *
 * @module table-style-text-write
 */
import type { ParsedTableStyleText, XmlObject } from '../../types';
import { colorChoiceXml, ensureChild } from './table-style-xml-helpers';

/**
 * Write bold/italic/underline, typeface, and font-collection colour onto a
 * table-style section's `a:tcTxStyle`. Colour (and idx) live nested inside
 * `a:fontRef` (`CT_FontReference`, the same idx+EG_ColorChoice shape used by
 * `a:fillRef`/`a:lnRef`/`a:effectRef` elsewhere in OOXML). A legacy top-level
 * `a:schemeClr`/`a:srgbClr` the parser leniently also reads is never written
 * by this module.
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

	if (
		text.fontRefIdx !== undefined ||
		text.fontSchemeColor !== undefined ||
		text.fontColor !== undefined
	) {
		const fontRef = ensureChild(tcTxStyle, 'a:fontRef');
		if (text.fontRefIdx !== undefined) {
			fontRef['@_idx'] = text.fontRefIdx;
		} else if (!fontRef['@_idx']) {
			fontRef['@_idx'] = 'minor';
		}
		delete tcTxStyle['a:schemeClr'];
		delete tcTxStyle['a:srgbClr'];
		if (text.fontSchemeColor !== undefined) {
			delete fontRef['a:srgbClr'];
			fontRef['a:schemeClr'] = colorChoiceXml({
				schemeColor: text.fontSchemeColor,
				tint: text.fontTint,
				shade: text.fontShade,
			})['a:schemeClr'];
		} else if (text.fontColor !== undefined) {
			delete fontRef['a:schemeClr'];
			fontRef['a:srgbClr'] = { '@_val': text.fontColor.replace('#', '') };
		}
	}
}
