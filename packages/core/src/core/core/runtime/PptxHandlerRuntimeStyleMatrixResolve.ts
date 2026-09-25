import type { ResolvedStyleMatrix, ShapeStyle, XmlObject } from '../../types';
import {
	captureStyleBaseline,
	STYLE_MATRIX_EFFECT_KEYS,
	STYLE_MATRIX_FILL_KEYS,
	STYLE_MATRIX_LINE_KEYS,
} from './authored-shape-style';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLoadPipeline';

/**
 * The reference's own `@idx`, INCLUDING 0: the load-path resolvers only record
 * a positive index (a loaded `<p:style>` node is rewritten in place, so its
 * zero indices survive), but a style built from scratch must still carry all
 * four required children of `CT_ShapeStyle`.
 */
function refIndex(node: XmlObject): number | undefined {
	const idx = Number.parseInt(String(node['@_idx'] ?? ''), 10);
	return Number.isFinite(idx) ? idx : undefined;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Resolve a `<p:style>` node (`a:lnRef`, `a:fillRef`, `a:effectRef`,
	 * `a:fontRef`) against the current theme's format scheme, with the same
	 * code the load path uses. Editors call this to apply a style-matrix
	 * gallery entry (Shape Styles) so that what they render and what they save
	 * both match what PowerPoint writes: a bare `<p:style>` and an `spPr` with
	 * no fill, outline or effects of its own.
	 */
	public resolveStyleMatrixReferences(styleXml: XmlObject): ResolvedStyleMatrix {
		const style: ShapeStyle = { styleMatrixReset: true };
		const fillRef = styleXml['a:fillRef'] as XmlObject | undefined;
		if (fillRef) {
			this.resolveThemeFillRef(fillRef, style);
			style.fillRefIdx ??= refIndex(fillRef);
			style.inheritedFillStyle = captureStyleBaseline(style, STYLE_MATRIX_FILL_KEYS);
		}
		const lnRef = styleXml['a:lnRef'] as XmlObject | undefined;
		if (lnRef) {
			this.resolveThemeLineRef(lnRef, style);
			style.lnRefIdx ??= refIndex(lnRef);
			style.inheritedLineStyle = captureStyleBaseline(style, STYLE_MATRIX_LINE_KEYS);
		}
		const effectRef = styleXml['a:effectRef'] as XmlObject | undefined;
		if (effectRef) {
			this.resolveThemeEffectRef(effectRef, style);
			style.effectRefIdx ??= refIndex(effectRef);
			style.inheritedEffectStyle = captureStyleBaseline(style, STYLE_MATRIX_EFFECT_KEYS);
		}
		const fontRef = styleXml['a:fontRef'] as XmlObject | undefined;
		let fontColor: string | undefined;
		if (fontRef) {
			const idx = String(fontRef['@_idx'] ?? '').trim();
			if (idx.length > 0) {
				style.fontRefIdx = idx;
			}
			for (const key of ['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr', 'a:scrgbClr']) {
				if (fontRef[key] !== undefined) {
					style.fontRefColorXml = { [key]: fontRef[key] } as XmlObject;
					break;
				}
			}
			fontColor = this.parseColor(fontRef);
		}
		return { shapeStyle: style, fontColor };
	}
}
