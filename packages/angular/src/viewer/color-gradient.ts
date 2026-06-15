/**
 * Gradient fill CSS builder — pure TypeScript, no Angular dependency.
 *
 * Ported from `packages/react/src/viewer/utils/color-gradient.ts`.
 *
 * Handles sanitization of gradient stop arrays and conversion to CSS gradient
 * strings. Gradient rendering follows ECMA-376 Part 1, §20.1.8.35 (gradFill)
 * and §20.1.8.49 (pathFill). The three path types — circle, rect, shape — each
 * have dedicated builders that approximate the OOXML behaviour as closely as
 * CSS radial-gradient permits.
 *
 * Pattern fill (`a:pattFill`) is intentionally NOT included here — it lives in
 * a separate module.
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import { DEFAULT_FILL_COLOR } from './constants';
import { colorWithOpacity, normalizeHexColor } from './visual-effects';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value to the [0, 1] range. */
function clampUnitInterval(value: number): number {
	return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates, normalizes, and sorts an array of gradient stops.
 * Filters out invalid entries (missing color/position), clamps positions
 * to 0-100, normalizes colors, and sorts by ascending position.
 *
 * @param stops - Raw gradient stop array from shape style.
 * @returns A sanitized, sorted array of gradient stops.
 */
export function sanitizeGradientStops(
	stops: ShapeStyle['fillGradientStops'] | undefined,
): NonNullable<ShapeStyle['fillGradientStops']> {
	if (!stops || stops.length === 0) {
		return [];
	}
	return stops
		.filter(
			(stop) =>
				typeof stop?.color === 'string' &&
				String(stop.color).trim().length > 0 &&
				typeof stop?.position === 'number' &&
				Number.isFinite(stop.position),
		)
		.map((stop) => ({
			color: normalizeHexColor(String(stop.color), DEFAULT_FILL_COLOR),
			position: Math.max(0, Math.min(100, stop.position)),
			opacity:
				typeof stop.opacity === 'number' && Number.isFinite(stop.opacity)
					? clampUnitInterval(stop.opacity)
					: undefined,
		}))
		.sort((left, right) => left.position - right.position);
}

/**
 * Converts an OOXML gradient angle (in 60000ths of a degree) to a CSS
 * linear-gradient angle in degrees. OOXML measures clockwise from the
 * left-to-right axis; CSS `linear-gradient` measures clockwise from "to top"
 * (i.e. 0deg = bottom-to-top, 90deg = left-to-right).
 *
 * Conversion: `cssAngle = ooxmlAngle / 60000 + 90`  (then normalised to 0-360).
 *
 * If the input is already in plain degrees (typically from the parser, which
 * pre-converts), this function still normalises and rounds the value.
 *
 * @param ooxmlAngle - Angle in 60000ths of a degree, or plain degrees if
 *                     already converted by the parser.
 * @param alreadyDegrees - When true, the input is treated as plain degrees.
 * @returns A CSS-compatible angle in degrees (0-360), rounded to 1 decimal.
 */
export function convertOoxmlAngleToCss(ooxmlAngle: number, alreadyDegrees = true): number {
	const deg = alreadyDegrees ? ooxmlAngle : ooxmlAngle / 60000;
	// Normalise to 0-360 range
	return ((deg % 360) + 360) % 360;
}

/**
 * Converts a single gradient stop to a CSS gradient color-stop string.
 * Applies opacity via `rgba()` if specified. Uses fractional percentage
 * positioning (1 decimal place) for higher fidelity when stops are close
 * together.
 *
 * @param stop - A gradient stop with color, position (0-100), and optional opacity.
 * @returns A CSS string like `"#FF0000 50%"` or `"rgba(255,0,0,0.5) 33.3%"`.
 */
export function toCssGradientStop(stop: {
	color: string;
	position: number;
	opacity?: number;
}): string {
	const color =
		typeof stop.opacity === 'number' ? colorWithOpacity(stop.color, stop.opacity) : stop.color;
	const pos = Math.max(0, Math.min(100, stop.position));
	// Use integer percentage when it would be exact; use 1 decimal otherwise
	// to preserve stop precision for multi-stop gradients.
	const posStr = pos === Math.round(pos) ? `${pos}%` : `${pos.toFixed(1)}%`;
	return `${color} ${posStr}`;
}

/**
 * Computes the gradient center position (as percentages) from a fillToRect
 * and an optional focalPoint offset. The fillToRect defines an inner
 * rectangle; the gradient center defaults to the center of that rectangle.
 * When a focalPoint is also provided, it offsets the center within the
 * fillToRect bounds.
 *
 * @param fillToRect - LTRB fractions (0-1) defining the inner rectangle.
 * @param focalPoint - Optional focal point offset (0-1 fractions).
 * @returns `{ cx, cy }` as percentages (0-100).
 */
export function computeGradientCenter(
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
): { cx: number; cy: number } {
	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		// Base center is midpoint of the inner rectangle
		let cx = ((l + (1 - r)) / 2) * 100;
		let cy = ((t + (1 - b)) / 2) * 100;

		// When a focal point is also provided, blend it into the center.
		// The focal point (0-1) acts as a position within the shape, so we
		// interpolate between the fillToRect center and the focal point.
		if (focalPoint) {
			const fpX = focalPoint.x * 100;
			const fpY = focalPoint.y * 100;
			// Use the focal point to shift the center — average the two
			// to avoid extreme shifts while still honouring the offset.
			cx = (cx + fpX) / 2;
			cy = (cy + fpY) / 2;
		}

		return { cx, cy };
	}

	// No fillToRect: use focal point directly, or default to center (50%)
	if (focalPoint) {
		return { cx: focalPoint.x * 100, cy: focalPoint.y * 100 };
	}
	return { cx: 50, cy: 50 };
}

