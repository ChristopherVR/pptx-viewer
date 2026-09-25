import type { TextStyle, XmlObject } from '../types';

/** Build an `a:bevelT` / `a:bevelB` node, or `undefined` for no / `none` bevel. */
function bevelXml(
	type: string | undefined,
	width: number | undefined,
	height: number | undefined,
): XmlObject | undefined {
	if (!type || type === 'none') {
		return undefined;
	}
	const bevel: XmlObject = { '@_prst': type };
	if (width) {
		bevel['@_w'] = String(width);
	}
	if (height) {
		bevel['@_h'] = String(height);
	}
	return bevel;
}

/**
 * Write (or clear) the text-body 3D choice (`EG_Text3D`: `a:sp3d` or
 * `a:flatTx`) onto an `a:bodyPr` object from a {@link TextStyle}.
 *
 * The write-side counterpart of `parseTextBodySp3d`, shared by the ordinary
 * text-body writer (`PptxHandlerRuntimeSaveTextWriter`) and the SmartArt
 * cached-drawing fabricator (`smartart-fabrication-text`), so both emit
 * identical text extrusion XML.
 *
 * `a:sp3d` / `a:flatTx` are mutually exclusive: an explicit "render flat"
 * override never coexists with extrusion/bevel data, so it is written instead
 * of (never alongside) `a:sp3d`.
 */
export function applyTextBodySp3d(
	bodyPr: XmlObject,
	textStyle: Pick<TextStyle, 'flatText' | 'text3d'> | undefined,
): void {
	if (textStyle?.flatText) {
		bodyPr['a:flatTx'] = {};
		delete bodyPr['a:sp3d'];
		return;
	}
	delete bodyPr['a:flatTx'];
	const t3d = textStyle?.text3d;
	if (!t3d || Object.keys(t3d).length === 0) {
		delete bodyPr['a:sp3d'];
		return;
	}
	const sp3dXml: XmlObject = {};
	if (t3d.extrusionHeight) {
		sp3dXml['@_extrusionH'] = String(t3d.extrusionHeight);
	}
	if (t3d.presetMaterial) {
		sp3dXml['@_prstMaterial'] = t3d.presetMaterial;
	}
	const bevelT = bevelXml(t3d.bevelTopType, t3d.bevelTopWidth, t3d.bevelTopHeight);
	if (bevelT) {
		sp3dXml['a:bevelT'] = bevelT;
	}
	const bevelB = bevelXml(t3d.bevelBottomType, t3d.bevelBottomWidth, t3d.bevelBottomHeight);
	if (bevelB) {
		sp3dXml['a:bevelB'] = bevelB;
	}
	if (t3d.extrusionColor) {
		sp3dXml['a:extrusionClr'] = {
			'a:srgbClr': { '@_val': t3d.extrusionColor.replace('#', '') },
		};
	}
	bodyPr['a:sp3d'] = sp3dXml;
}
