import type { ConnectorArrowType, ShapeStyle, StrokeDashType, XmlObject } from '../../types';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import { drawingChild } from './drawing-fill-xml';
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
		const noFill = drawingChild(shapeProps, 'noFill');
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
			// When main fill is a:noFill, check p14:hiddenFill in the extension
			// list — PowerPoint stores the "real" fill there for shapes that
			// appear unfilled in normal view but should show fill in some contexts.
			const hiddenFillProps = this.extractHiddenFillFromExtLst(shapeProps);
			if (hiddenFillProps) {
				const hiddenSolid = hiddenFillProps['a:solidFill'] as XmlObject | undefined;
				const hiddenGrad = hiddenFillProps['a:gradFill'] as XmlObject | undefined;
				if (hiddenSolid) {
					style.fillMode = 'solid';
					style.fillColor = this.context.parseColor(hiddenSolid);
					style.fillOpacity = this.context.extractColorOpacity(hiddenSolid);
				} else if (hiddenGrad) {
					style.fillMode = 'gradient';
					style.fillColor = this.context.extractGradientFillColor(hiddenGrad);
					style.fillOpacity = this.context.extractGradientOpacity(hiddenGrad);
					style.fillGradient = this.context.extractGradientFillCss(hiddenGrad);
					style.fillGradientStops = this.context.extractGradientStops(hiddenGrad);
					style.fillGradientAngle = this.context.extractGradientAngle(hiddenGrad);
					style.fillGradientType = this.context.extractGradientType(hiddenGrad);
				} else {
					style.fillMode = 'none';
					style.fillColor = 'transparent';
					style.fillOpacity = 0;
				}
			} else {
				style.fillMode = 'none';
				style.fillColor = 'transparent';
				style.fillOpacity = 0;
			}
		} else if (blipFill) {
			style.fillMode = 'image';
			style.fillColor = 'transparent';
			style.fillOpacity = 0;
		} else if (shapeProps['a:grpFill'] !== undefined) {
			style.fillMode = 'group';
		} else if (styleNode?.['a:fillRef']) {
			this.context.resolveThemeFillRef(styleNode['a:fillRef'] as XmlObject, style);
		}

		const lineNode = shapeProps['a:ln'] as XmlObject | undefined;
		if (lineNode) {
			const earlyReturn = applyLineProperties(lineNode, shapeProps, style, this.context, (props) =>
				this.extractHiddenLineFromExtLst(props),
			);
			if (earlyReturn) {
				return style;
			}
		} else if (styleNode?.['a:lnRef']) {
			this.context.resolveThemeLineRef(styleNode['a:lnRef'] as XmlObject, style);
		}

		Object.assign(style, this.context.extractShadowStyle(shapeProps));
		Object.assign(style, this.context.extractInnerShadowStyle(shapeProps));
		Object.assign(style, this.context.extractGlowStyle(shapeProps));
		Object.assign(style, this.context.extractSoftEdgeStyle(shapeProps));
		Object.assign(style, this.context.extractReflectionStyle(shapeProps));
		Object.assign(style, this.context.extractBlurStyle(shapeProps));
		Object.assign(style, this.context.extractEffectDagStyle(shapeProps));

		if (styleNode?.['a:effectRef']) {
			this.context.resolveThemeEffectRef(styleNode['a:effectRef'] as XmlObject, style);
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

	/**
	 * Extract p14:hiddenFill from the shape properties extension list.
	 * URI: {AF507438-7753-43E0-B8FC-AC1667EBCBE1}
	 *
	 * The p14:hiddenFill element wraps a standard fill child (a:solidFill,
	 * a:gradFill, etc.) that should be applied when the main fill is absent.
	 */
	private extractHiddenFillFromExtLst(shapeProps: XmlObject): XmlObject | undefined {
		const extLst = shapeProps['a:extLst'] as XmlObject | undefined;
		if (!extLst) {
			return undefined;
		}

		const exts = this.context.ensureArray(extLst['a:ext']);
		for (const ext of exts) {
			const extObj = ext as XmlObject;
			const uri = String(extObj?.['@_uri'] || '');
			if (uri === '{AF507438-7753-43E0-B8FC-AC1667EBCBE1}') {
				// p14:hiddenFill wraps the fill child directly
				return (extObj['a14:hiddenFill'] ?? extObj['p14:hiddenFill']) as XmlObject | undefined;
			}
		}
		return undefined;
	}

	/**
	 * Extract p14:hiddenLine from the shape properties extension list.
	 * URI: {91240B29-F687-4F45-9708-019B960494DF}
	 *
	 * The p14:hiddenLine element wraps a standard a:ln-like structure
	 * that should be applied when the main line is absent.
	 */
	private extractHiddenLineFromExtLst(shapeProps: XmlObject): XmlObject | undefined {
		const extLst = shapeProps['a:extLst'] as XmlObject | undefined;
		if (!extLst) {
			return undefined;
		}

		const exts = this.context.ensureArray(extLst['a:ext']);
		for (const ext of exts) {
			const extObj = ext as XmlObject;
			const uri = String(extObj?.['@_uri'] || '');
			if (uri === '{91240B29-F687-4F45-9708-019B960494DF}') {
				return (extObj['a14:hiddenLine'] ?? extObj['p14:hiddenLine']) as XmlObject | undefined;
			}
		}
		return undefined;
	}
}
