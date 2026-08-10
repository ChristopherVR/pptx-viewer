/**
 * smartart-drawing.ts: Drawing-shape view-model helpers for the SmartArt
 * renderer, shared across the React, Vue, and Angular bindings.
 *
 * These back the **pre-computed drawing-shapes** path
 * (`smartArtData.drawingShapes`), which the core engine extracts from
 * `ppt/diagrams/drawing*.xml`. That path is preferred when present and is
 * independent of the SVG-fallback layout engine (`computeSmartArtLayout` in
 * `smartart-layout`), which only runs when no drawing shapes exist.
 *
 * Pure TypeScript (no framework imports). Style helpers (`styleStroke`,
 * `styleShadow`) are reused from `smartart-layout-helpers`.
 */

import { getShapeType } from 'pptx-viewer-core';
import type {
	PptxSmartArtChrome,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { contrastTextColor } from './color-contrast';
import type { CssStyleMap } from './element-style-transform';
import { chevronPoints, styleShadow, styleStroke } from './smartart-layout-helpers';
import type { SvgTextLine } from './svg-text-lines';
import { centeredSvgTextLines } from './svg-text-lines';

/** Built-in named colour palettes (mirrors the Vue/React `PALETTES`). */
export const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

export const DEFAULT_PALETTE: string[] = PALETTES.colorful1;

/** Pick a colour from `palette`, wrapping `index` around its length. */
export function paletteColour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

/**
 * Resolve the active colour palette for a SmartArt diagram.
 *
 * Priority: colorTransform fill colours → named scheme → default (colorful1).
 */
export function resolvePalette(data: PptxSmartArtData | undefined): string[] {
	if (!data) {
		return DEFAULT_PALETTE;
	}
	const ctFills = data.colorTransform?.fillColors;
	if (ctFills && ctFills.length > 0) {
		return ctFills;
	}
	return PALETTES[data.colorScheme ?? 'colorful1'] ?? DEFAULT_PALETTE;
}

/**
 * CSS style map for the chrome wrapper `<div>`. Applies background colour
 * and/or outline border when `chrome` is present.
 */
export function buildChromeStyle(chrome: PptxSmartArtChrome | undefined): CssStyleMap {
	const s: CssStyleMap = {
		width: '100%',
		height: '100%',
		'box-sizing': 'border-box',
		overflow: 'hidden',
	};
	if (!chrome) {
		return s;
	}
	if (chrome.backgroundColor) {
		s['background-color'] = chrome.backgroundColor;
	}
	if (chrome.outlineColor) {
		s['border'] = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
	}
	return s;
}

/**
 * Which SVG primitive paints a cached shape's body. One discriminant rather than
 * a set of booleans, so a binding's template is a single switch and adding a
 * primitive cannot leave four bindings behind.
 */
export type RenderedShapeKind = 'image' | 'ellipse' | 'polygon' | 'rect';

/** One stop of a cached shape's gradient fill, ready to place as an SVG `<stop>`. */
export interface RenderedGradientStop {
	/** Percentage offset, e.g. `"37%"`. */
	offset: string;
	color: string;
	opacity?: number;
}

/**
 * A gradient paint server for a cached shape, in SVG terms.
 *
 * The OOXML angle is already converted to the axis endpoints here, because a
 * gradient is not expressible as a plain `fill` string: the binding has to emit
 * a `<defs>` entry and reference it. Keeping the geometry on this side means the
 * conversion happens once instead of once per binding.
 */
export interface RenderedGradient {
	/** Element id to emit and reference; unique within the diagram. */
	id: string;
	kind: 'linear' | 'radial';
	/** Axis endpoints as percentages (`kind === 'linear'`). */
	x1?: string;
	y1?: string;
	x2?: string;
	y2?: string;
	/** Centre and radius as percentages (`kind === 'radial'`). */
	cx?: string;
	cy?: string;
	r?: string;
	stops: RenderedGradientStop[];
}

/** Projected view-model for a single pre-computed drawing shape. */
export interface RenderedShape {
	key: string;
	/** Which primitive paints the body; see {@link RenderedShapeKind}. */
	kind: RenderedShapeKind;
	/** `points` for the polygon body, set when `kind === 'polygon'`. */
	points?: string;
	/**
	 * Gradient to emit in `<defs>` and reference from {@link fill}, when the
	 * cached shape carries `a:gradFill`.
	 */
	gradient?: RenderedGradient;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	cx: number;
	cy: number;
	/** Paint for the body, or `'none'` when the shape declares `a:noFill`. */
	fill: string;
	stroke: string;
	strokeWidth: number;
	transform: string | undefined;
	/**
	 * Picture fill to draw in place of the body, when the cached shape carries a
	 * resolved `a:blipFill`. SmartArt icon layouts are built from these, and a
	 * renderer that only paints `fill` turns each icon into a coloured box.
	 */
	imageUrl: string | undefined;
	/**
	 * The shape's authored text, wrapped to its own width and vertically centred
	 * on {@link textY}. Cached SmartArt text is real sentence content, so it is
	 * wrapped rather than cut: dropping the tail of a sentence loses information
	 * the deck was written to carry. Each entry is ready to place as one
	 * `<tspan>` at `textX` / its own `y`.
	 */
	textLines: SvgTextLine[];
	textX: number;
	textY: number;
	fontColor: string;
	fontSize: number;
}

/**
 * Fraction of a shape's width its label may occupy. DiagramML shapes carry the
 * usual text insets, and wrapping to the full box would let text sit on the
 * outline.
 */
const TEXT_WIDTH_FRACTION = 0.82;

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
			return candidate.fillColor;
		}
	}
	return undefined;
}

