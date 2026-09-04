import type { ShapeStyle, XmlObject } from '../../types';
import { colorsEqual } from '../../utils/color-xml-preservation';
import { effectChild, mergeAttributeEffectNode, mergeEffectNode } from './effect-list-roundtrip';
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
	extractFillOverlayStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
	buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildPresetShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	buildFillOverlayXml(shapeStyle: ShapeStyle): XmlObject | undefined;
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
			ensureArray: context.ensureArray,
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
		const style = this.extractor.extractInnerShadowStyle(shapeProps);
		const effectList = effectChild(shapeProps, 'effectLst');
		const node = effectChild(effectList, 'innerShdw');
		return node
			? {
					...style,
					effectListXml: effectList,
					innerShadowXml: node,
					innerShadowOriginalColor: style.innerShadowColor,
					innerShadowOriginalOpacity: style.innerShadowOpacity,
				}
			: style;
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
		const style = this.extractor.extractSoftEdgeStyle(shapeProps);
		const effectList = effectChild(shapeProps, 'effectLst');
		const node = effectChild(effectList, 'softEdge');
		return node ? { ...style, effectListXml: effectList, softEdgeXml: node } : style;
	}

	public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const style = this.extractor.extractReflectionStyle(shapeProps);
		const effectList = effectChild(shapeProps, 'effectLst');
		const node = effectChild(effectList, 'reflection');
		return node ? { ...style, effectListXml: effectList, reflectionXml: node } : style;
	}

	public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.extractor.extractBlurStyle(shapeProps);
	}

	public extractFillOverlayStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const style = this.extractor.extractFillOverlayStyle(shapeProps);
		return style.fillOverlayXml
			? {
					...style,
					shapeFillOverlayOriginalColor: style.shapeFillOverlayColor,
					shapeFillOverlayOriginalOpacity: style.shapeFillOverlayOpacity,
				}
			: style;
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
		const generated = this.builder.buildInnerShadowXml(shapeStyle);
		return generated
			? mergeEffectNode(
					shapeStyle.innerShadowXml,
					generated,
					shapeStyle.innerShadowOriginalColor,
					shapeStyle.innerShadowColor,
					shapeStyle.innerShadowOriginalOpacity,
					shapeStyle.innerShadowOpacity,
				)
			: undefined;
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
		const generated = this.builder.buildSoftEdgeXml(shapeStyle);
		return generated ? mergeAttributeEffectNode(shapeStyle.softEdgeXml, generated) : undefined;
	}

	public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const generated = this.builder.buildReflectionXml(shapeStyle);
		return generated ? mergeAttributeEffectNode(shapeStyle.reflectionXml, generated) : undefined;
	}

	public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildBlurXml(shapeStyle);
	}

	/**
	 * `a:fillOverlay`'s colour lives one level deeper than the other effects
	 * (nested in `a:solidFill`/`a:gradFill`, not a direct `EG_ColorChoice`
	 * child), so `mergeEffectNode`'s direct-color-child assumption does not
	 * apply here. When the typed colour/opacity are unchanged from what was
	 * parsed, keep the original fill child verbatim (preserving a gradient
	 * overlay, or any colour-transform authoring, byte-for-byte); otherwise
	 * replace it with the freshly generated solid-colour overlay.
	 */
	public buildFillOverlayXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const generated = this.builder.buildFillOverlayXml(shapeStyle);
		if (!generated) {
			return undefined;
		}

		const original = shapeStyle.fillOverlayXml;
		const unchanged =
			original !== undefined &&
			colorsEqual(shapeStyle.shapeFillOverlayOriginalColor, shapeStyle.shapeFillOverlayColor) &&
			shapeStyle.shapeFillOverlayOriginalOpacity === shapeStyle.shapeFillOverlayOpacity;

		const merged: XmlObject = { ...(original ?? {}) };
		merged['@_blend'] = generated['@_blend'];
		if (!unchanged) {
			delete merged['a:gradFill'];
			merged['a:solidFill'] = generated['a:solidFill'];
		}
		return merged;
	}

	public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		return this.builder.buildLineEffectListXml(shapeStyle);
	}
}
