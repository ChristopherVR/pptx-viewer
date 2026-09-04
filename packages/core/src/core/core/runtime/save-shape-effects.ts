import type { Pptx3DScene, ShapeStyle, XmlObject } from '../../types';
import { serializeEffectDagContainer } from '../builders/effect-dag-containers';
import { setEffectChild } from '../builders/effect-list-roundtrip';
import { effectIsPurelyStyleMatrix } from './authored-shape-style';
import { writeEffectList } from './save-shape-effect-list';

/**
 * Pre-built effect XML the runtime supplies, computed from the shape's
 * current flat style via `PptxShapeEffectXmlBuilder`. Each is `undefined`
 * when the corresponding effect is not present on the style.
 */
export interface ShapeEffectsContext {
	readonly outerShadowXml?: XmlObject;
	readonly presetShadowXml?: XmlObject;
	readonly innerShadowXml?: XmlObject;
	readonly glowXml?: XmlObject;
	readonly softEdgeXml?: XmlObject;
	readonly reflectionXml?: XmlObject;
	readonly blurXml?: XmlObject;
	readonly fillOverlayXml?: XmlObject;
}

/**
 * Serialize visual effects (shadow, glow, reflection, blur, soft edge),
 * effectDag, 3D scene, and 3D shape properties onto the given `spPr` XML
 * object.
 *
 * Gated the same way `writeShapeFill` gates `<a:fillRef>` (see
 * `authored-shape-style.ts`'s `effectIsPurelyStyleMatrix`): a shape whose
 * effects still match exactly what `<a:effectRef>` resolved from the theme's
 * `effectStyleLst` is left effect-less (and 3D-less) in `spPr`, so the
 * reference keeps painting it instead of being outranked by a baked-in
 * `effectLst`. `applyShapeStyleRefs` re-emits the reference itself.
 *
 * The colocated test used to reimplement this logic ("its mixin chain
 * crashes on load"), which meant it could not fail when production drifted -
 * this module exists as a free function specifically so the test can import
 * and drive the REAL logic instead.
 */
export function writeShapeEffects(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	ctx: ShapeEffectsContext,
): void {
	if (effectIsPurelyStyleMatrix(shapeStyle)) {
		return;
	}

	writeEffectList(spPr, shapeStyle, ctx);
	writeEffectDag(spPr, shapeStyle);
	writeScene3d(spPr, shapeStyle);
	writeShape3d(spPr, shapeStyle);
}

/** Write the `a:effectDag` child from the typed graph (preferred) or its preserved raw XML. */
function writeEffectDag(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	const effectDagXml = shapeStyle.effectDagTree
		? serializeEffectDagContainer(shapeStyle.effectDagTree)
		: shapeStyle.effectDagXml;
	if (effectDagXml) {
		setEffectChild(spPr, 'effectDag', effectDagXml);
	}
}

/** Build an `a:rot` sphere-coords node, or `undefined` when no angle is set. */
function buildSphereRot(
	lat: number | undefined,
	lon: number | undefined,
	rev: number | undefined,
): XmlObject | undefined {
	if (lat === undefined && lon === undefined && rev === undefined) {
		return undefined;
	}
	const rot: XmlObject = {};
	if (lat !== undefined) {
		rot['@_lat'] = String(lat);
	}
	if (lon !== undefined) {
		rot['@_lon'] = String(lon);
	}
	if (rev !== undefined) {
		rot['@_rev'] = String(rev);
	}
	return rot;
}

/** Patch the source `a:camera` node with modelled preset/fov/zoom/rotation. */
function buildScene3dCamera(s3d: Pptx3DScene, source: XmlObject): XmlObject {
	const camera: XmlObject = { ...((source['a:camera'] as XmlObject | undefined) ?? {}) };
	if (s3d.cameraPreset) {
		camera['@_prst'] = s3d.cameraPreset;
	}
	if (s3d.cameraFieldOfView !== undefined) {
		camera['@_fov'] = String(s3d.cameraFieldOfView);
	}
	if (s3d.cameraZoom !== undefined) {
		camera['@_zoom'] = String(s3d.cameraZoom);
	}
	const rot = buildSphereRot(s3d.cameraRotX, s3d.cameraRotY, s3d.cameraRotZ);
	if (rot) {
		camera['a:rot'] = rot;
	}
	return camera;
}

/** Patch the source `a:lightRig` node, or `undefined` when it stays empty. */
function buildScene3dLightRig(s3d: Pptx3DScene, source: XmlObject): XmlObject | undefined {
	const lightRig: XmlObject = { ...((source['a:lightRig'] as XmlObject | undefined) ?? {}) };
	if (s3d.lightRigType) {
		lightRig['@_rig'] = s3d.lightRigType;
	}
	if (s3d.lightRigDirection) {
		lightRig['@_dir'] = s3d.lightRigDirection;
	}
	const rot = buildSphereRot(s3d.lightRigRotX, s3d.lightRigRotY, s3d.lightRigRotZ);
	if (rot) {
		lightRig['a:rot'] = rot;
	}
	return Object.keys(lightRig).length > 0 ? lightRig : undefined;
}

/**
 * Build a schema-valid `a:backdrop` (anchor + norm + up), or `undefined` when
 * the modelled scene lacks the required norm/up vectors.
 */
