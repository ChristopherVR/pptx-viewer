/**
 * Stroked SVG OUTLINES: gradient/pattern lines (`a:ln/a:gradFill`,
 * `a:ln/a:pattFill`), stroke-only ("open") preset geometry, and centred
 * (`a:ln/@algn="ctr"`) solid lines.
 *
 * Every binding paints a shape's outline as a CSS `border`, which can only take
 * a single flat colour, can only outline a BOX, and - because `box-sizing:
 * border-box` puts the whole border INSIDE the element's declared box - can only
 * express `a:ln/@algn="in"`. That breaks three ways:
 *
 *  - A gradient outline was rendered with the parser's averaged `strokeColor`
 *    (two-tone came out flat, fade-to-transparent came out opaque), and a
 *    patterned outline with the pattern's foreground alone, so the hatching
 *    disappeared entirely.
 *  - An open preset (`<a:prstGeom prst="line"/>`, the connector family, `arc`,
 *    …) has no region to fill and no box to outline, so a CSS border drew a
 *    RECTANGLE where PowerPoint draws a line or an arc. See
 *    `./stroke-only-preset`.
 *  - `@algn="ctr"` is PowerPoint's DEFAULT (an omitted `@algn` means `ctr`, not
 *    `in`): the line straddles the shape's path, half outside the box and half
 *    over the fill. A `border-box` CSS border cannot straddle anything - it can
 *    only sit flush with the box edge - so every bordered shape at the default
 *    alignment rendered `strokeWidth / 2` too small on each edge. An SVG
 *    `<path>` stroke is centred on the path by definition, so routing the
 *    default-aligned case through this same overlay is the fix; `@algn="in"`
 *    keeps the cheap `border-box` CSS border, which is already exactly right.
 *
 * CSS has no way to fix any of these in place - `border-image` ignores
 * `border-radius` and cannot follow a `clip-path`, and no CSS property centres a
 * border on the box edge - so the outline is instead stroked as a real SVG path
 * laid over the element, using the shape's own resolved geometry. This module
 * turns an element into everything a binding needs for that overlay; the
 * bindings supply only the ~10 lines of view layer.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE, getShapeType, hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from '../constants';
import { getCompoundLineOffsets, getCompoundLineWidths, svgLineCap } from './connector-style';
import { getSvgStrokeDasharray, normalizeStrokeDashType } from './element-style-transform';
import { colorWithOpacity } from './fill-style';
import { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './shape-geometry';
import { strokeOnlyPresetPathData } from './stroke-only-preset';
import { hasStrokePaint } from './stroke-paint';
import {
	buildSvgStrokeGradientDef,
	buildSvgStrokePatternDef,
	svgGradientFillRef,
} from './svg-gradient-paint';
import type { SvgGradientDef, SvgPatternDef } from './svg-gradient-paint';

/**
 * Width PowerPoint paints an open preset with when the shape declares no line
 * width at all. Matches the connector renderers, which have always defaulted a
 * width-less line to 2px rather than painting nothing.
 */
const DEFAULT_OPEN_PRESET_STROKE_WIDTH = 2;

/** The paint server an outline is stroked with: a gradient or a pattern. */
export type StrokeOutlinePaint = SvgGradientDef | SvgPatternDef;

/**
 * One parallel stroke of a compound (`a:ln/@cmpd`) line: its width, and its
 * perpendicular offset from the centre line in element px. A single line is one
 * strand at offset `0`.
 */
export interface StrokeOutlineStrand {
	strokeWidth: number;
	offset: number;
}

/** Everything needed to stroke one shape's outline as an SVG overlay. */
export interface StrokeOutline {
	/** Path data in the element's own pixel space (viewBox `0 0 width height`). */
	d: string;
	/**
	 * Paint server to define in `<defs>`, or `undefined` when the outline is
	 * stroked with a flat colour (an open preset with an ordinary solid line).
	 */
	paint: StrokeOutlinePaint | undefined;
	/** Ready-to-use SVG `stroke` value: `url(#…)` for a paint server, else a colour. */
	stroke: string;
	strokeWidth: number;
	/** Parallel strands to emit; one entry unless the line is compound. */
	strands: readonly StrokeOutlineStrand[];
	/** SVG `stroke-dasharray`, or `undefined` for a solid line. */
	dashArray: string | undefined;
	lineCap: 'butt' | 'round' | 'square';
	lineJoin: 'round' | 'bevel' | 'miter';
}

/** Narrowing helper for bindings, whose templates cannot narrow a union inline. */
export function isPatternPaint(paint: StrokeOutlinePaint | undefined): paint is SvgPatternDef {
	return paint?.kind === 'pattern';
}

/**
 * Convert a CSS `clip-path` value into path data in element pixel space.
 *
 * `getResolvedShapeClipPath` already returns `path('…')` for every preset the
 * ECMA evaluator covers (including `ellipse`, which the bindings otherwise paint
 * with `border-radius`), so that is the common case. `polygon()` from the static
 * table is converted point by point; anything else - `inset()`, or no clip at
 * all - falls back to the element's rectangle.
 */
