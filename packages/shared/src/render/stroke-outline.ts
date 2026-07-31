/**
 * Gradient and pattern OUTLINES (`a:ln/a:gradFill`, `a:ln/a:pattFill`).
 *
 * Every binding paints a shape's outline as a CSS `border`, which can only take
 * a single flat colour. A gradient outline was therefore rendered with the
 * parser's averaged `strokeColor` (two-tone came out flat, fade-to-transparent
 * came out opaque), and a patterned outline with the pattern's foreground alone,
 * so the hatching disappeared entirely.
 *
 * CSS has no way to fix either in place - `border-image` ignores `border-radius`
 * and cannot follow a `clip-path` - so the outline is instead stroked as a real
 * SVG path laid over the element, using the shape's own resolved geometry. This
 * module turns an element into everything a binding needs for that overlay; the
 * bindings supply only the ~10 lines of view layer.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { svgLineCap } from './connector-style';
import { getSvgStrokeDasharray, normalizeStrokeDashType } from './element-style-transform';
import { getResolvedShapeClipPath } from './shape-geometry';
import { buildSvgStrokeGradientDef, buildSvgStrokePatternDef } from './svg-gradient-paint';
import type { SvgGradientDef, SvgPatternDef } from './svg-gradient-paint';

/** The paint server an outline is stroked with: a gradient or a pattern. */
export type StrokeOutlinePaint = SvgGradientDef | SvgPatternDef;

/** Everything needed to stroke one shape's outline as an SVG overlay. */
export interface StrokeOutline {
	/** Path data in the element's own pixel space (viewBox `0 0 width height`). */
	d: string;
	/** Paint server to define in `<defs>` and reference from the path's `stroke`. */
	paint: StrokeOutlinePaint;
	strokeWidth: number;
	/** SVG `stroke-dasharray`, or `undefined` for a solid line. */
	dashArray: string | undefined;
	lineCap: 'butt' | 'round' | 'square';
	lineJoin: 'round' | 'bevel' | 'miter';
}

/** Narrowing helper for bindings, whose templates cannot narrow a union inline. */
export function isPatternPaint(paint: StrokeOutlinePaint): paint is SvgPatternDef {
	return paint.kind === 'pattern';
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

/**
 * Resolve the SVG overlay that paints an element's gradient or pattern outline,
 * or `undefined` when the element has neither (the ordinary case, where the
 * binding's CSS border is correct and cheaper).
 */
export function buildStrokeOutline(element: PptxElement): StrokeOutline | undefined {
	if (!hasShapeProperties(element)) {
		return undefined;
	}
	const style: ShapeStyle | undefined = element.shapeStyle;
	const strokeWidth = Math.max(0, style?.strokeWidth ?? 0);
	if (!style || strokeWidth <= 0) {
		return undefined;
	}
	const paint: StrokeOutlinePaint | undefined =
		buildSvgStrokeGradientDef(style, element.id) ?? buildSvgStrokePatternDef(style, element.id);
	if (!paint) {
		return undefined;
	}
	const d = outlinePathData(getResolvedShapeClipPath(element), element.width, element.height);
	if (!d) {
		return undefined;
	}
	return {
		d,
		paint,
		strokeWidth,
		dashArray: getSvgStrokeDasharray(
			normalizeStrokeDashType(style.strokeDash),
			Math.max(strokeWidth, 1),
			style.customDashSegments,
		),
		lineCap: svgLineCap(style.lineCap),
		lineJoin: style.lineJoin === 'bevel' ? 'bevel' : style.lineJoin === 'miter' ? 'miter' : 'round',
	};
}

/**
 * Whether a binding should suppress its CSS border for this element because the
 * stroke overlay is painting the outline instead. Keeping both would draw the
 * averaged solid (or the pattern's bare foreground) underneath.
 */
export function suppressesCssBorder(element: PptxElement): boolean {
	return buildStrokeOutline(element) !== undefined;
}
