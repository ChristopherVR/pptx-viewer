/**
 * Element-patch helpers shared by the style galleries: replacing a shape's
 * whole fill/outline/effect set (a gallery pick is a REPLACEMENT in
 * PowerPoint, not an overlay) and recolouring text that still inherits its
 * colour.
 *
 * @module render/ribbon-galleries/gallery-element-patch
 */
import type { PptxElement, ShapeStyle, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

/** ShapeStyle keys that are not part of the fill/outline/effect set. */
function keepsAcrossStylePick(key: string): boolean {
	return key.startsWith('connector');
}

/**
 * The element's shape style with every fill, outline, effect and style-matrix
 * key removed, so a gallery preset replaces them wholesale. Connector
 * arrowheads and connection sites survive.
 */
export function shapeStyleWithoutFormatting(element: PptxElement): ShapeStyle {
	const base: ShapeStyle = {};
	if (!hasShapeProperties(element) || !element.shapeStyle) {
		return base;
	}
	for (const [key, value] of Object.entries(element.shapeStyle)) {
		if (keepsAcrossStylePick(key)) {
			(base as Record<string, unknown>)[key] = value;
		}
	}
	return base;
}

function runInheritsColor(style: TextStyle): boolean {
	return style.authoredRunStyle === undefined || style.authoredRunStyle.color === undefined;
}

/**
 * Recolour every run whose colour is inherited (not authored on the run) to
 * `color`, updating its inheritance baseline too, so the writer still leaves
 * the run colour to `<a:fontRef>` exactly as PowerPoint does. Returns the
 * `textSegments` / `textStyle` part of a patch, or `{}` when the element has
 * no text.
 */
export function recolorInheritedText(
	element: PptxElement,
	color: string | undefined,
): Partial<PptxElement> {
	if (!color) {
		return {};
	}
	const patch: { textSegments?: TextSegment[]; textStyle?: TextStyle } = {};
	const segments = (element as { textSegments?: TextSegment[] }).textSegments;
	if (segments?.length) {
		patch.textSegments = segments.map((segment) => {
			if (!runInheritsColor(segment.style)) {
				return segment;
			}
			const inherited = segment.style.inheritedRunStyle;
			return {
				...segment,
				style: {
					...segment.style,
					color,
					colorRef: undefined,
					colorXml: undefined,
					...(inherited && { inheritedRunStyle: { ...inherited, color } }),
				},
			};
		});
	}
	const textStyle = (element as { textStyle?: TextStyle }).textStyle;
	if (textStyle && !segments?.length) {
		patch.textStyle = { ...textStyle, color, colorRef: undefined, colorXml: undefined };
	}
	return patch as Partial<PptxElement>;
}
