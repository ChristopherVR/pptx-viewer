import type { ConnectorArrowType, ShapeStyle, StrokeDashType, XmlObject } from '../../types';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import {
	captureStyleBaseline,
	STYLE_MATRIX_EFFECT_KEYS,
	STYLE_MATRIX_FILL_KEYS,
	STYLE_MATRIX_LINE_KEYS,
} from '../runtime/authored-shape-style';
import { drawingChild, hasDrawingChild, hasEmptyDrawingChild } from './drawing-fill-xml';
import { extractGradientTileRect } from './PptxGradientStyleCodec';
import { applyScene3dStyle, applyShape3dStyle } from './shape-style-3d-helpers';
import { applyLineProperties } from './shape-style-line-helpers';

export interface PptxShapeStyleExtractorContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	extractGradientFillColor: (gradFill: XmlObject) => string | undefined;
	extractGradientOpacity: (gradFill: XmlObject) => number | undefined;
	extractGradientFillCss: (gradFill: XmlObject) => string | undefined;
	extractGradientStops: (gradFill: XmlObject) => NonNullable<ShapeStyle['fillGradientStops']>;
	extractGradientAngle: (gradFill: XmlObject) => number;
	extractGradientType: (gradFill: XmlObject) => NonNullable<ShapeStyle['fillGradientType']>;
	extractGradientPathType: (gradFill: XmlObject) => ShapeStyle['fillGradientPathType'];
	extractGradientFocalPoint: (gradFill: XmlObject) => ShapeStyle['fillGradientFocalPoint'];
	extractGradientFillToRect: (gradFill: XmlObject) => ShapeStyle['fillGradientFillToRect'];
	extractGradientFlip: (gradFill: XmlObject) => ShapeStyle['fillGradientFlip'];
	extractGradientRotWithShape: (gradFill: XmlObject) => boolean | undefined;
	extractGradientScaled: (gradFill: XmlObject) => boolean | undefined;
	normalizeStrokeDashType: (value: unknown) => StrokeDashType | undefined;
	normalizeConnectorArrowType: (value: unknown) => ConnectorArrowType | undefined;
	ensureArray: (value: unknown) => unknown[];
	resolveThemeFillRef: (refNode: XmlObject, style: ShapeStyle) => void;
	resolveThemeLineRef: (refNode: XmlObject, style: ShapeStyle) => void;
	resolveThemeEffectRef: (refNode: XmlObject, style: ShapeStyle) => void;
	extractShadowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractInnerShadowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractGlowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractSoftEdgeStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractReflectionStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractBlurStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
	extractEffectDagStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
}

export interface IPptxShapeStyleExtractor {
	extractShapeStyle(spPr: XmlObject | undefined, styleNode?: XmlObject): ShapeStyle;
}

export class PptxShapeStyleExtractor implements IPptxShapeStyleExtractor {
	private readonly context: PptxShapeStyleExtractorContext;

	public constructor(context: PptxShapeStyleExtractorContext) {
		this.context = context;
	}