export function outlinePathData(
	clipPath: string | undefined,
	width: number,
	height: number,
): string | undefined {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined;
	}
	const rect = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
	if (!clipPath) {
		return rect;
	}
	const asPath = /^path\('(.*)'\)$/su.exec(clipPath.trim());
	if (asPath) {
		return asPath[1];
	}
	const asPolygon = /^polygon\((.*)\)$/su.exec(clipPath.trim());
	if (asPolygon) {
		const points = asPolygon[1]
			.split(',')
			.map((pair) => pair.trim().split(/\s+/u))
			.filter((parts) => parts.length === 2)
			.map(([rawX, rawY]) => {
				const toPx = (token: string, extent: number): number =>
					token.endsWith('%')
						? (Number.parseFloat(token) / 100) * extent
						: Number.parseFloat(token);
				return [toPx(rawX, width), toPx(rawY, height)];
			})
			.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
		if (points.length < 3) {
			return rect;
		}
		const [first, ...rest] = points;
		return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`;
	}
	return rect;
}

const WEDGE_CALLOUT_PRESET_NAMES = new Set([
	'wedgerectcallout',
	'wedgeroundrectcallout',
	'wedgeellipsecallout',
]);

/** Whether a preset's pointer is part of the authored outline and may extend outside its body box. */
export function isWedgeCalloutPresetShape(shapeType?: string): boolean {
	return typeof shapeType === 'string' && WEDGE_CALLOUT_PRESET_NAMES.has(shapeType.toLowerCase());
}

export interface PresetShapeVectorGeometry {
	d: string;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	viewWidth: number;
	viewHeight: number;
}

function clipPathPolygonPoints(
	clipPath: string,
	width: number,
	height: number,
): Array<[number, number]> {
	const asPolygon = /^polygon\((.*)\)$/su.exec(clipPath.trim());
	if (!asPolygon) {
		return [];
	}
	const toPx = (token: string, extent: number): number =>
		token.endsWith('%') ? (Number.parseFloat(token) / 100) * extent : Number.parseFloat(token);
	return asPolygon[1]
		.split(',')
		.map((pair) => pair.trim().split(/\s+/u))
		.filter((parts) => parts.length === 2)
		.map(([rawX, rawY]) => [toPx(rawX, width), toPx(rawY, height)] as [number, number])
		.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

/** Resolve a preset outline into SVG path data plus any authored out-of-box bounds. */
export function getPresetShapeVectorGeometry(
	shapeType: string | undefined,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): PresetShapeVectorGeometry | undefined {
	const normalizedWidth = Math.max(Number.isFinite(width) ? width : 0, 1);
	const normalizedHeight = Math.max(Number.isFinite(height) ? height : 0, 1);
	const clipPath = getResolvedShapeClipPathFor(
		shapeType,
		normalizedWidth,
		normalizedHeight,
		adjustments,
	);
	const d = outlinePathData(clipPath, normalizedWidth, normalizedHeight);
	if (!d) {
		return undefined;
	}
	let minX = 0;
	let minY = 0;
	let maxX = normalizedWidth;
	let maxY = normalizedHeight;
	for (const [x, y] of clipPath
		? clipPathPolygonPoints(clipPath, normalizedWidth, normalizedHeight)
		: []) {
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	return {
		d,
		minX,
		minY,
		maxX,
		maxY,
		viewWidth: Math.max(maxX - minX, 1),
		viewHeight: Math.max(maxY - minY, 1),
	};
}

/**
 * The parallel strands a line is painted with. A single (`sng`) line keeps the
 * outline's own width verbatim so the ordinary case is byte-identical to a
 * one-`<path>` overlay; a compound line spreads into the offsets/widths every
 * connector renderer already uses.
 */
function outlineStrands(
	compoundLine: string | undefined,
	strokeWidth: number,
): StrokeOutlineStrand[] {
	const offsets = getCompoundLineOffsets(compoundLine, strokeWidth);
	if (offsets.length <= 1) {
		return [{ strokeWidth, offset: 0 }];
	}
	const widths = getCompoundLineWidths(compoundLine, strokeWidth);
	return offsets.map((offset, idx) => ({ strokeWidth: widths[idx] ?? strokeWidth, offset }));
}

/**
 * Whether a closed shape's flat, solid line needs the SVG overlay because its
 * alignment is centred (`ctr`, PowerPoint's default when `a:ln/@algn` is
 * omitted) rather than inset (`in`).
 *
 * Excluded even when centred:
 *  - Connectors: their line is painted entirely by the dedicated connector
 *    renderer (arrows, hit-target, compound strands), never by this overlay.
 *  - The `line` preset: it is normally stroke-only (routed through
 *    `openPresetD` above) and only reaches here when the evaluator fails to
 *    open it, in which case `getResolvedShapeClipPath` fails identically and
 *    `outlinePathData` would fall back to a full rectangle - worse than the
 *    single-edge `lineEdge` CSS approximation the binding falls back to.
 *  - A width-only, fill-less line (see `hasStrokePaint`): PowerPoint paints no
 *    outline for it at all, so this overlay must not invent one from
 *    `DEFAULT_STROKE_COLOR` either. This is the same picture-frame case
 *    `getComputedStrokeStyle` already excludes from the CSS border; missing it
 *    here reintroduced the bug through the overlay instead, painting every
 *    frameless picture in the real-world media deck with a dark 1px frame.
 */
function needsCenteredStrokeOverlay(
	element: PptxElement,
	style: ShapeStyle | undefined,
	declaredWidth: number,
): boolean {
	if (!style || declaredWidth <= 0 || element.type === 'connector' || !hasStrokePaint(style)) {
		return false;
	}
	const shapeType = getShapeType((element as { shapeType?: string }).shapeType);
	if (shapeType === 'line') {
		return false;
	}
	return style.lineAlignment !== 'in';
}

/**
 * Resolve the SVG overlay that paints an element's outline, or `undefined` when
 * the binding's CSS border is correct and cheaper (a closed shape whose line is
 * explicitly inset, `a:ln/@algn="in"`).
 *
 * Three things need the overlay: a gradient/pattern line, which a CSS border
 * cannot express; a stroke-only preset, which has no box to put a border on;
 * and a centred (`ctr`, the default) solid line, which a `border-box` CSS
 * border cannot straddle. The last two are painted with a flat colour, so
 * `paint` is `undefined` there and `stroke` carries the colour instead.
 */
export function buildStrokeOutline(element: PptxElement): StrokeOutline | undefined {
	if (!hasShapeProperties(element)) {
		return undefined;
	}
	const style: ShapeStyle | undefined = element.shapeStyle;
	const declaredWidth = Math.max(0, style?.strokeWidth ?? 0);
	// An open preset is painted by this overlay even when the shape declares no
	// line width, because a stroke is the ONLY thing it paints; a closed shape
	// with no line simply has no outline.
	const openPresetD = strokeOnlyPresetPathData(element);
	if (!openPresetD && (!style || declaredWidth <= 0)) {
		return undefined;
	}
	const paint: StrokeOutlinePaint | undefined =
		style && declaredWidth > 0
			? (buildSvgStrokeGradientDef(style, element.id) ??
				buildSvgStrokePatternDef(style, element.id))
			: undefined;
	const centeredFlatStroke =
		!paint && !openPresetD && needsCenteredStrokeOverlay(element, style, declaredWidth);
	if (!paint && !openPresetD && !centeredFlatStroke) {
		return undefined;
	}
	const d =
		openPresetD ??
		outlinePathData(getResolvedShapeClipPath(element), element.width, element.height);
	if (!d) {
		return undefined;
	}
	const strokeWidth = declaredWidth > 0 ? declaredWidth : DEFAULT_OPEN_PRESET_STROKE_WIDTH;
	return {
		d,
		paint,
		stroke: paint
			? svgGradientFillRef(paint)
			: colorWithOpacity(style?.strokeColor ?? DEFAULT_STROKE_COLOR, style?.strokeOpacity),
		strokeWidth,
		strands: outlineStrands(style?.compoundLine, strokeWidth),
		dashArray: getSvgStrokeDasharray(
			normalizeStrokeDashType(style?.strokeDash),
			Math.max(strokeWidth, 1),
			style?.customDashSegments,
		),
		lineCap: svgLineCap(style?.lineCap),
		lineJoin:
			style?.lineJoin === 'bevel' ? 'bevel' : style?.lineJoin === 'miter' ? 'miter' : 'round',
	};
}

/**
 * The `viewBox` a binding must give the outline overlay: the element's PAINTED
 * box, which is padded out to {@link MIN_ELEMENT_SIZE} for degenerate shapes
 * (see shared `getContainerStyle`).
 *
 * Matching the viewBox to the painted box rather than to the authored extent
 * keeps the user-space mapping 1:1 under `preserveAspectRatio="none"`. A
 * 1-EMU-tall horizontal rule authored as `viewBox="0 0 700 1"` and stretched
 * across the 12px-tall padded box would otherwise be scaled 12x vertically and
 * come out as a diagonal; with the padded viewBox the geometry stays where it
 * was authored and the padding hangs off the bottom/right.
 */
export function strokeOutlineViewBox(element: PptxElement): string {
	const width = Math.max(element.width, MIN_ELEMENT_SIZE);
	const height = Math.max(element.height, MIN_ELEMENT_SIZE);
	return `0 0 ${width} ${height}`;
}

/**
 * Whether a binding should suppress its CSS border for this element because the
 * stroke overlay is painting the outline instead. Keeping both would draw the
 * averaged solid (or the pattern's bare foreground) underneath a gradient line,
 * and would box a stroke-only preset inside the rectangle it does not have.
 */
export function suppressesCssBorder(element: PptxElement): boolean {
	return buildStrokeOutline(element) !== undefined;
}
