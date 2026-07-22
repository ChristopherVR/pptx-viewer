import type { PptxTableCellStyle, XmlObject } from '../../types';
import type { TableCellFillBorderContext } from './table-cell-fill-border-helpers';

/**
 * Apply a cell 3D bevel + lighting treatment from `a:tcPr/a:cell3D`
 * (CT_Cell3D §21.1.3.1) onto the cell style so the renderer can draw a bevel.
 *
 * Captures only the fields needed to render a plausible bevel: bevel
 * width/height/preset (`a:bevel`), preset material (`@prstMaterial`), and the
 * light rig type/direction (`a:lightRig`). Full round-trip of the node is
 * handled separately by the save path.
 */
export function applyCell3DStyle(
	cellProperties: XmlObject | undefined,
	style: PptxTableCellStyle,
	context: TableCellFillBorderContext,
): boolean {
	if (!cellProperties) {
		return false;
	}
	const cell3DNode = cellProperties['a:cell3D'] as XmlObject | undefined;
	if (!cell3DNode) {
		return false;
	}

	const cell3D: NonNullable<PptxTableCellStyle['cell3D']> = {};
	let hasStyle = false;

	const material = String(cell3DNode['@_prstMaterial'] || '').trim();
	if (material) {
		cell3D.material = material;
		hasStyle = true;
	}

	const bevel = cell3DNode['a:bevel'] as XmlObject | undefined;
	if (bevel) {
		const bevelWidth = parseInt(String(bevel['@_w'] || '0'), 10);
		if (bevelWidth > 0) {
			cell3D.bevelWidth = Math.round(bevelWidth / context.emuPerPx);
			hasStyle = true;
		}
		const bevelHeight = parseInt(String(bevel['@_h'] || '0'), 10);
		if (bevelHeight > 0) {
			cell3D.bevelHeight = Math.round(bevelHeight / context.emuPerPx);
			hasStyle = true;
		}
		const bevelPreset = String(bevel['@_prst'] || '').trim();
		if (bevelPreset) {
			cell3D.bevelPreset = bevelPreset;
			hasStyle = true;
		}
	}

	const lightRig = cell3DNode['a:lightRig'] as XmlObject | undefined;
	if (lightRig) {
		const rig = String(lightRig['@_rig'] || '').trim();
		if (rig) {
			cell3D.lightRig = rig;
			hasStyle = true;
		}
		const dir = String(lightRig['@_dir'] || '').trim();
		if (dir) {
			cell3D.lightRigDirection = dir;
			hasStyle = true;
		}
	}

	if (hasStyle) {
		style.cell3D = cell3D;
	}
	return hasStyle;
}