/**
 * Pick a label colour for a cached shape whose runs declare none.
 *
 * PowerPoint leaves the colour implicit far more often than not, and resolves it
 * against the shape's own fill. Defaulting to white instead makes every label on
 * a light content panel invisible.
 */
export function drawingShapeLabelColor(
	shape: PptxSmartArtDrawingShape,
	shapes: PptxSmartArtDrawingShape[],
	index: number,
	resolvedFill: string,
): string {
	const basis =
		resolvedFill === 'none' || resolvedFill.startsWith('url(')
			? underlyingFill(shape, shapes, index)
			: resolvedFill;
	return basis ? contrastTextColor(basis) : '#1a1a1a';
}

/** SVG `viewBox` bounding-box derived from all drawing shapes. */
export interface DrawingViewBox {
	minX: number;
	minY: number;
	width: number;
	height: number;
}

/** Compute the SVG viewBox that fits all drawing shapes, rebasing to (0, 0). */
export function computeDrawingViewBox(shapes: PptxSmartArtDrawingShape[]): DrawingViewBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const s of shapes) {
		if (s.x < minX) {
			minX = s.x;
		}
		if (s.y < minY) {
			minY = s.y;
		}
		if (s.x + s.width > maxX) {
			maxX = s.x + s.width;
		}
		if (s.y + s.height > maxY) {
			maxY = s.y + s.height;
		}
	}
	if (!Number.isFinite(minX)) {
		return { minX: 0, minY: 0, width: 1, height: 1 };
	}
	return {
		minX,
		minY,
		width: maxX - minX || 1,
		height: maxY - minY || 1,
	};
}

/**
 * Build the SVG gradient for a cached shape's `a:gradFill`, or `undefined` when
 * it has none.
 *
 * The OOXML angle is clockwise from +x with y pointing down, which is also the
 * SVG convention, so sin/cos map straight onto the axis endpoints.
 */
