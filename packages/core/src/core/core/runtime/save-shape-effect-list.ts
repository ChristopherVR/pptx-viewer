import type { ShapeStyle, XmlObject } from '../../types';
import { EFFECT_LST_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { createEffectList, effectChild, setEffectChild } from '../builders/effect-list-roundtrip';
import type { ShapeEffectsContext } from './save-shape-effects';

/**
 * Write (or clean up) the `a:effectLst` child: shadow, glow, soft edge,
 * reflection, blur, and a direct (non-DAG) fill overlay.
 *
 * Split out of `save-shape-effects.ts` (already at the 300-line file-size
 * limit) when D1-G3 added `a:fillOverlay` as a legal direct `effectLst`
 * sibling (CT_EffectList §20.1.8.24), distinct from the effectDag form.
 */
export function writeEffectList(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	ctx: ShapeEffectsContext,
): void {
	const {
		outerShadowXml,
		presetShadowXml,
		innerShadowXml,
		glowXml,
		softEdgeXml,
		reflectionXml,
		blurXml,
		fillOverlayXml,
	} = ctx;
	const hasAnyEffect =
		outerShadowXml ||
		presetShadowXml ||
		innerShadowXml ||
		glowXml ||
		softEdgeXml ||
		reflectionXml ||
		blurXml ||
		fillOverlayXml;

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
		if (fillOverlayXml) {
			setEffectChild(effectList, 'fillOverlay', fillOverlayXml);
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
			if (shapeStyle.shapeFillOverlayColor !== undefined && !fillOverlayXml) {
				setEffectChild(effectList, 'fillOverlay', undefined);
			}
			if (Object.keys(effectList).length === 0) {
				setEffectChild(spPr, 'effectLst', undefined);
			} else {
				setEffectChild(spPr, 'effectLst', reorderObjectKeys(effectList, EFFECT_LST_ORDER));
			}
		}
	}
}
