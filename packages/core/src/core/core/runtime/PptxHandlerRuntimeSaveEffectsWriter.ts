import { XmlObject } from '../../types';
import type { Pptx3DScene, ShapeStyle } from '../../types';
import { EFFECT_LST_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { serializeEffectDagContainer } from '../builders/effect-dag-containers';
import { createEffectList, effectChild, setEffectChild } from '../builders/effect-list-roundtrip';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveShapeStyleWriter';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialize visual effects (shadow, glow, reflection, blur, soft edge),
	 * effectDag, 3D scene, and 3D shape properties to the given spPr XML object.
	 */
	protected applyEffectsAndThreeD(spPr: XmlObject, shapeStyle: ShapeStyle): void {
		// When the shape carries a preset-shadow name, prefer prstShdw over the
		// generic outerShdw to preserve PowerPoint's preset-shadow semantics
		// (CT_PresetShadowEffect §20.1.8.49).
		const presetShadowXml = shapeStyle.presetShadowName
			? this.buildPresetShadowXml(shapeStyle)
			: undefined;
		// Effects: shadow, inner shadow, glow, soft edge, reflection, blur
		const outerShadowXml = presetShadowXml ? undefined : this.buildOuterShadowXml(shapeStyle);
		const innerShadowXml = this.buildInnerShadowXml(shapeStyle);
		const glowXml = this.buildGlowXml(shapeStyle);
		const softEdgeXml = this.buildSoftEdgeXml(shapeStyle);
		const reflectionXml = this.buildReflectionXml(shapeStyle);
		const blurXml = this.buildBlurXml(shapeStyle);
		const hasAnyEffect =
			outerShadowXml ||
			presetShadowXml ||
			innerShadowXml ||
			glowXml ||
			softEdgeXml ||
			reflectionXml ||
			blurXml;
		if (hasAnyEffect || shapeStyle.effectListXml) {
			const effectList = createEffectList(shapeStyle, spPr);
			if (presetShadowXml) {
				setEffectChild(effectList, 'prstShdw', presetShadowXml);
				setEffectChild(effectList, 'outerShdw', undefined);
			} else if (outerShadowXml) {
				setEffectChild(effectList, 'outerShdw', outerShadowXml);
				setEffectChild(effectList, 'prstShdw', undefined);
			}
			if (innerShadowXml) {
				setEffectChild(effectList, 'innerShdw', innerShadowXml);
			}
			if (glowXml) {
				setEffectChild(effectList, 'glow', glowXml);
			}
			if (softEdgeXml) {
				setEffectChild(effectList, 'softEdge', softEdgeXml);
			}
			if (reflectionXml) {
				setEffectChild(effectList, 'reflection', reflectionXml);
			}
			if (blurXml) {
				setEffectChild(effectList, 'blur', blurXml);
			}
			setEffectChild(spPr, 'effectLst', reorderObjectKeys(effectList, EFFECT_LST_ORDER));
		} else {
			// Clean up individual effects that were explicitly removed
			const effectList = effectChild(spPr, 'effectLst');
			if (effectList) {
				if (shapeStyle.shadowColor !== undefined && !outerShadowXml && !presetShadowXml) {
					setEffectChild(effectList, 'outerShdw', undefined);
					setEffectChild(effectList, 'prstShdw', undefined);
				}
				if (shapeStyle.innerShadowColor !== undefined && !innerShadowXml) {
					setEffectChild(effectList, 'innerShdw', undefined);
				}
				if (shapeStyle.glowColor !== undefined && !glowXml) {
					setEffectChild(effectList, 'glow', undefined);
				}
				if (shapeStyle.softEdgeRadius !== undefined && !softEdgeXml) {
					setEffectChild(effectList, 'softEdge', undefined);
				}
				if (shapeStyle.reflectionBlurRadius !== undefined && !reflectionXml) {
					setEffectChild(effectList, 'reflection', undefined);
				}
				if (shapeStyle.blurRadius !== undefined && !blurXml) {
					setEffectChild(effectList, 'blur', undefined);
				}
				if (Object.keys(effectList).length === 0) {
					setEffectChild(spPr, 'effectLst', undefined);
				} else {
					setEffectChild(spPr, 'effectLst', reorderObjectKeys(effectList, EFFECT_LST_ORDER));
				}
			}
		}

		// Prefer the typed graph so edits are serialized. Its primitive nodes retain
		// their original XML, including unknown extensions and color transforms.
		const effectDagXml = shapeStyle.effectDagTree
			? serializeEffectDagContainer(shapeStyle.effectDagTree)
			: shapeStyle.effectDagXml;
		if (effectDagXml) {
			setEffectChild(spPr, 'effectDag', effectDagXml);
		}

		// ── 3D Scene (a:scene3d) ──
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

		// ── 3D Shape (a:sp3d) ──
		if (shapeStyle.shape3d) {
			const sh3d = shapeStyle.shape3d;
			const hasData =
				sh3d.extrusionHeight !== undefined ||
				sh3d.contourWidth !== undefined ||
				sh3d.presetMaterial ||
				sh3d.bevelTopType ||
				sh3d.bevelBottomType ||
				sh3d.extrusionColor ||
				sh3d.contourColor;
			if (hasData) {
				const sp3dXml: XmlObject = {};
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
