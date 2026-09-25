import type { ShapeStyle, XmlObject } from '../../types';

const FILL_CHOICES = [
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
];
const EFFECT_CHILDREN = ['a:effectLst', 'a:effectDag', 'a:scene3d', 'a:sp3d'];

/**
 * A style-matrix pick (Shape Styles gallery) REPLACES a shape's own fill,
 * outline and effects: PowerPoint writes an `spPr` with none of them and lets
 * `<p:style>` paint the shape. The writers only ever add what the flat style
 * owns, so a fill or outline the shape authored before the pick would
 * survive in the retained `spPr` and outrank the new references. This clears
 * them first; the gated writers then add back only what the style still owns
 * (arrowheads, for instance, which live on `a:ln`).
 */
export function resetSpPrFormattingForStyleMatrix(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	if (!shapeStyle.styleMatrixReset) {
		return;
	}
	for (const key of FILL_CHOICES) {
		delete spPr[key];
	}
	delete spPr['a:ln'];
}

/** The effect-scope twin of {@link resetSpPrFormattingForStyleMatrix}. */
export function resetSpPrEffectsForStyleMatrix(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	if (!shapeStyle.styleMatrixReset) {
		return;
	}
	for (const key of EFFECT_CHILDREN) {
		delete spPr[key];
	}
}