function resolveGradient(
	shape: PptxSmartArtDrawingShape,
	id: string,
): RenderedGradient | undefined {
	const stops = shape.fillGradientStops;
	if (!stops || stops.length === 0) {
		return undefined;
	}
	const mapped: RenderedGradientStop[] = stops.map((stop) => ({
		offset: `${Math.max(0, Math.min(100, stop.position))}%`,
		color: stop.color,
		...(stop.opacity !== undefined ? { opacity: stop.opacity } : {}),
	}));
	if (shape.fillGradientType === 'radial') {
		return { id, kind: 'radial', cx: '50%', cy: '50%', r: '50%', stops: mapped };
	}
	const radians = ((shape.fillGradientAngle ?? 0) * Math.PI) / 180;
	const dx = Math.cos(radians) / 2;
	const dy = Math.sin(radians) / 2;
	return {
		id,
		kind: 'linear',
		x1: `${(0.5 - dx) * 100}%`,
		y1: `${(0.5 - dy) * 100}%`,
		x2: `${(0.5 + dx) * 100}%`,
		y2: `${(0.5 + dy) * 100}%`,
		stops: mapped,
	};
}

/** Which primitive paints this shape's body, from its preset type. */
function resolveShapeKind(shape: PptxSmartArtDrawingShape, hasImage: boolean): RenderedShapeKind {
	if (hasImage) {
		return 'image';
	}
	// `getShapeType` folds the aliases it knows (oval -> ellipse, can -> cylinder)
	// but has no vocabulary for the arrow presets SmartArt process layouts use, so
	// those are matched on the normalised raw type.
	const normalized = (shape.shapeType ?? '').trim().toLowerCase();
	if (normalized === 'chevron' || normalized === 'homeplate') {
		return 'polygon';
	}
	return getShapeType(shape.shapeType) === 'ellipse' ? 'ellipse' : 'rect';
}

/**
 * Project raw `PptxSmartArtDrawingShape`s into `RenderedShape` view-models,
 * rebasing positions relative to the viewBox origin.
 */
export function projectDrawingShapes(
	elementId: string,
	shapes: PptxSmartArtDrawingShape[],
	viewBox: DrawingViewBox,
	palette: string[],
	style: SmartArtStyle,
): RenderedShape[] {
	const { minX, minY } = viewBox;
	const sw = styleStroke(style);

	return shapes.map((shape, i): RenderedShape => {
		const gradient = shape.fillNone
			? undefined
			: resolveGradient(shape, `${elementId}-dspgrad-${shape.id}-${i}`);
		// Precedence: authored transparency, then gradient, then a pattern's
		// foreground (the closest flat stand-in for one), then solid, then palette.
		const fill = shape.fillNone
			? 'none'
			: gradient
				? `url(#${gradient.id})`
				: (shape.fillPatternForegroundColor ?? shape.fillColor ?? paletteColour(i, palette));
		const relX = shape.x - minX;
		const relY = shape.y - minY;
		const kind = resolveShapeKind(shape, Boolean(shape.fillImageUrl));
		const rx =
			getShapeType(shape.shapeType) === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
		const cx = relX + shape.width / 2;
		const cy = relY + shape.height / 2;
		const stroke = shape.strokeColor ?? (sw > 0 ? 'rgba(255,255,255,0.3)' : 'none');
		const transform =
			shape.rotation !== undefined ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;
		const fontSize = shape.fontSize ?? Math.max(8, Math.min(14, shape.height * 0.2));

		return {
			key: `${elementId}-dsp-${shape.id}-${i}`,
			kind,
			...(kind === 'polygon'
				? { points: chevronPoints(relX, relY, shape.width, shape.height) }
				: {}),
			...(gradient ? { gradient } : {}),
			x: relX,
			y: relY,
			width: shape.width,
			height: shape.height,
			rx,
			cx,
			cy,
			fill,
			stroke,
			strokeWidth: shape.strokeWidth ?? sw,
			transform,
			imageUrl: shape.fillImageUrl,
			textLines: shape.text
				? centeredSvgTextLines(shape.text, fontSize, {
						maxWidth: shape.width * TEXT_WIDTH_FRACTION,
						centerY: cy,
					})
				: [],
			textX: cx,
			textY: cy,
			fontColor: shape.fontColor ?? drawingShapeLabelColor(shape, shapes, i, fill),
			fontSize,
		};
	});
}

/** Drop-shadow filter string for the given style intensity. */
export function styleShadowFilter(style: SmartArtStyle): string | undefined {
	return styleShadow(style);
}
