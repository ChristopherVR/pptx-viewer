/**
 * PowerPoint `a:gradFill` with `a:path@type="rect"` shades a shape toward its
 * own bounding rectangle. Its isolines are concentric rectangles with square
 * corners (a Chebyshev / L-infinity distance field: `d = max(|dx|, |dy|)`),
 * not circles or ellipses. SVG and CSS only offer elliptical/circular radial
 * gradients natively, so this repo previously approximated a rect path
 * gradient as a single ellipse (`fill-style.ts`'s old `buildRectPathGradient`
 * body) - a reasonable match near the centre of a roughly square shape, but
 * visibly wrong near the corners of anything else. There, PowerPoint's real
 * render reaches the outer stop colour fastest (the corner is the single
 * farthest point on both axes at once), while an ellipse reaches it slowest
 * (a circle/ellipse's corner-diagonal radius is always >= its axis radius),
 * so the ellipse left every corner closer to the centre colour than
 * PowerPoint actually paints it - most visible on a wide/short shape (a
 * banner, a button) with a vignette-style rect gradient.
 *
 * This module renders the true rectangular field directly, as a stack of
 * nested, axis-aligned `<rect>` bands (largest first, smallest last,
 * painter's-algorithm style) inside a small self-contained SVG. Each band's
 * four edges are linearly interpolated between the shape's own bounding box
 * (position 100, the outermost band) and `a:fillToRect`'s own inner
 * rectangle (position 0): `fillToRect` names a whole target rectangle, not a
 * point, so PowerPoint paints its position-0 colour flat across that entire
 * rectangle and only ramps the gradient in the "frame" around it, which this
 * reproduces exactly (with no `fillToRect` at all, the inner rectangle
 * collapses to a point, giving plain nested squares/rectangles shrinking to
 * the centre - the Chebyshev/L-infinity field described above). This is a
 * much closer match to PowerPoint's own render than a single closed-form
 * ellipse, while staying pure SVG markup (no filters, no blend modes, nothing
 * that raster export or an older browser might not support).
 *
 * The SVG uses a normalised 0-100 viewBox with `preserveAspectRatio="none"`,
 * so it is meant to be painted via `background-image` paired with
 * `background-size: 100% 100%` and `background-repeat: no-repeat` (see
 * `resolveComputedFill` in `fill-style.ts`): it then stretches to the
 * element's own box regardless of aspect ratio, exactly like the CSS
 * `radial-gradient()` string it replaces.
 *
 * Deliberately dependency-free (no imports from `fill-style.ts`) so it stays
 * a pure, reusable decision function per this repo's shared-extraction rule,
 * and can later be reused by the SVG (`custGeom`) fill path without risking
 * an import cycle.
 */

/** One colour stop, already sanitised: position 0-100, colour `#RRGGBB`. */
export interface RectPathGradientStop {
	position: number;
	color: string;
	opacity?: number;
}

/** A focal point as a fraction (0-1) of the shape's box, e.g. `a:gradFill`'s focus. */
export interface RectPathGradientFocalPoint {
	x: number;
	y: number;
}

/** OOXML `a:fillToRect`, as 0-1 insets from each edge. */
export interface RectPathGradientFillToRect {
	l: number;
	t: number;
	r: number;
	b: number;
}

/**
 * Bands rendered across the 0-1 distance range. Higher is smoother (closer to
 * the true continuous field) at the cost of a larger data URI; 40 keeps each
 * visible step under a couple of percent, which is not perceptible at normal
 * zoom for the smooth authoring gradients PowerPoint decks actually use.
 */
const BAND_COUNT = 40;

function hexToRgb(color: string): { r: number; g: number; b: number } {
	const hex = color.replace('#', '');
	return {
		r: Number.parseInt(hex.slice(0, 2), 16) || 0,
		g: Number.parseInt(hex.slice(2, 4), 16) || 0,
		b: Number.parseInt(hex.slice(4, 6), 16) || 0,
	};
}

function toHexChannel(value: number): string {
	return Math.min(255, Math.max(0, Math.round(value)))
		.toString(16)
		.padStart(2, '0');
}

/** Linearly interpolates two colour stops' colour and opacity at `t` (0 = a, 1 = b). */
function lerpStops(
	a: RectPathGradientStop,
	b: RectPathGradientStop,
	t: number,
): { color: string; opacity: number } {
	const ca = hexToRgb(a.color);
	const cb = hexToRgb(b.color);
	const oa = a.opacity ?? 1;
	const ob = b.opacity ?? 1;
	return {
		color: `#${toHexChannel(ca.r + (cb.r - ca.r) * t)}${toHexChannel(ca.g + (cb.g - ca.g) * t)}${toHexChannel(ca.b + (cb.b - ca.b) * t)}`,
		opacity: oa + (ob - oa) * t,
	};
}

