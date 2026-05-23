/**
 * Schema-order utilities for OpenXML serialization.
 *
 * fast-xml-parser preserves *insertion* order of object keys, so the save
 * layer must produce keys in the order required by the relevant ECMA-376
 * content-type definition. `reorderObjectKeys` returns a new object whose
 * keys appear first in `schemaOrder` (in that order), then any remaining
 * keys in their original insertion order. Keys whose values are
 * `undefined` are skipped.
 */
import type { XmlObject } from '../types/common';

export function reorderObjectKeys(obj: XmlObject, schemaOrder: readonly string[]): XmlObject {
	const result: XmlObject = {};
	const consumed = new Set<string>();

	for (const key of schemaOrder) {
		if (Object.hasOwn(obj, key)) {
			const value = obj[key];
			if (value !== undefined) {
				result[key] = value;
			}
			consumed.add(key);
		}
	}

	for (const key of Object.keys(obj)) {
		if (consumed.has(key)) {
			continue;
		}
		const value = obj[key];
		if (value !== undefined) {
			result[key] = value;
		}
	}

	return result;
}

/** Child order for `a:effectLst` (CT_EffectList §20.1.8.20) — alphabetical. */
export const EFFECT_LST_ORDER: readonly string[] = [
	'a:blur',
	'a:fillOverlay',
	'a:glow',
	'a:innerShdw',
	'a:outerShdw',
	'a:prstShdw',
	'a:reflection',
	'a:softEdge',
];

/**
 * Child order for `a:spPr` (CT_ShapeProperties §20.1.2.2.35).
 * Geometry choice (custGeom XOR prstGeom) and fill choice
 * (noFill XOR solidFill XOR gradFill XOR blipFill XOR pattFill XOR grpFill)
 * are flattened — at most one of each appears in any valid document.
 */
export const SP_PR_ORDER: readonly string[] = [
	'a:xfrm',
	'a:custGeom',
	'a:prstGeom',
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
	'a:ln',
	'a:effectLst',
	'a:effectDag',
	'a:scene3d',
	'a:sp3d',
	'a:extLst',
];

/**
 * Child order for `a:tcPr` (CT_TableCellProperties §21.1.4.2).
 * Fill choice is flattened.
 */
export const TC_PR_BORDERS_ORDER: readonly string[] = [
	'a:lnL',
	'a:lnR',
	'a:lnT',
	'a:lnB',
	'a:lnTlToBr',
	'a:lnBlToTr',
	'a:cell3D',
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
	'a:headers',
	'a:extLst',
];

/** Child order for `a:blipFill` (CT_BlipFillProperties). */
export const BLIP_FILL_ORDER: readonly string[] = ['a:blip', 'a:srcRect', 'a:tile', 'a:stretch'];

/**
 * Child order for `<p:style>` (CT_ShapeStyle §20.1.2.2.36):
 * `lnRef → fillRef → effectRef → fontRef`.
 */
export const SHAPE_STYLE_ORDER: readonly string[] = [
	'a:lnRef',
	'a:fillRef',
	'a:effectRef',
	'a:fontRef',
];
