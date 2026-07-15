import type { ShapeStyle, XmlObject } from '../../types';
import { effectChild } from './effect-list-roundtrip';
import { extractReflectionAttributes } from './effect-style-extractor-reflection';
import { PRESET_SHADOW_BLUR_MAP, PRESET_SHADOW_OPACITY_MAP } from './effect-style-preset-maps';

const VALID_ALIGNMENTS = new Set(['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br']);

function parseIntAttr(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAlignmentAttr(value: unknown): ShapeStyle['shadowAlignment'] {
	const v = String(value ?? '').trim();
	return VALID_ALIGNMENTS.has(v) ? (v as ShapeStyle['shadowAlignment']) : undefined;
}

function parseBoolAttr(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (value === '1' || value === 'true') {
		return true;
	}
	if (value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

export interface PptxShapeEffectStyleExtractorContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
}

export interface IPptxShapeEffectStyleExtractor {
	extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractPresetShadowStyle(effectLstParent: XmlObject): Partial<ShapeStyle>;
	extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
}

export class PptxShapeEffectStyleExtractor implements IPptxShapeEffectStyleExtractor {
	private readonly context: PptxShapeEffectStyleExtractorContext;

	public constructor(context: PptxShapeEffectStyleExtractorContext) {
		this.context = context;
	}

	public extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = effectChild(shapeProps, 'effectLst');
		const outerShadow = effectChild(effectList, 'outerShdw');
		if (!outerShadow) {
			return this.extractPresetShadowStyle(shapeProps);
		}

		const shadowColor = this.context.parseColor(outerShadow);
		const shadowOpacity = this.context.extractColorOpacity(outerShadow);
		const blurRaw = Number.parseInt(String(outerShadow['@_blurRad'] || ''), 10);
		const distRaw = Number.parseInt(String(outerShadow['@_dist'] || ''), 10);
		const directionRaw = Number.parseInt(String(outerShadow['@_dir'] || ''), 10);

		const shadowBlur =
			Number.isFinite(blurRaw) && blurRaw >= 0 ? blurRaw / this.context.emuPerPx : undefined;
		const distance =
			Number.isFinite(distRaw) && distRaw >= 0 ? distRaw / this.context.emuPerPx : undefined;
		const directionDegrees = Number.isFinite(directionRaw) ? directionRaw / 60000 : 0;
		const directionRadians = (directionDegrees * Math.PI) / 180;

		const shadowOffsetX =
			distance !== undefined
				? Math.round(Math.cos(directionRadians) * distance * 100) / 100
				: undefined;
		const shadowOffsetY =
			distance !== undefined
				? Math.round(Math.sin(directionRadians) * distance * 100) / 100
				: undefined;

		// Parse rotateWithShape attribute
		const rotateWithShape = outerShadow['@_rotWithShape'];
		const shadowRotateWithShape =
			typeof rotateWithShape === 'boolean'
				? rotateWithShape
				: rotateWithShape === '1' || rotateWithShape === 'true'
					? true
					: rotateWithShape === '0' || rotateWithShape === 'false'
						? false
						: undefined;

		// CT_OuterShadowEffect §20.1.8.45: sx, sy, kx, ky, algn
		const shadowScaleX = parseIntAttr(outerShadow['@_sx']);
		const shadowScaleY = parseIntAttr(outerShadow['@_sy']);
		const shadowSkewX = parseIntAttr(outerShadow['@_kx']);
		const shadowSkewY = parseIntAttr(outerShadow['@_ky']);
		const shadowAlignment = parseAlignmentAttr(outerShadow['@_algn']);

		return {
			shadowColor,
			shadowOpacity,
			shadowBlur,
			shadowOffsetX,
			shadowOffsetY,
			shadowAngle: directionDegrees,
			shadowDistance: distance,
			shadowRotateWithShape,
			shadowScaleX,
			shadowScaleY,
			shadowSkewX,
			shadowSkewY,
			shadowAlignment,
		};
	}

	public extractPresetShadowStyle(effectLstParent: XmlObject): Partial<ShapeStyle> {
		const effectLst = effectLstParent['a:effectLst'] as XmlObject | undefined;
		if (!effectLst) {
			return {};
		}
		const prstShdw = effectLst['a:prstShdw'] as XmlObject | undefined;
		if (!prstShdw) {
			return {};
		}

		const preset = String(prstShdw['@_prst'] || '').trim();
		const distEmu = parseFloat(String(prstShdw['@_dist'] || '0'));
		const dirRaw = parseFloat(String(prstShdw['@_dir'] || '0'));
		const distPx = distEmu / this.context.emuPerPx;
		const dirRad = (dirRaw / 60000) * (Math.PI / 180);

		// Look up preset-specific blur values (shdw1-shdw20)
		const presetBlur = PRESET_SHADOW_BLUR_MAP[preset];

		const parsedColor = this.context.parseColor(prstShdw as XmlObject | undefined) || '#000000';
		const parsedOpacity = this.context.extractColorOpacity(prstShdw as XmlObject | undefined);

		return {
			shadowOffsetX: Math.round(distPx * Math.cos(dirRad) * 100) / 100,
			shadowOffsetY: Math.round(distPx * Math.sin(dirRad) * 100) / 100,
			shadowColor: parsedColor,
			shadowOpacity:
				parsedOpacity ??
				(presetBlur !== undefined ? (PRESET_SHADOW_OPACITY_MAP[preset] ?? 0.5) : 0.5),
			shadowBlur: presetBlur ?? 4,
			presetShadowName: preset.length > 0 ? preset : undefined,
		};
	}

	public extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = effectChild(shapeProps, 'effectLst');
		const innerShadow = effectChild(effectList, 'innerShdw');
		if (!innerShadow) {
			return {};
		}

		const innerShadowColor = this.context.parseColor(innerShadow);
		const innerShadowOpacity = this.context.extractColorOpacity(innerShadow);
		const blurRaw = Number.parseInt(String(innerShadow['@_blurRad'] || ''), 10);
		const distRaw = Number.parseInt(String(innerShadow['@_dist'] || ''), 10);
		const directionRaw = Number.parseInt(String(innerShadow['@_dir'] || ''), 10);

		const innerShadowBlur =
			Number.isFinite(blurRaw) && blurRaw >= 0 ? blurRaw / this.context.emuPerPx : undefined;
		const distance =
			Number.isFinite(distRaw) && distRaw >= 0 ? distRaw / this.context.emuPerPx : undefined;
		const directionDegrees = Number.isFinite(directionRaw) ? directionRaw / 60000 : 0;
		const directionRadians = (directionDegrees * Math.PI) / 180;

		const innerShadowOffsetX =
			distance !== undefined
				? Math.round(Math.cos(directionRadians) * distance * 100) / 100
				: undefined;
		const innerShadowOffsetY =
			distance !== undefined
				? Math.round(Math.sin(directionRadians) * distance * 100) / 100
				: undefined;

		const innerShadowRotateWithShape = parseBoolAttr(innerShadow['@_rotWithShape']);

		return {
			innerShadowColor,
			innerShadowOpacity,
			innerShadowBlur,
			innerShadowOffsetX,
			innerShadowOffsetY,
			innerShadowRotateWithShape,
		};
	}

	public extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = effectChild(shapeProps, 'effectLst');
		const glowNode = effectChild(effectList, 'glow');
		if (!glowNode) {
			return {};
		}

		const glowColor = this.context.parseColor(glowNode);
		const glowOpacity = this.context.extractColorOpacity(glowNode);
		const radiusRaw = Number.parseInt(String(glowNode['@_rad'] || ''), 10);
		const glowRadius =
			Number.isFinite(radiusRaw) && radiusRaw >= 0 ? radiusRaw / this.context.emuPerPx : undefined;

		return {
			glowColor,
			glowRadius,
			glowOpacity,
		};
	}

	public extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = effectChild(shapeProps, 'effectLst');
		const softEdgeNode = effectChild(effectList, 'softEdge');
		if (!softEdgeNode) {
			return {};
		}

		const radiusRaw = Number.parseInt(String(softEdgeNode['@_rad'] || ''), 10);
		const softEdgeRadius =
			Number.isFinite(radiusRaw) && radiusRaw >= 0 ? radiusRaw / this.context.emuPerPx : undefined;

		return { softEdgeRadius };
	}

	public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = effectChild(shapeProps, 'effectLst');
		const reflectionNode = effectChild(effectList, 'reflection');
		if (!reflectionNode) {
			return {};
		}

		return extractReflectionAttributes(reflectionNode, this.context.emuPerPx);
	}

	public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectList = shapeProps['a:effectLst'] as XmlObject | undefined;
		const blurNode = effectList?.['a:blur'] as XmlObject | undefined;
		if (!blurNode) {
			return {};
		}

		const radiusRaw = Number.parseInt(String(blurNode['@_rad'] || ''), 10);
		const blurRadius =
			Number.isFinite(radiusRaw) && radiusRaw >= 0 ? radiusRaw / this.context.emuPerPx : undefined;

		const growValue = String(blurNode['@_grow'] || '').trim();
		const blurGrow = growValue === '1' || growValue === 'true' ? true : undefined;

		return { blurRadius, blurGrow };
	}
}

export { PRESET_SHADOW_BLUR_MAP, PRESET_SHADOW_OPACITY_MAP } from './effect-style-preset-maps';
