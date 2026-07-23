import type { ShapeStyle, XmlObject } from '../../types';

export interface Shape3dStyleContext {
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/** Apply `a:scene3d` properties to the shape style. */
export function applyScene3dStyle(shapeProps: XmlObject, style: ShapeStyle): void {
	const scene3dNode = shapeProps['a:scene3d'] as XmlObject | undefined;
	if (!scene3dNode) {
		return;
	}

	const camera = scene3dNode['a:camera'] as XmlObject | undefined;
	const lightRig = scene3dNode['a:lightRig'] as XmlObject | undefined;
	const cameraRot = camera?.['a:rot'] as XmlObject | undefined;
	const lightRigRot = lightRig?.['a:rot'] as XmlObject | undefined;
	style.scene3d = {
		cameraPreset: String(camera?.['@_prst'] || '').trim() || undefined,
		cameraFieldOfView: intAttr(camera?.['@_fov']),
		cameraZoom: floatAttr(camera?.['@_zoom']),
		cameraRotX: intAttr(cameraRot?.['@_lat']),
		cameraRotY: intAttr(cameraRot?.['@_lon']),
		cameraRotZ: intAttr(cameraRot?.['@_rev']),
		lightRigType: String(lightRig?.['@_rig'] || '').trim() || undefined,
		lightRigDirection: String(lightRig?.['@_dir'] || '').trim() || undefined,
		lightRigRotX: intAttr(lightRigRot?.['@_lat']),
		lightRigRotY: intAttr(lightRigRot?.['@_lon']),
		lightRigRotZ: intAttr(lightRigRot?.['@_rev']),
	};

	const backdrop = scene3dNode['a:backdrop'] as XmlObject | undefined;
	if (backdrop) {
		style.scene3d.hasBackdrop = true;
		const anchor = backdrop['a:anchor'] as XmlObject | undefined;
		if (anchor) {
			style.scene3d.backdropAnchorX = intAttr(anchor['@_x']) ?? 0;
			style.scene3d.backdropAnchorY = intAttr(anchor['@_y']) ?? 0;
			style.scene3d.backdropAnchorZ = intAttr(anchor['@_z']) ?? 0;
		}
		const norm = backdrop['a:norm'] as XmlObject | undefined;
		if (norm) {
			style.scene3d.backdropNormalX = intAttr(norm['@_dx']) ?? 0;
			style.scene3d.backdropNormalY = intAttr(norm['@_dy']) ?? 0;
			style.scene3d.backdropNormalZ = intAttr(norm['@_dz']) ?? 0;
		}
		const up = backdrop['a:up'] as XmlObject | undefined;
		if (up) {
			style.scene3d.backdropUpX = intAttr(up['@_dx']) ?? 0;
			style.scene3d.backdropUpY = intAttr(up['@_dy']) ?? 0;
			style.scene3d.backdropUpZ = intAttr(up['@_dz']) ?? 0;
		}
	}
}

/** Parse an XML attribute value to an integer, or `undefined` when absent. */
function intAttr(value: unknown): number | undefined {
	return value !== undefined ? parseInt(String(value), 10) : undefined;
}

/** Parse an XML attribute value to a float, or `undefined` when absent. */
function floatAttr(value: unknown): number | undefined {
	return value !== undefined ? parseFloat(String(value)) : undefined;
}

/** Apply `a:sp3d` properties to the shape style. */
export function applyShape3dStyle(
	shapeProps: XmlObject,
	style: ShapeStyle,
	context: Shape3dStyleContext,
): void {
	const shape3dNode = shapeProps['a:sp3d'] as XmlObject | undefined;
	if (!shape3dNode) {
		return;
	}

	const bevelTop = shape3dNode['a:bevelT'] as XmlObject | undefined;
	const bevelBottom = shape3dNode['a:bevelB'] as XmlObject | undefined;
	style.shape3d = {
		extrusionHeight:
			shape3dNode['@_extrusionH'] !== undefined
				? parseInt(String(shape3dNode['@_extrusionH']), 10)
				: undefined,
		extrusionColor: context.parseColor(shape3dNode['a:extrusionClr'] as XmlObject | undefined),
		contourWidth:
			shape3dNode['@_contourW'] !== undefined
				? parseInt(String(shape3dNode['@_contourW']), 10)
				: undefined,
		contourColor: context.parseColor(shape3dNode['a:contourClr'] as XmlObject | undefined),
		presetMaterial: String(shape3dNode['@_prstMaterial'] || '').trim() || undefined,
		bevelTopType: bevelTop ? String(bevelTop['@_prst'] || 'circle').trim() : undefined,
		bevelTopWidth:
			bevelTop !== undefined && bevelTop['@_w'] !== undefined
				? parseInt(String(bevelTop['@_w']), 10)
				: undefined,
		bevelTopHeight:
			bevelTop !== undefined && bevelTop['@_h'] !== undefined
				? parseInt(String(bevelTop['@_h']), 10)
				: undefined,
		bevelBottomType: bevelBottom ? String(bevelBottom['@_prst'] || 'circle').trim() : undefined,
		bevelBottomWidth:
			bevelBottom !== undefined && bevelBottom['@_w'] !== undefined
				? parseInt(String(bevelBottom['@_w']), 10)
				: undefined,
		bevelBottomHeight:
			bevelBottom !== undefined && bevelBottom['@_h'] !== undefined
				? parseInt(String(bevelBottom['@_h']), 10)
				: undefined,
	};
}
