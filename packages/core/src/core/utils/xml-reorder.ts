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

/** The part of an element key after its namespace prefix (`x:kinsoku` -> `kinsoku`). */
function elementLocalName(key: string): string | undefined {
	if (key.startsWith('@_') || key.startsWith('#') || key.startsWith('?')) {
		return undefined;
	}
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
}

/**
 * Like {@link reorderObjectKeys}, but a child matches a `schemaOrder` entry by
 * LOCAL NAME, so a part that binds the PresentationML namespace to a prefix
 * other than `p:` (or mixes prefixes, e.g. an `x:kinsoku` among `p:` siblings)
 * is still put in schema order instead of having its foreign-prefixed children
 * pushed to the end. Attributes and text nodes are never reordered.
 */
export function reorderObjectKeysByLocalName(
	obj: XmlObject,
	schemaOrder: readonly string[],
): XmlObject {
	const rank = new Map<string, number>();
	schemaOrder.forEach((key, index) => {
		const local = elementLocalName(key);
		if (local !== undefined && !rank.has(local)) {
			rank.set(local, index);
		}
	});
	const recognised: Array<{ key: string; rank: number }> = [];
	const rest: string[] = [];
	for (const key of Object.keys(obj)) {
		if (obj[key] === undefined) {
			continue;
		}
		const local = elementLocalName(key);
		const position = local === undefined ? undefined : rank.get(local);
		if (position === undefined) {
			rest.push(key);
		} else {
			recognised.push({ key, rank: position });
		}
	}
	// Stable sort: two prefixes for the same local name keep insertion order.
	recognised.sort((a, b) => a.rank - b.rank);
	const result: XmlObject = {};
	for (const key of [...recognised.map((entry) => entry.key), ...rest]) {
		result[key] = obj[key];
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
 * Child order for `p:presentation` (CT_Presentation, ECMA-376 S19.2.1.26).
 * `reorderObjectKeys` pushes any key not in this list (attributes, and
 * genuinely unknown extension children) after the recognised ones, in their
 * original relative order; `@_`-prefixed attribute keys always serialize as
 * attributes on the opening tag regardless of their position in the object,
 * so this only affects the sequence of CHILD ELEMENTS, which is what the
 * schema actually constrains.
 */
export const PRESENTATION_CHILD_ORDER: readonly string[] = [
	'p:sldMasterIdLst',
	'p:notesMasterIdLst',
	'p:handoutMasterIdLst',
	'p:sldIdLst',
	'p:sldSz',
	'p:notesSz',
	'p:smartTags',
	'p:embeddedFontLst',
	'p:custShowLst',
	'p:photoAlbum',
	'p:custDataLst',
	'p:kinsoku',
	'p:defaultTextStyle',
	'p:modifyVerifier',
	'p:extLst',
];

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
