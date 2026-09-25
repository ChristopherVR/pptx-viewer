/**
 * Label colour for a cached SmartArt drawing shape whose runs declare none,
 * and the fill opacity it (and the renderers) read. Split out of
 * `smartart-drawing.ts`, which projects the shapes.
 *
 * @module render/smartart-drawing-label-color
 */
import type { PptxSmartArtDrawingShape } from 'pptx-viewer-core';

import { contrastTextColor, parseHex } from './color-contrast';

/**
 * The opacity to paint a cached shape's solid fill at, or `undefined` when it
 * is opaque (or the fill is not a solid colour). Basic Venn caches its circles
 * as `accent1` at `a:alpha 50000`, and PowerPoint blends the overlaps.
 */
export function drawingShapeFillOpacity(shape: PptxSmartArtDrawingShape): number | undefined {
	if (shape.fillNone || (shape.fillGradientStops?.length ?? 0) > 0) {
		return undefined;
	}
	const opacity = shape.fillOpacity;
	if (opacity === undefined || !Number.isFinite(opacity) || opacity >= 1) {
		return undefined;
	}
	return Math.max(0, opacity);
}

/** `color` at `opacity` composited onto white, as `#rrggbb`. */
function blendOntoWhite(color: string, opacity: number | undefined): string {
	if (opacity === undefined || !color.startsWith('#')) {
		return color;
	}
	const hex = parseHex(color)
		.map((c) => Math.round(c * opacity + 255 * (1 - opacity)))
		.map((c) => c.toString(16).padStart(2, '0'))
		.join('');
	return `#${hex}`;
}

/**
 * The fill of the nearest shape painted beneath `shape`'s centre.
 *
 * SmartArt layouts commonly stack an unfilled shape over a painted one to hold
 * the label, so what the label has to be readable against is that lower shape,
 * not the transparency of its own box. Shapes are in paint order, so the search
 * runs backwards from the label and takes the first painted hit.
 */
function underlyingFill(
	shape: PptxSmartArtDrawingShape,
	shapes: PptxSmartArtDrawingShape[],
	index: number,
): string | undefined {
	const centerX = shape.x + shape.width / 2;
	const centerY = shape.y + shape.height / 2;
	for (let below = index - 1; below >= 0; below--) {
		const candidate = shapes[below];
		if (!candidate || candidate.fillNone || !candidate.fillColor) {
			continue;
		}
		if (
			centerX >= candidate.x &&
			centerX <= candidate.x + candidate.width &&
			centerY >= candidate.y &&
			centerY <= candidate.y + candidate.height
		) {
			return blendOntoWhite(candidate.fillColor, drawingShapeFillOpacity(candidate));
		}
	}
	return undefined;
}

/**
 * Pick a label colour for a cached shape whose runs declare none.
 *
 * PowerPoint leaves the colour implicit far more often than not, and resolves it
 * against the shape's own fill. Defaulting to white instead makes every label on
 * a light content panel invisible. A semi-transparent fill is read as it shows
 * on the slide (blended onto white), so a 50% Venn circle gets dark text.
 */
export function drawingShapeLabelColor(
	shape: PptxSmartArtDrawingShape,
	shapes: PptxSmartArtDrawingShape[],
	index: number,
	resolvedFill: string,
): string {
	// A gradient fill is read against its middle stop (what most of the label
	// sits on), not the shape underneath.
	const stops = shape.fillGradientStops;
	const midStop =
		resolvedFill.startsWith('url(') && stops && stops.length > 0
			? stops[Math.floor((stops.length - 1) / 2)]
			: undefined;
	const gradientBasis = midStop
		? blendOntoWhite(
				midStop.color,
				midStop.opacity !== undefined && midStop.opacity < 1 ? midStop.opacity : undefined,
			)
		: undefined;
	const basis =
		gradientBasis ??
		(resolvedFill === 'none' || resolvedFill.startsWith('url(')
			? underlyingFill(shape, shapes, index)
			: blendOntoWhite(resolvedFill, drawingShapeFillOpacity(shape)));
	return basis ? contrastTextColor(basis) : '#1a1a1a';
}

/**
 * The opacity a 3D mesh paints a cached shape at: its solid fill alpha, or a
 * gradient whose every stop shares one alpha (the bevel Venn styles cache
 * `a:gradFill` stops at `a:alpha 50000`). Per-stop alpha that varies is not
 * representable on one material, so it stays opaque.
 */
export function drawingShapeMeshOpacity(shape: PptxSmartArtDrawingShape): number {
	const solid = drawingShapeFillOpacity(shape);
	if (solid !== undefined) {
		return solid;
	}
	const stops = shape.fillNone ? undefined : shape.fillGradientStops;
	const first = stops?.[0]?.opacity;
	if (
		!stops ||
		first === undefined ||
		first >= 1 ||
		!stops.every((stop) => stop.opacity !== undefined && Math.abs(stop.opacity - first) < 1e-6)
	) {
		return 1;
	}
	return Math.max(0, first);
}
