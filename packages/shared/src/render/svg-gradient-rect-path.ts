/**
 * `path="rect"` SVG paint server: the true nested-rectangle (Chebyshev)
 * gradient field, as a `<pattern>` whose tile is the same normalised SVG
 * image {@link ./path-gradient-rect.ts} builds for the CSS `background-image`
 * path.
 *
 * Split out of `svg-gradient-paint.ts` (which stays focused on the
 * `<linearGradient>` / `<radialGradient>` paint servers SVG can express
 * natively) to keep both files under this repo's ~300-LOC guideline.
 *
 * @module svg-gradient-rect-path
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import type { RectPathGradientStop } from './path-gradient-rect';
import { buildRectPathGradientSvg } from './path-gradient-rect';
import { escapeSvgAttr } from './visual-effects';

/** One `<stop>` of an SVG gradient (mirrors `SvgGradientStopDef` in `svg-gradient-paint.ts`). */
interface RectPathStopSource {
	offset: number;
	color: string;
	opacity?: number;
}

/**
 * A `path="rect"` gradient's true nested-rectangle field, painted as a
 * `<pattern>` whose single tile is stretched to the shape's own box
 * (`patternUnits="objectBoundingBox"`, `width`/`height` 1, the `<image>`
 * itself `preserveAspectRatio="none"`).
 *
 * SVG's native `<radialGradient>` can only express an ellipse, which is a
 * visibly wrong approximation for a rect-path gradient near a non-square
 * shape's corners (see `path-gradient-rect.ts`'s module doc), so a freeform
 * (`a:custGeom`) shape with `a:path type="rect"` needs this distinct paint
 * server instead of an elliptical `SvgRadialGradientDef`.
 */
export interface SvgRectPathGradientDef {
	kind: 'rectPath';
	id: string;
	/** `data:image/svg+xml,...` of the nested-rectangle band field. */
	href: string;
}

/**
 * Build the rect-path paint-server definition from already-converted SVG
 * stops (0-1 offsets; see `toSvgStops` in `svg-gradient-paint.ts`).
 */
export function buildRectPathGradientDef(
	stops: readonly RectPathStopSource[],
	id: string,
	focalPoint: ShapeStyle['fillGradientFocalPoint'],
	fillToRect: ShapeStyle['fillGradientFillToRect'],
): SvgRectPathGradientDef {
	const rectStops: RectPathGradientStop[] = stops.map((stop) => ({
		position: Math.round(stop.offset * 100 * 10000) / 10000,
		color: stop.color,
		...(typeof stop.opacity === 'number' ? { opacity: stop.opacity } : {}),
	}));
	// NOT `buildRectPathGradientImage`: that wraps the markup in a CSS
	// `url("...")` function for `background-image`, which is invalid syntax
	// for an `<image href="...">` attribute. This needs the bare
	// `data:image/svg+xml,...` URI.
	const markup = buildRectPathGradientSvg(rectStops, focalPoint, fillToRect);
	return { kind: 'rectPath', id, href: `data:image/svg+xml,${encodeURIComponent(markup)}` };
}

/** Serialise a {@link SvgRectPathGradientDef} to a stretched `<pattern><image>` tile. */
export function rectPathGradientMarkup(def: SvgRectPathGradientDef): string {
	const id = escapeSvgAttr(def.id);
	const href = escapeSvgAttr(def.href);
	return `<pattern id="${id}" patternUnits="objectBoundingBox" width="1" height="1"><image href="${href}" x="0" y="0" width="1" height="1" preserveAspectRatio="none"/></pattern>`;
}
