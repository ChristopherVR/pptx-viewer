import type { ShapeStyle, XmlObject } from '../../types';
import { effectChild, mergeEffectNode } from './effect-list-roundtrip';
import { PptxEffectDagExtractor } from './PptxEffectDagExtractor';
import type { IPptxEffectDagExtractor } from './PptxEffectDagExtractor';
import { PptxShapeEffectStyleExtractor } from './PptxShapeEffectStyleExtractor';
import type { IPptxShapeEffectStyleExtractor } from './PptxShapeEffectStyleExtractor';
import { PptxShapeEffectXmlBuilder } from './PptxShapeEffectXmlBuilder';
import type { IPptxShapeEffectXmlBuilder } from './PptxShapeEffectXmlBuilder';

export interface PptxShapeEffectXmlCodecContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	clampUnitInterval: (value: number) => number;
	ensureArray: (value: unknown) => XmlObject[];
}

export interface IPptxShapeEffectXmlCodec {
	extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined;
}

export class PptxShapeEffectXmlCodec implements IPptxShapeEffectXmlCodec {
	private readonly extractor: IPptxShapeEffectStyleExtractor;

	private readonly dagExtractor: IPptxEffectDagExtractor;

	private readonly builder: IPptxShapeEffectXmlBuilder;

	public constructor(context: PptxShapeEffectXmlCodecContext) {
		this.extractor = new PptxShapeEffectStyleExtractor({
			emuPerPx: context.emuPerPx,
			parseColor: context.parseColor,
			extractColorOpacity: context.extractColorOpacity,
		});
		this.dagExtractor = new PptxEffectDagExtractor({
			emuPerPx: context.emuPerPx,
			parseColor: context.parseColor,
			extractColorOpacity: context.extractColorOpacity,
			ensureArray: context.ensureArray,
		});
		this.builder = new PptxShapeEffectXmlBuilder({
			emuPerPx: context.emuPerPx,
			clampUnitInterval: context.clampUnitInterval,
		});
	}

	public extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const style = this.extractor.extractShadowStyle(shapeProps);
		const effectList = effectChild(shapeProps, 'effectLst');
		const outerShadow = effectChild(effectList, 'outerShdw');
		return outerShadow
			? {
					...style,
					effectListXml: effectList,
					outerShadowXml: outerShadow,
					outerShadowOriginalColor: style.shadowColor,
					outerShadowOriginalOpacity: style.shadowOpacity,
				}
			: style;
	}

	public extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.extractor.extractInnerShadowStyle(shapeProps);
	}

	public extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const style = this.extractor.extractGlowStyle(shapeProps);
		const effectList = effectChild(shapeProps, 'effectLst');
		const glow = effectChild(effectList, 'glow');
		return glow
			? {
					...style,
					effectListXml: effectList,
					glowXml: glow,
					glowOriginalColor: style.glowColor,
					glowOriginalOpacity: style.glowOpacity,
				}
			: style;
	}

	public extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.extractor.extractSoftEdgeStyle(shapeProps);
	}

	public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.extractor.extractReflectionStyle(shapeProps);
	}

	public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.extractor.extractBlurStyle(shapeProps);
	}

	public extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.dagExtractor.extractEffectDagStyle(shapeProps);
	}

	public buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const generated = this.builder.buildOuterShadowXml(shapeStyle);
		return generated
			? mergeEffectNode(
					shapeStyle.outerShadowXml,
					generated,
					shapeStyle.outerShadowOriginalColor,
					shapeStyle.shadowColor,
					shapeStyle.outerShadowOriginalOpacity,
					shapeStyle.shadowOpacity,
				)
			: undefined;
	}

	public buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildPresetShadowXml(shapeStyle);
	}

	public buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildInnerShadowXml(shapeStyle);
	}

	public buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const generated = this.builder.buildGlowXml(shapeStyle);
		return generated
			? mergeEffectNode(
					shapeStyle.glowXml,
					generated,
					shapeStyle.glowOriginalColor,
					shapeStyle.glowColor,
					shapeStyle.glowOriginalOpacity,
					shapeStyle.glowOpacity,
				)
			: undefined;
	}

	public buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildSoftEdgeXml(shapeStyle);
	}

	public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildReflectionXml(shapeStyle);
	}

	public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildBlurXml(shapeStyle);
	}

	public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildLineEffectListXml(shapeStyle);
	}
}