	public extractShapeStyle(spPr: XmlObject | undefined, styleNode?: XmlObject): ShapeStyle {
		const style: ShapeStyle = {};
		const shapeProps = (spPr || {}) as XmlObject;

		const solidFill = drawingChild(shapeProps, 'solidFill');
		const gradFill = drawingChild(shapeProps, 'gradFill');
		const pattFill = drawingChild(shapeProps, 'pattFill');
		// `a:noFill` is an empty marker element, so it has no object form for
		// `drawingChild` to return - it must be detected by presence, or a shape
		// that explicitly says "no fill" falls through to the `a:fillRef` branch
		// and inherits the theme fill instead of staying unfilled.
		const noFill = hasDrawingChild(shapeProps, 'noFill');
		const blipFill = drawingChild(shapeProps, 'blipFill');

		if (solidFill) {
			style.fillMode = 'solid';
			style.fillColor = this.context.parseColor(solidFill);
			style.fillOpacity = this.context.extractColorOpacity(solidFill);
			const solidFillColorXml = extractColorChoiceXml(solidFill);
			if (solidFillColorXml) {
				style.fillColorXml = solidFillColorXml;
			}
		} else if (gradFill) {
			style.fillMode = 'gradient';
			style.fillGradientXml = gradFill;
			style.fillColor = this.context.extractGradientFillColor(gradFill);
			style.fillOpacity = this.context.extractGradientOpacity(gradFill);
			style.fillGradient = this.context.extractGradientFillCss(gradFill);
			style.fillGradientStops = this.context.extractGradientStops(gradFill);
			style.fillGradientAngle = this.context.extractGradientAngle(gradFill);
			style.fillGradientType = this.context.extractGradientType(gradFill);
			style.fillGradientPathType = this.context.extractGradientPathType(gradFill);
			style.fillGradientFocalPoint = this.context.extractGradientFocalPoint(gradFill);
			style.fillGradientFillToRect = this.context.extractGradientFillToRect(gradFill);
			const gradTileRect = extractGradientTileRect(gradFill);
			if (gradTileRect) {
				style.fillGradientTileRect = gradTileRect;
			}
			const gradFlip = this.context.extractGradientFlip(gradFill);
			if (gradFlip) {
				style.fillGradientFlip = gradFlip;
			}
			const gradRot = this.context.extractGradientRotWithShape(gradFill);
			if (gradRot !== undefined) {
				style.fillGradientRotWithShape = gradRot;
			}
			const gradScaled = this.context.extractGradientScaled(gradFill);
			if (gradScaled !== undefined) {
				style.fillGradientScaled = gradScaled;
			}
		} else if (pattFill) {
			style.fillMode = 'pattern';
			style.fillPatternXml = pattFill;
			style.fillColor =
				this.context.parseColor(drawingChild(pattFill, 'fgClr')) ||
				this.context.parseColor(drawingChild(pattFill, 'bgClr'));
			style.fillOpacity =
				this.context.extractColorOpacity(drawingChild(pattFill, 'fgClr')) ||
				this.context.extractColorOpacity(drawingChild(pattFill, 'bgClr'));
			const pattPreset = String(pattFill['@_prst'] || '').trim();
			if (pattPreset.length > 0) {
				style.fillPatternPreset = pattPreset;
			}
			const pattBgColor = this.context.parseColor(drawingChild(pattFill, 'bgClr'));
			if (pattBgColor) {
				style.fillPatternBackgroundColor = pattBgColor;
			}
			// Preserve raw XML colour nodes for round-trip (retains color transforms)
			const fgClrNode = drawingChild(pattFill, 'fgClr');
			if (fgClrNode) {
				style.fillPatternFgClrXml = fgClrNode;
			}
			const bgClrNode = drawingChild(pattFill, 'bgClr');
			if (bgClrNode) {
				style.fillPatternBgClrXml = bgClrNode;
			}
		} else if (noFill) {
			// `a:noFill` means the shape is unfilled, full stop. `a14:hiddenFill`
			// is only where PowerPoint REMEMBERS the fill to restore if the user
			// turns the fill back on; it is not painted. (Verified against
			// PowerPoint itself: for shapes carrying `a14:hiddenFill`, the object
			// model reports `Shape.Fill.Visible = 0`.) Painting it filled shapes
			// that render bare, and - because a filled shape is not classified as
			// a text box - turned plain text placeholders into styled shapes. The
			// extension survives a round-trip via the preserved `a:extLst`.
			style.fillMode = 'none';
			style.fillColor = 'transparent';
			style.fillOpacity = 0;
		} else if (blipFill) {
			style.fillMode = 'image';
			style.fillColor = 'transparent';
			style.fillOpacity = 0;
		} else if (shapeProps['a:grpFill'] !== undefined) {
			style.fillMode = 'group';
		} else if (styleNode?.['a:fillRef']) {
			this.context.resolveThemeFillRef(styleNode['a:fillRef'] as XmlObject, style);
			// Reached only when `spPr` declared NO fill of its own, so the
			// reference is what paints this shape. Record what it resolved to:
			// the save path writes a concrete fill only once the flat style
			// stops agreeing with this, because an `spPr` fill outranks
			// `a:fillRef` and would cut the shape off from the theme.
			style.inheritedFillStyle = captureStyleBaseline(style, STYLE_MATRIX_FILL_KEYS);
		}

		const lineNode = shapeProps['a:ln'] as XmlObject | undefined;
		// `<p:style><a:lnRef>` is the BASE outline (the theme's `lnStyleLst`
		// entry plus the referenced colour); `spPr/a:ln` overrides individual
		// properties on top of it. Treating the two as alternatives dropped the
		// theme colour for any shape that carried both, which is the ordinary
		// shape a connector produces: PowerPoint writes the colour into `a:lnRef`
		// and leaves `a:ln` holding nothing but the arrow ends
		// (`<a:ln><a:headEnd type="oval"/></a:ln>`). Those connectors fell through
		// to the default stroke and drew black instead of the theme accent.
		//
		// Resolving the ref first is safe because `applyLineProperties` only
		// writes what the `a:ln` actually declares - and `<a:noFill/>` still wins,
		// since it returns early after clearing the stroke outright.
		if (styleNode?.['a:lnRef']) {
			this.context.resolveThemeLineRef(styleNode['a:lnRef'] as XmlObject, style);
			// Snapshot the reference's contribution BEFORE `a:ln` overrides part
			// of it below, so the writer can tell an authored outline property
			// from one the theme's line style handed down.
			style.inheritedLineStyle = captureStyleBaseline(style, STYLE_MATRIX_LINE_KEYS);
		}
		if (lineNode) {
			// `applyLineProperties` returns true for `<a:ln><a:noFill/></a:ln>`,
			// meaning "outline fully resolved as none". That is a statement about
			// the OUTLINE only. Returning from the whole extractor on it also
			// threw away every shape-level effect below (shadow, glow, soft edge,
			// reflection, blur, effectRef), the `<a:fontRef>` style reference, and
			// the 3D scene/shape styles - for the very common case of a shape with
			// no outline. Losing `fontRef` is what made themed accent buttons
			// resolve their text colour to black.
			applyLineProperties(lineNode, style, this.context);
		}

		Object.assign(style, this.context.extractShadowStyle(shapeProps));
		Object.assign(style, this.context.extractInnerShadowStyle(shapeProps));
		Object.assign(style, this.context.extractGlowStyle(shapeProps));
		Object.assign(style, this.context.extractSoftEdgeStyle(shapeProps));
		Object.assign(style, this.context.extractReflectionStyle(shapeProps));
		Object.assign(style, this.context.extractBlurStyle(shapeProps));
		Object.assign(style, this.context.extractEffectDagStyle(shapeProps));

		if (styleNode?.['a:effectRef']) {
			// An EMPTY `<a:effectLst/>` on `spPr` is PowerPoint's spelling of
			// "this shape has no effects" - it is what the UI writes when the user
			// switches a themed shadow off. Because the container holds nothing,
			// none of the extractors above set an effect property, and
			// `resolveThemeEffectRef` only skips a property the shape already
			// claimed; so the theme's shadow was handed straight back and the
			// author's explicit "none" was silently overruled. That is the
			// inheritance-flattening class inverted: an authored ABSENCE lost to
			// inheritance.
			//
			// The ref is still resolved, then its contribution rolled back, so
			// `effectRefIdx` / `effectRefColorXml` survive for the save path and
			// `<a:effectRef>` still round-trips. Only keys this call ADDED are
			// removed, so nothing authored can be caught by it.
			const suppressInherited = hasEmptyDrawingChild(shapeProps, 'effectLst');
			// Snapshot what the shape already carries BEFORE the ref runs, so we
			// can tell "the ref set this" from "the shape already had this" -
			// `resolveThemeEffectRef` only fills gaps (`!style.shadowColor` etc.),
			// so anything it adds here was not authored on `spPr`.
			const authoredBefore = new Set(Object.keys(style));
			this.context.resolveThemeEffectRef(styleNode['a:effectRef'] as XmlObject, style);
			if (suppressInherited) {
				for (const key of Object.keys(style) as (keyof ShapeStyle)[]) {
					if (!authoredBefore.has(key) && key !== 'effectRefIdx' && key !== 'effectRefColorXml') {
						delete style[key];
					}
				}
			} else {
				// Record exactly what the reference contributed so the save path
				// can leave `spPr` effect-less while the flat style still agrees
				// with it, instead of baking a resolved shadow/glow/3D scene back
				// in and outranking `<a:effectRef>` on the very next save (the
				// effect-scope twin of `inheritedFillStyle` / `inheritedLineStyle`
				// above).
				const inheritedKeys = STYLE_MATRIX_EFFECT_KEYS.filter((key) => !authoredBefore.has(key));
				style.inheritedEffectStyle = captureStyleBaseline(style, inheritedKeys);
			}
		}

		// Persist `<a:fontRef>` indices and override-color XML so they can be
		// re-emitted in `<p:style>` at save time (Phase 2 Stream B / C-H2).
		const fontRef = styleNode?.['a:fontRef'] as XmlObject | undefined;
		if (fontRef) {
			const idxAttr = String(fontRef['@_idx'] || '').trim();
			if (idxAttr.length > 0) {
				style.fontRefIdx = idxAttr;
			}
			const overrideColorXml = this.extractFontRefColorXml(fontRef);
			if (overrideColorXml) {
				style.fontRefColorXml = overrideColorXml;
			}
		}

		applyScene3dStyle(shapeProps, style);
		applyShape3dStyle(shapeProps, style, this.context);

		return style;
	}

	/**
	 * Pull the verbatim colour-choice child out of an `a:fontRef` element,
	 * preserving any contained colour transforms for round-trip.
	 */
	private extractFontRefColorXml(refNode: XmlObject | undefined): XmlObject | undefined {
		if (!refNode) {
			return undefined;
		}
		const keys = [
			'a:scrgbClr',
			'a:srgbClr',
			'a:hslClr',
			'a:sysClr',
			'a:schemeClr',
			'a:prstClr',
		] as const;
		for (const key of keys) {
			const child = refNode[key];
			if (child !== undefined) {
				return { [key]: child } as XmlObject;
			}
		}
		return undefined;
	}
}