/** Colour + opacity at a given position (0-100) along a sorted, non-empty stop list. */
function colorAt(
	stops: RectPathGradientStop[],
	position: number,
): { color: string; opacity: number } {
	const first = stops[0];
	const last = stops[stops.length - 1];
	if (position <= first.position) {
		return { color: first.color, opacity: first.opacity ?? 1 };
	}
	if (position >= last.position) {
		return { color: last.color, opacity: last.opacity ?? 1 };
	}
	for (let i = 0; i < stops.length - 1; i += 1) {
		const from = stops[i];
		const to = stops[i + 1];
		if (position >= from.position && position <= to.position) {
			const span = to.position - from.position;
			const t = span > 0 ? (position - from.position) / span : 0;
			return lerpStops(from, to, t);
		}
	}
	return { color: last.color, opacity: last.opacity ?? 1 };
}

/** An axis-aligned rectangle in 0-100 units. */
interface Rect100 {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * The inner target rectangle that gradient position 0 (the innermost stop)
 * maps to. `a:fillToRect` defines a whole sub-rectangle here, not a point:
 * PowerPoint paints its own position-0 colour flat across that entire
 * rectangle, and only ramps the gradient in the "frame" between it and the
 * shape's outer bounding box. A focal point translates this rectangle as a
 * rigid whole (its size is unaffected), matching `computeGradientCenter` in
 * `fill-style.ts`'s treatment of a focal point as a centre-blend (kept as a
 * private duplicate rather than an import - see the module doc).
 *
 * With no `fillToRect` there is no authored target rectangle to shrink to, so
 * this collapses to a single point (the resolved centre), matching this
 * module's previous point-based behaviour for that case.
 */
function resolveInnerRect(
	fillToRect: RectPathGradientFillToRect | undefined,
	focalPoint: RectPathGradientFocalPoint | undefined,
): Rect100 {
	let centerX = 50;
	let centerY = 50;
	let width = 0;
	let height = 0;

	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		centerX = ((l + (1 - r)) / 2) * 100;
		centerY = ((t + (1 - b)) / 2) * 100;
		width = Math.max(0, Math.min(1, 1 - l - r)) * 100;
		height = Math.max(0, Math.min(1, 1 - t - b)) * 100;
		if (focalPoint) {
			centerX = (centerX + focalPoint.x * 100) / 2;
			centerY = (centerY + focalPoint.y * 100) / 2;
		}
	} else if (focalPoint) {
		centerX = focalPoint.x * 100;
		centerY = focalPoint.y * 100;
	}

	return {
		left: centerX - width / 2,
		top: centerY - height / 2,
		right: centerX + width / 2,
		bottom: centerY + height / 2,
	};
}

/** Linear interpolation from `inner` (t=0) to the shape's own box (t=1). */
function lerpEdge(inner: number, outer: number, t: number): number {
	return inner + (outer - inner) * t;
}

/**
 * Builds the raw SVG markup for the nested-rectangle band approximation, in a
 * normalised 0-100 viewBox. Exported mainly so tests can inspect the actual
 * bands drawn; {@link buildRectPathGradientImage} is the entry point
 * renderers should use.
 */
export function buildRectPathGradientSvg(
	stops: RectPathGradientStop[],
	focalPoint?: RectPathGradientFocalPoint,
	fillToRect?: RectPathGradientFillToRect,
): string {
	if (stops.length === 0) {
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>';
	}
	const sorted = [...stops].sort((a, b) => a.position - b.position);
	const inner = resolveInnerRect(fillToRect, focalPoint);
	// The outer band is always the shape's real bounding box: PowerPoint's
	// last gradient stop paints at the shape's actual edges all the way
	// around, not just at whichever corner happens to be farthest from an
	// off-centre focal point (the earlier version of this module reached only
	// the farthest edge, mirroring a CSS radial-gradient's sizing keywords -
	// closer to a circle/ellipse's behaviour than a rect path gradient's).

	const rects: string[] = [];
	// Draw outer-to-inner (painter's algorithm: later/smaller bands land on
	// top). `t` is this band's own position along the gradient: 1 at the
	// shape's outer edge (drawn first), shrinking to 0 at the inner target
	// rectangle (drawn last).
	for (let i = BAND_COUNT; i >= 0; i -= 1) {
		const t = i / BAND_COUNT;
		const { color, opacity } = colorAt(sorted, t * 100);
		const left = lerpEdge(inner.left, 0, t);
		const top = lerpEdge(inner.top, 0, t);
		const right = lerpEdge(inner.right, 100, t);
		const bottom = lerpEdge(inner.bottom, 100, t);
		const opacityAttr = opacity < 1 ? ` fill-opacity="${Math.max(0, opacity).toFixed(3)}"` : '';
		rects.push(
			`<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${(right - left).toFixed(2)}" height="${(bottom - top).toFixed(2)}" fill="${color}"${opacityAttr}/>`,
		);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

/**
 * Builds the `background-image: url(...)` CSS value for a `path="rect"`
 * gradient fill. Pair with `background-size: 100% 100%` and
 * `background-repeat: no-repeat` so the normalised markup stretches to the
 * element's real box (see `resolveComputedFill` in `fill-style.ts`).
 */
export function buildRectPathGradientImage(
	stops: RectPathGradientStop[],
	focalPoint?: RectPathGradientFocalPoint,
	fillToRect?: RectPathGradientFillToRect,
): string {
	const markup = buildRectPathGradientSvg(stops, focalPoint, fillToRect);
	return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}
