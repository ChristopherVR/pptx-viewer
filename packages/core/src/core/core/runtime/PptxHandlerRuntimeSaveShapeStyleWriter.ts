import { XmlObject } from '../../types';
import type { ShapeStyle } from '../../types';
import { reorderObjectKeys, SHAPE_STYLE_ORDER } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveXmlHelpers';
import { writeShapeFillAndStroke } from './save-shape-fill-stroke';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialize shape fill, stroke, dash, arrows, line join/cap/compound,
	 * and line-level effects to the given spPr XML object.
	 *
	 * The whole body lives in {@link writeShapeFillAndStroke} as a free
	 * function so the colocated unit test can import and drive the REAL logic
	 * (it used to keep a private copy, which is why the dual-fill defect went
	 * unnoticed). This method only supplies the runtime-bound dependencies.
	 */
	protected applyFillAndStroke(spPr: XmlObject, shapeStyle: ShapeStyle): void {
		writeShapeFillAndStroke(spPr, shapeStyle, {
			gradientFillXml: this.buildGradientFillXml(shapeStyle),
			lineEffectListXml: this.buildLineEffectListXml(shapeStyle),
			emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
			parseColor: (colorNode) => this.parseColor(colorNode),
		});
	}

	/**
	 * Serialize the shape's `<p:style>` block (CT_ShapeStyle §20.1.2.2.36)
	 * from the persisted ref indices/colour XML. Emits children in spec
	 * order: `lnRef → fillRef → effectRef → fontRef`.
	 *
	 * When the original shape XML already contained a `<p:style>` we mutate
	 * that node in place so any unmodelled attributes/children are preserved.
	 * When it didn't, we create one. When the shape no longer has any ref
	 * data we leave the existing `<p:style>` (if any) untouched: silently
	 * dropping it would break round-tripping.
	 *
	 * Phase 2 Stream B / C-H2.
	 */
	protected applyShapeStyleRefs(shape: XmlObject, shapeStyle: ShapeStyle): void {
		const hasAnyRef =
			shapeStyle.lnRefIdx !== undefined ||
			shapeStyle.fillRefIdx !== undefined ||
			shapeStyle.effectRefIdx !== undefined ||
			shapeStyle.fontRefIdx !== undefined;

		if (!hasAnyRef) {
			return;
		}

		const existing = shape['p:style'] as XmlObject | undefined;
		const styleNode: XmlObject = existing ?? {};

		// lnRef
		if (shapeStyle.lnRefIdx !== undefined) {
			const lnRef = (styleNode['a:lnRef'] as XmlObject | undefined) ?? {};
			lnRef['@_idx'] = String(shapeStyle.lnRefIdx);
			this.replaceRefColorChoice(lnRef, shapeStyle.lnRefColorXml);
			styleNode['a:lnRef'] = lnRef;
		}

		// fillRef
		if (shapeStyle.fillRefIdx !== undefined) {
			const fillRef = (styleNode['a:fillRef'] as XmlObject | undefined) ?? {};
			fillRef['@_idx'] = String(shapeStyle.fillRefIdx);
			this.replaceRefColorChoice(fillRef, shapeStyle.fillRefColorXml);
			styleNode['a:fillRef'] = fillRef;
		}

		// effectRef
		if (shapeStyle.effectRefIdx !== undefined) {
			const effectRef = (styleNode['a:effectRef'] as XmlObject | undefined) ?? {};
			effectRef['@_idx'] = String(shapeStyle.effectRefIdx);
			this.replaceRefColorChoice(effectRef, shapeStyle.effectRefColorXml);
			styleNode['a:effectRef'] = effectRef;
		}

		// fontRef
		if (shapeStyle.fontRefIdx !== undefined) {
			const fontRef = (styleNode['a:fontRef'] as XmlObject | undefined) ?? {};
			fontRef['@_idx'] = shapeStyle.fontRefIdx;
			this.replaceRefColorChoice(fontRef, shapeStyle.fontRefColorXml);
			styleNode['a:fontRef'] = fontRef;
		}

		// Reorder children to CT_ShapeStyle order.
		const reordered = reorderObjectKeys(styleNode, SHAPE_STYLE_ORDER);
		for (const key of Object.keys(styleNode)) {
			delete styleNode[key];
		}
		for (const key of Object.keys(reordered)) {
			styleNode[key] = reordered[key];
		}

		shape['p:style'] = styleNode;
	}

	/**
	 * Replace any existing colour-choice child on a style-matrix-reference
	 * element with the given preserved XML, or strip all colour children
	 * when the override is undefined.
	 */
	private replaceRefColorChoice(refNode: XmlObject, colorXml: XmlObject | undefined): void {
		// Strip any pre-existing color choice children.
		for (const key of [
			'a:scrgbClr',
			'a:srgbClr',
			'a:hslClr',
			'a:sysClr',
			'a:schemeClr',
			'a:prstClr',
		]) {
			delete refNode[key];
		}
		if (!colorXml) {
			return;
		}
		for (const [key, value] of Object.entries(colorXml)) {
			refNode[key] = value;
		}
	}
}