/**
 * Builds a CSS radial-gradient for `path="circle"` gradients.
 *
 * OOXML `path="circle"` defines a circular radial gradient. The gradient
 * radiates as a circle from the focal point. When a fillToRect is provided,
 * the gradient center is derived from the fillToRect center, optionally
 * offset by the focalPoint. The circle radius is sized to reach the
 * farthest edge of the shape.
 *
 * @param stops - Sanitized gradient stops.
 * @param focalPoint - Optional focal point (0-1 fractions).
 * @param fillToRect - Optional fillToRect LTRB insets (0-1 fractions).
 * @returns A CSS `radial-gradient(circle ...)` string.
 */
export function buildCirclePathGradient(
	stops: NonNullable<ShapeStyle['fillGradientStops']>,
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');
	const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

	// Format position — use 'center' only when both axes are exactly 50%
	// and no explicit positioning was requested
	const posX =
		Math.round(cx) === 50 && !focalPoint && !fillToRect ? 'center' : `${Math.round(cx)}%`;
	const posY =
		Math.round(cy) === 50 && !focalPoint && !fillToRect ? 'center' : `${Math.round(cy)}%`;

	if (fillToRect) {
		// Compute the radius as the farthest distance from center to shape edge
		const radius = Math.max(cx, 100 - cx, cy, 100 - cy);
		return `radial-gradient(circle ${Math.round(radius)}% at ${posX} ${posY}, ${stopStr})`;
	}

	return `radial-gradient(circle at ${posX} ${posY}, ${stopStr})`;
}

/**
 * Builds a CSS radial-gradient for `path="rect"` gradients.
 *
 * OOXML `path="rect"` defines a rectangular gradient that radiates from the
 * fillToRect rectangle outward to the shape edges. Approximated with a CSS
 * `radial-gradient(ellipse ...)` where the ellipse size and center are
 * derived from the fillToRect LTRB inset values.
 *
 * The fillToRect values (l, t, r, b) define the inner rectangle:
 * - left edge at `l` fraction from left
 * - top edge at `t` fraction from top
 * - right edge at `1-r` fraction from left
 * - bottom edge at `1-b` fraction from top
 */
export function buildRectPathGradient(
	stops: NonNullable<ShapeStyle['fillGradientStops']>,
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');

	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

		// The gradient extends from the fillToRect edges to the shape boundary.
		// The ellipse semi-axis = max distance from center to shape edge.
		const semiX = Math.max(cx, 100 - cx);
		const semiY = Math.max(cy, 100 - cy);

		const posX = `${Math.round(cx)}%`;
		const posY = `${Math.round(cy)}%`;

		// When the fillToRect defines a non-degenerate inner rectangle, compute
		// the inner rectangle's half-dimensions so we can size the ellipse to
		// match more closely. This produces a better rectangular gradient feel.
		const innerHalfW = ((1 - l - r) / 2) * 100;
		const innerHalfH = ((1 - t - b) / 2) * 100;

		// If the inner rect has meaningful dimensions and is asymmetric relative
		// to the shape, use its aspect ratio to scale the ellipse radii.
		if (innerHalfW > 0.5 && innerHalfH > 0.5 && Math.abs(semiX - semiY) > 1) {
			// Scale radii proportionally to inner rectangle aspect ratio
			const aspect = innerHalfW / innerHalfH;
			const adjustedSemiX = Math.round(semiY * aspect);
			const adjustedSemiY = Math.round(semiY);
			return `radial-gradient(${adjustedSemiX}% ${adjustedSemiY}% at ${posX} ${posY}, ${stopStr})`;
		}

		return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
	}

	// Fallback: use focal point if available, otherwise center
	const posX = focalPoint ? `${Math.round(focalPoint.x * 100)}%` : 'center';
	const posY = focalPoint ? `${Math.round(focalPoint.y * 100)}%` : 'center';
	return `radial-gradient(ellipse at ${posX} ${posY}, ${stopStr})`;
}

