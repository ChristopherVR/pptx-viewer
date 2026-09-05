/**
 * table-style-border-write.ts - write-side mirror of
 * `table-style-border-parse.ts` for a table-style section's `a:tcStyle/
 * a:tcBdr` borders and `a:tcStyle/a:cell3D` bevel/lighting.
 *
 * @module table-style-border-write
 */
import type {
	ParsedTableStyleBorder,
	ParsedTableStyleBorders,
	PptxTableCell3D,
	XmlObject,
} from '../../types';
import { reorderObjectKeys } from '../../utils/xml-reorder';
import { colorChoiceXml, ensureChild } from './table-style-xml-helpers';

/** EMU per CSS pixel (96 DPI). Matches the border/cell3D parse side. */
const EMU_PER_PIXEL = 9525;

/** `CT_TableCellBorderStyle` side order (§21.1.3.2): matches the parse side's `BORDER_SIDES`. */
const BORDER_SIDE_ORDER: readonly string[] = [
	'a:left',
	'a:right',
	'a:top',
	'a:bottom',
	'a:insideH',
	'a:insideV',
	'a:tl2br',
	'a:tr2bl',
];

function borderSideXml(border: ParsedTableStyleBorder): XmlObject {
	const ln: XmlObject = {};
	if (border.width !== undefined) {
		ln['@_w'] = String(Math.round(border.width * EMU_PER_PIXEL));
	}
	if (border.dash) {
		ln['a:prstDash'] = { '@_val': border.dash };
	}
	if (border.noFill) {
		ln['a:noFill'] = {};
	} else if (border.fill?.schemeColor) {
		ln['a:solidFill'] = colorChoiceXml(border.fill);
	} else if (border.color) {
		ln['a:solidFill'] = { 'a:srgbClr': { '@_val': border.color.replace('#', '') } };
	}
	return { 'a:ln': ln };
}

/**
 * Write every present side of a table-style section's `a:tcStyle/a:tcBdr`
 * (including the `tl2br`/`tr2bl` diagonals). Sides not present on `borders`
 * are left untouched, matching every other section-facet writer's merge
 * semantics.
 */
export function writeTableStyleSectionBorders(
	section: XmlObject,
	borders: ParsedTableStyleBorders,
): void {
	const tcStyle = ensureChild(section, 'a:tcStyle');
	const tcBdr = ensureChild(tcStyle, 'a:tcBdr');
	if (borders.tr2bl) {
		// Drop the legacy misspelled key this app previously wrote (issue G4)
		// once the real `a:tr2bl` element is being written for this side.
		delete tcBdr['a:bl2tr'];
	}
	const sides: ReadonlyArray<[keyof ParsedTableStyleBorders, string]> = [
		['left', 'a:left'],
		['right', 'a:right'],
		['top', 'a:top'],
		['bottom', 'a:bottom'],
		['insideH', 'a:insideH'],
		['insideV', 'a:insideV'],
		['tl2br', 'a:tl2br'],
		['tr2bl', 'a:tr2bl'],
	];
	for (const [key, xmlKey] of sides) {
		const border = borders[key];
		if (!border) {
			continue;
		}
		tcBdr[xmlKey] = borderSideXml(border);
	}
	tcStyle['a:tcBdr'] = reorderObjectKeys(tcBdr, BORDER_SIDE_ORDER);
}

/** Write material, bevel, and light-rig onto a table-style section's `a:tcStyle/a:cell3D`. */
export function writeTableStyleSectionCell3D(section: XmlObject, cell3D: PptxTableCell3D): void {
	const tcStyle = ensureChild(section, 'a:tcStyle');
	const node: XmlObject = {};
	if (cell3D.material) {
		node['@_prstMaterial'] = cell3D.material;
	}
	if (
		cell3D.bevelWidth !== undefined ||
		cell3D.bevelHeight !== undefined ||
		cell3D.bevelPreset !== undefined
	) {
		const bevel: XmlObject = {};
		if (cell3D.bevelWidth !== undefined) {
			bevel['@_w'] = String(Math.round(cell3D.bevelWidth * EMU_PER_PIXEL));
		}
		if (cell3D.bevelHeight !== undefined) {
			bevel['@_h'] = String(Math.round(cell3D.bevelHeight * EMU_PER_PIXEL));
		}
		if (cell3D.bevelPreset) {
			bevel['@_prst'] = cell3D.bevelPreset;
		}
		node['a:bevel'] = bevel;
	}
	if (cell3D.lightRig || cell3D.lightRigDirection) {
		const lightRig: XmlObject = {};
		if (cell3D.lightRig) {
			lightRig['@_rig'] = cell3D.lightRig;
		}
		if (cell3D.lightRigDirection) {
			lightRig['@_dir'] = cell3D.lightRigDirection;
		}
		node['a:lightRig'] = lightRig;
	}
	tcStyle['a:cell3D'] = node;
}