function buildScene3dBackdrop(s3d: Pptx3DScene): XmlObject | undefined {
	const hasNorm =
		s3d.backdropNormalX !== undefined ||
		s3d.backdropNormalY !== undefined ||
		s3d.backdropNormalZ !== undefined;
	const hasUp =
		s3d.backdropUpX !== undefined || s3d.backdropUpY !== undefined || s3d.backdropUpZ !== undefined;
	if (!s3d.hasBackdrop || !hasNorm || !hasUp) {
		return undefined;
	}
	return {
		'a:anchor': {
			'@_x': String(s3d.backdropAnchorX ?? 0),
			'@_y': String(s3d.backdropAnchorY ?? 0),
			'@_z': String(s3d.backdropAnchorZ ?? 0),
		},
		'a:norm': {
			'@_dx': String(s3d.backdropNormalX ?? 0),
			'@_dy': String(s3d.backdropNormalY ?? 0),
			'@_dz': String(s3d.backdropNormalZ ?? 0),
		},
		'a:up': {
			'@_dx': String(s3d.backdropUpX ?? 0),
			'@_dy': String(s3d.backdropUpY ?? 0),
			'@_dz': String(s3d.backdropUpZ ?? 0),
		},
	};
}

/** Write (or clear) the `a:scene3d` child. */
function writeScene3d(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	if (shapeStyle.scene3d) {
		const s3d = shapeStyle.scene3d;
		const hasData = s3d.cameraPreset || s3d.lightRigType;
		if (hasData) {
			// Preserve the ORIGINAL source scene3d node so camera fov/zoom,
			// light-rig rotation, and any unknown extensions survive the
			// round-trip; patch only the fields we model.
			const source = (spPr['a:scene3d'] as XmlObject | undefined) ?? {};
			const scene3dXml: XmlObject = { ...source };
			scene3dXml['a:camera'] = buildScene3dCamera(s3d, source);
			const lightRig = buildScene3dLightRig(s3d, source);
			if (lightRig) {
				scene3dXml['a:lightRig'] = lightRig;
			}
			// Only emit <a:backdrop> when it has valid a:norm + a:up children;
			// otherwise omit it entirely (a partial backdrop is schema-invalid).
			const backdrop = buildScene3dBackdrop(s3d);
			if (backdrop) {
				scene3dXml['a:backdrop'] = backdrop;
			} else {
				delete scene3dXml['a:backdrop'];
			}
			spPr['a:scene3d'] = scene3dXml;
		} else {
			delete spPr['a:scene3d'];
		}
	} else if (shapeStyle.scene3d === undefined) {
		delete spPr['a:scene3d'];
	}
}

/** Write (or clear) the `a:sp3d` child. */
function writeShape3d(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	if (shapeStyle.shape3d) {
		const sh3d = shapeStyle.shape3d;
		const hasData =
			sh3d.extrusionHeight !== undefined ||
			sh3d.contourWidth !== undefined ||
			sh3d.presetMaterial ||
			sh3d.bevelTopType ||
			sh3d.bevelBottomType ||
			sh3d.extrusionColor ||
			sh3d.contourColor ||
			sh3d.positionZ !== undefined;
		if (hasData) {
			const sp3dXml: XmlObject = {};
			if (sh3d.positionZ !== undefined) {
				sp3dXml['@_z'] = String(sh3d.positionZ);
			}
			if (sh3d.extrusionHeight !== undefined) {
				sp3dXml['@_extrusionH'] = String(sh3d.extrusionHeight);
			}
			if (sh3d.contourWidth !== undefined) {
				sp3dXml['@_contourW'] = String(sh3d.contourWidth);
			}
			if (sh3d.presetMaterial) {
				sp3dXml['@_prstMaterial'] = sh3d.presetMaterial;
			}
			if (sh3d.bevelTopType) {
				const bevelT: XmlObject = { '@_prst': sh3d.bevelTopType };
				if (sh3d.bevelTopWidth !== undefined) {
					bevelT['@_w'] = String(sh3d.bevelTopWidth);
				}
				if (sh3d.bevelTopHeight !== undefined) {
					bevelT['@_h'] = String(sh3d.bevelTopHeight);
				}
				sp3dXml['a:bevelT'] = bevelT;
			}
			if (sh3d.bevelBottomType) {
				const bevelB: XmlObject = { '@_prst': sh3d.bevelBottomType };
				if (sh3d.bevelBottomWidth !== undefined) {
					bevelB['@_w'] = String(sh3d.bevelBottomWidth);
				}
				if (sh3d.bevelBottomHeight !== undefined) {
					bevelB['@_h'] = String(sh3d.bevelBottomHeight);
				}
				sp3dXml['a:bevelB'] = bevelB;
			}
			if (sh3d.extrusionColor) {
				// ST_HexColorRGB requires 6 hex digits with no leading '#'.
				sp3dXml['a:extrusionClr'] = {
					'a:srgbClr': { '@_val': sh3d.extrusionColor.replace('#', '') },
				};
			}
			if (sh3d.contourColor) {
				sp3dXml['a:contourClr'] = {
					'a:srgbClr': { '@_val': sh3d.contourColor.replace('#', '') },
				};
			}
			spPr['a:sp3d'] = sp3dXml;
		} else {
			delete spPr['a:sp3d'];
		}
	} else if (shapeStyle.shape3d === undefined) {
		delete spPr['a:sp3d'];
	}
}