/**
 * Builds a CSS gradient approximation for `path="shape"` gradients.
 *
 * OOXML `path="shape"` defines a gradient that follows the shape boundary,
 * radiating inward from the shape edges. This is impossible to replicate
 * perfectly with CSS, so we approximate it with an elliptical radial
 * gradient sized to the bounding box.
 *
 * The approach:
 * 1. When fillToRect is provided, the gradient center is the center of the
 *    inner rectangle (optionally offset by focalPoint). The ellipse radii
 *    are set to the maximum distance from center to each shape edge, so
 *    the gradient fully covers the bounding box.
 * 2. When the fillToRect defines a non-square inner region, explicit
 *    percentage sizing preserves the aspect ratio, better approximating
 *    a gradient that follows the shape boundary.
 * 3. Without fillToRect, `farthest-side` provides a reasonable default
 *    that adapts to the element's aspect ratio.
 */
export function buildShapePathGradient(
	stops: NonNullable<ShapeStyle['fillGradientStops']>,
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');

	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

		const posX = `${Math.round(cx)}%`;
		const posY = `${Math.round(cy)}%`;

		// Compute the ellipse radii that cover the full bounding box from the
		// computed center. This ensures the shape-conforming gradient extends
		// all the way to the edges.
		const semiX = Math.max(cx, 100 - cx);
		const semiY = Math.max(cy, 100 - cy);

		// Compute the inner-rect half-widths as percentages. When both are
		// positive and different, use explicit sizing to preserve the rectangle's
		// aspect ratio — this more closely approximates "follows the shape edge".
		const innerHalfW = ((1 - l - r) / 2) * 100;
		const innerHalfH = ((1 - t - b) / 2) * 100;

		if (innerHalfW > 0.5 && innerHalfH > 0.5 && Math.abs(innerHalfW - innerHalfH) > 1) {
			// Scale the bounding-box radii proportionally to the inner rectangle's
			// aspect ratio for a shape-conforming feel.
			const aspect = innerHalfW / innerHalfH;
			const adjustedSemiX = Math.round(Math.max(semiX, semiY * aspect));
			const adjustedSemiY = Math.round(Math.max(semiY, semiX / aspect));
			return `radial-gradient(${adjustedSemiX}% ${adjustedSemiY}% at ${posX} ${posY}, ${stopStr})`;
		}

		// Degenerate inner rect (zero area) or symmetric: use bounding-box radii
		if (semiX > 0.5 || semiY > 0.5) {
			return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
		}

		// Symmetric or nearly-symmetric: farthest-side is a good fit
		return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
	}

	const { cx, cy } = computeGradientCenter(undefined, focalPoint);
	const posX = focalPoint ? `${Math.round(cx)}%` : 'center';
	const posY = focalPoint ? `${Math.round(cy)}%` : 'center';
	return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
}

/**
 * Builds a complete CSS `linear-gradient()` or `radial-gradient()` string
 * from a ShapeStyle's gradient properties.
 *
 * For radial gradients, the rendering varies by `fillGradientPathType`:
 * - `"circle"` (default): Simple circular radial gradient at the focal point.
 * - `"rect"`: Elliptical radial gradient sized from the fillToRect rectangle,
 *    approximating the OOXML rectangular path gradient.
 * - `"shape"`: Radial gradient using farthest-side sizing, approximating a
 *    gradient that follows the shape boundary.
 *
 * Falls back to `style.fillGradient` if no valid stops are present.
 *
 * @param style - The shape style containing gradient configuration.
 * @returns A CSS gradient string, or `undefined` if not a gradient fill.
 */
export function buildCssGradientFromShapeStyle(style: ShapeStyle | undefined): string | undefined {
	if (!style || style.fillMode !== 'gradient') {
		return undefined;
	}

	const stops = sanitizeGradientStops(style.fillGradientStops);
	if (stops.length === 0) {
		return style.fillGradient;
	}

	const gradientType = style.fillGradientType || 'linear';
	if (gradientType === 'radial') {
		const pathType = style.fillGradientPathType || 'circle';
		const fp = style.fillGradientFocalPoint;
		const ftr = style.fillGradientFillToRect;

		if (pathType === 'rect') {
			return buildRectPathGradient(stops, fp, ftr);
		}

		if (pathType === 'shape') {
			return buildShapePathGradient(stops, fp, ftr);
		}

		// Default: circle path type
		return buildCirclePathGradient(stops, fp, ftr);
	}

	const normalizedAngle =
		typeof style.fillGradientAngle === 'number' && Number.isFinite(style.fillGradientAngle)
			? style.fillGradientAngle
			: 90;
	return `linear-gradient(${Math.round(normalizedAngle)}deg, ${stops.map(toCssGradientStop).join(', ')})`;
}
