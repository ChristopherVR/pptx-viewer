import { XmlObject } from '../../types';
import type { ShapeStyle } from '../../types';
import { EFFECT_LST_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
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

		// Round-trip preserve effectDag if present
		if (shapeStyle.effectDagXml) {
			spPr['a:effectDag'] = shapeStyle.effectDagXml;
		}

		// ── 3D Scene (a:scene3d) ──
		if (shapeStyle.scene3d) {
			const s3d = shapeStyle.scene3d;
			const hasData = s3d.cameraPreset || s3d.lightRigType;
			if (hasData) {
				const cameraObj: XmlObject = {};
				if (s3d.cameraPreset) {
					cameraObj['@_prst'] = s3d.cameraPreset;
				}
				if (
					s3d.cameraRotX !== undefined ||
					s3d.cameraRotY !== undefined ||
					s3d.cameraRotZ !== undefined
				) {
					const rot: XmlObject = {};
					if (s3d.cameraRotX !== undefined) {
						rot['@_lat'] = String(s3d.cameraRotX);
					}
					if (s3d.cameraRotY !== undefined) {
						rot['@_lon'] = String(s3d.cameraRotY);
					}
					if (s3d.cameraRotZ !== undefined) {
						rot['@_rev'] = String(s3d.cameraRotZ);
					}
					cameraObj['a:rot'] = rot;
				}
				const lightRigObj: XmlObject = {};
				if (s3d.lightRigType) {
					lightRigObj['@_rig'] = s3d.lightRigType;
				}
				if (s3d.lightRigDirection) {
					lightRigObj['@_dir'] = s3d.lightRigDirection;
				}
				const scene3dXml: XmlObject = {};
				scene3dXml['a:camera'] = cameraObj;
				if (Object.keys(lightRigObj).length > 0) {
					scene3dXml['a:lightRig'] = lightRigObj;
				}
				if (s3d.hasBackdrop) {
					const backdropObj: XmlObject = {};
					if (
						s3d.backdropAnchorX !== undefined ||
						s3d.backdropAnchorY !== undefined ||
						s3d.backdropAnchorZ !== undefined
					) {
						backdropObj['a:anchor'] = {
							'@_x': String(s3d.backdropAnchorX ?? 0),
							'@_y': String(s3d.backdropAnchorY ?? 0),
							'@_z': String(s3d.backdropAnchorZ ?? 0),
						};
					}
					scene3dXml['a:backdrop'] = backdropObj;
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
					sp3dXml['a:extrusionClr'] = {
						'a:srgbClr': { '@_val': sh3d.extrusionColor },
					};
				}
				if (sh3d.contourColor) {
					sp3dXml['a:contourClr'] = {
						'a:srgbClr': { '@_val': sh3d.contourColor },
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
