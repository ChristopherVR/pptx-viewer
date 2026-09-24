import type { Pptx3DScene, Pptx3DShape, ShapeStyle, XmlObject } from '../../types';

export interface Shape3dStyleContext {
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/**
 * Parse an `a:scene3d` NODE (the element itself, not its parent) into a
 * {@link Pptx3DScene}. Shared by {@link applyScene3dStyle} (ordinary shapes,
 * where the node is a child of `spPr`) and the SmartArt drawing-shape /
 * quick-style parsers (where the equivalent node is `dsp:spPr/a:scene3d` or
 * the quick style's own `dgm:scene3d`, which is the scene3d node itself, not
 * wrapped in another `a:scene3d`).
 */
export function parsePptx3DScene(scene3dNode: XmlObject): Pptx3DScene {
	const camera = scene3dNode['a:camera'] as XmlObject | undefined;
	const lightRig = scene3dNode['a:lightRig'] as XmlObject | undefined;
	const cameraRot = camera?.['a:rot'] as XmlObject | undefined;
	const lightRigRot = lightRig?.['a:rot'] as XmlObject | undefined;
	const scene: Pptx3DScene = {
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
		scene.hasBackdrop = true;
		const anchor = backdrop['a:anchor'] as XmlObject | undefined;
		if (anchor) {
			scene.backdropAnchorX = intAttr(anchor['@_x']) ?? 0;
			scene.backdropAnchorY = intAttr(anchor['@_y']) ?? 0;
			scene.backdropAnchorZ = intAttr(anchor['@_z']) ?? 0;
		}
		const norm = backdrop['a:norm'] as XmlObject | undefined;
		if (norm) {
			scene.backdropNormalX = intAttr(norm['@_dx']) ?? 0;
			scene.backdropNormalY = intAttr(norm['@_dy']) ?? 0;
			scene.backdropNormalZ = intAttr(norm['@_dz']) ?? 0;
		}
		const up = backdrop['a:up'] as XmlObject | undefined;
		if (up) {
			scene.backdropUpX = intAttr(up['@_dx']) ?? 0;
			scene.backdropUpY = intAttr(up['@_dy']) ?? 0;
			scene.backdropUpZ = intAttr(up['@_dz']) ?? 0;
		}
	}
	return scene;
}

/** Apply `a:scene3d` properties to the shape style. */
export function applyScene3dStyle(shapeProps: XmlObject, style: ShapeStyle): void {
	const scene3dNode = shapeProps['a:scene3d'] as XmlObject | undefined;
	if (!scene3dNode) {
		return;
	}
	style.scene3d = parsePptx3DScene(scene3dNode);
}

/** Parse an XML attribute value to an integer, or `undefined` when absent. */
function intAttr(value: unknown): number | undefined {
	return value !== undefined ? parseInt(String(value), 10) : undefined;
}

/** Parse an XML attribute value to a float, or `undefined` when absent. */
function floatAttr(value: unknown): number | undefined {
	return value !== undefined ? parseFloat(String(value)) : undefined;
}

/**
 * Parse an `a:sp3d` NODE (the element itself) into a {@link Pptx3DShape},
 * given a theme-aware colour resolver. Shared by {@link applyShape3dStyle}
 * (ordinary shapes) and the SmartArt drawing-shape parser, whose cached
 * `dsp:spPr/a:sp3d` node has the identical shape.
 */
export function parsePptx3DShape(
	shape3dNode: XmlObject,
	parseColor: Shape3dStyleContext['parseColor'],
): Pptx3DShape {
	const bevelTop = shape3dNode['a:bevelT'] as XmlObject | undefined;
	const bevelBottom = shape3dNode['a:bevelB'] as XmlObject | undefined;
	return {
		positionZ:
			shape3dNode['@_z'] !== undefined ? parseInt(String(shape3dNode['@_z']), 10) : undefined,
		extrusionHeight:
			shape3dNode['@_extrusionH'] !== undefined
				? parseInt(String(shape3dNode['@_extrusionH']), 10)
				: undefined,
		extrusionColor: parseColor(shape3dNode['a:extrusionClr'] as XmlObject | undefined),
		contourWidth:
			shape3dNode['@_contourW'] !== undefined
				? parseInt(String(shape3dNode['@_contourW']), 10)
				: undefined,
		contourColor: parseColor(shape3dNode['a:contourClr'] as XmlObject | undefined),
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
	style.shape3d = parsePptx3DShape(shape3dNode, context.parseColor);
}
