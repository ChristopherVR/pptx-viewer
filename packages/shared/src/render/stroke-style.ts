/**
 * The CSS a shape's OUTLINE (`a:ln`) is painted with, as one neutral decision.
 *
 * Every binding ended up writing its own two-line version of this
 * (`border: <width> <dash> <colour>`), and each of those copies dropped a
 * different part of `a:ln`:
 *
 *  - `@cmpd` (double / thickThin / thinThick / tri) reached only React and
 *    Angular, because only they passed the compound type to
 *    {@link getCssBorderDashStyle}. Vue, Svelte and Vanilla painted every
 *    compound outline as one solid line.
 *  - `a:miter/@lim` reached only React, which wrote `stroke-miterlimit` on the
 *    shape container. That property is an INHERITED SVG presentation property,
 *    so writing it on the container is what makes both the freeform `<path>` and
 *    the stroke overlay honour it - no per-overlay wiring needed.
 *  - `strokeOpacity` was applied by React and dropped by Svelte.
 *
 * So the outline is resolved here once and each binding only maps the result
 * onto its own style object. One thing deliberately stays OUT: suppressing the
 * border for an element the binding paints as an SVG `<path>` of its own
 * (React's freeform `renderVectorShape`) is a view-layer fact, not a property of
 * the OOXML, so it stays in the binding.
 *
 * @module render/stroke-style
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from '../constants';
import type { CssBorderStyle } from './element-style-transform';
import { getCssBorderDashStyle, normalizeStrokeDashType } from './element-style-transform';
import { colorWithOpacity, normalizeHexColor } from './fill-style';
import { suppressesCssBorder } from './stroke-outline';
import { paintedStrokeWidth } from './stroke-paint';

/** SVG `stroke-linejoin` values, as `a:ln/a:round|a:bevel|a:miter` map onto them. */
export type SvgStrokeLineJoin = 'miter' | 'round' | 'bevel';
/** SVG `stroke-linecap` values, as `a:ln/@cap` maps onto them. */
export type SvgStrokeLineCap = 'butt' | 'round' | 'square';

/** The resolved CSS outline of a shape. See {@link getComputedStrokeStyle}. */
export interface ComputedStrokeStyle {
	/**
	 * `border-width` in px. `0` means "paint no CSS border": either the shape has
	 * no painted line at all, or the stroke overlay
	 * ({@link suppressesCssBorder}) is painting the outline instead.
	 *
	 * A compound line keeps the full authored width, which `border-style: double`
	 * then divides between its strands and the gap.
	 */
	readonly borderWidth: number;
	/** `border-style`, or `undefined` when nothing is painted. */
	readonly borderStyle: CssBorderStyle | undefined;
	/** `border-color` (already carrying `strokeOpacity`), or `undefined`. */
	readonly borderColor: string | undefined;
	/**
	 * The three above as a `border` shorthand, for bindings that write one
	 * property. `undefined` when nothing is painted.
	 */
	readonly border: string | undefined;
	/** `stroke-linejoin` (inherited into descendant SVG), from `a:ln`'s join. */
	readonly strokeLinejoin: SvgStrokeLineJoin | undefined;
	/** `stroke-linecap` (inherited into descendant SVG), from `a:ln/@cap`. */
	readonly strokeLinecap: SvgStrokeLineCap | undefined;
	/**
	 * `stroke-miterlimit` from `a:miter/@lim`, as a plain ratio. Inherited, so
	 * writing it on the shape container reaches the freeform path AND the stroke
	 * overlay without either of them restating it.
	 */
	readonly strokeMiterlimit: number | undefined;
}

/** Nothing painted: the shared "no outline" answer. */
const NO_STROKE: ComputedStrokeStyle = {
	borderWidth: 0,
	borderStyle: undefined,
	borderColor: undefined,
	border: undefined,
	strokeLinejoin: undefined,
	strokeLinecap: undefined,
	strokeMiterlimit: undefined,
};

/** Map `a:ln`'s join child onto an SVG `stroke-linejoin`. */
function svgLineJoin(join: ShapeStyle['lineJoin']): SvgStrokeLineJoin | undefined {
	switch (join) {
		case 'round':
			return 'round';
		case 'bevel':
			return 'bevel';
		case 'miter':
			return 'miter';
		default:
			return undefined;
	}
}

/** Map `a:ln/@cap` onto an SVG `stroke-linecap`. */
function svgStrokeLineCap(cap: ShapeStyle['lineCap']): SvgStrokeLineCap | undefined {
	switch (cap) {
		case 'rnd':
			return 'round';
		case 'sq':
			return 'square';
		case 'flat':
			return 'butt';
		default:
			return undefined;
	}
}

/**
 * `a:miter/@lim` as an SVG `stroke-miterlimit`.
 *
 * ECMA-376 types `@lim` as `ST_PositivePercentage`, i.e. 1000ths of a percent
 * (`800000` = 800% = a ratio of 8). SVG's `stroke-miterlimit` is that same ratio
 * and must be >= 1, so the value is clamped rather than emitted invalid. Only
 * meaningful for a mitred join, which is why it is gated on one.
 */
function strokeMiterLimit(style: ShapeStyle | undefined): number | undefined {
	if (style?.lineJoin !== 'miter' || typeof style.miterLimit !== 'number') {
		return undefined;
	}
	if (!Number.isFinite(style.miterLimit)) {
		return undefined;
	}
	return Math.max(style.miterLimit / 100000, 1);
}

/**
 * Resolve the CSS outline of a shape-like element.
 *
 * @param element - The element whose `a:ln` is being painted.
 * @returns A neutral descriptor; `borderWidth === 0` when no CSS border applies.
 */
export function getComputedStrokeStyle(element: PptxElement): ComputedStrokeStyle {
	if (!hasShapeProperties(element)) {
		return NO_STROKE;
	}
	const style = element.shapeStyle;
	// A width-only, fill-less `<a:ln>` paints NO outline (see stroke-paint), and
	// a gradient/pattern line or an open preset is painted by the stroke overlay
	// instead - keeping the border too would draw the parser's averaged solid
	// underneath it, or box an open preset inside a rectangle it does not have.
	const width = suppressesCssBorder(element) ? 0 : paintedStrokeWidth(style);
	const joins = {
		strokeLinejoin: svgLineJoin(style?.lineJoin),
		strokeLinecap: svgStrokeLineCap(style?.lineCap),
		strokeMiterlimit: strokeMiterLimit(style),
	} as const;
	if (width <= 0 || !style) {
		return { ...NO_STROKE, ...joins };
	}

	const borderWidth = width;
	const borderStyle = getCssBorderDashStyle(
		normalizeStrokeDashType(style.strokeDash),
		style.compoundLine,
	);
	// The colour is passed through as authored unless an alpha has to be folded
	// into it: `colorWithOpacity` can only build an `rgba()` from a 6-digit hex,
	// so that path (and only that path) normalises first. Normalising
	// unconditionally would rewrite a legal short form like `#000` into the
	// default stroke colour, which is what React used to do.
	const rawColor = style.strokeColor ?? DEFAULT_STROKE_COLOR;
	const borderColor =
		style.strokeOpacity === undefined
			? rawColor
			: colorWithOpacity(normalizeHexColor(rawColor, DEFAULT_STROKE_COLOR), style.strokeOpacity);
	return {
		borderWidth,
		borderStyle,
		borderColor,
		border: `${borderWidth}px ${borderStyle ?? 'solid'} ${borderColor}`,
		...joins,
	};
}
