/**
 * chart-picture-pattern-def.ts: builds the `<pattern>` `ChartSvgDef` for a
 * data point's picture fill, and the bounding-box helper that lets a
 * non-rectangular primitive (a 3-D bar's oblique-projection side/top
 * extrusion polygon) reuse the exact same sizing math as a plain rect.
 *
 * Split out of `chart-datapoint-picture-fills.ts` (the flat/front-face case)
 * so `chart-3d-depth.ts` (the side/end-face case, C2-G9 3-D face-targeting
 * half) can build an identical pattern def without duplicating the
 * stretch/stack tile-sizing rules.
 *
 * @module chart-picture-pattern-def
 */
import type { ChartSvgDef } from './chart-view-model-types';

/** Axis-aligned bounding box, in SVG user-space coordinates. */
export interface BoundingBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Bounding box of an SVG `polygon`'s `points` attribute (`"x1,y1 x2,y2 ..."`).
 * The oblique-projection top/side extrusion faces are parallelograms, not
 * axis-aligned rects, so a `<pattern>` sized to their bounding box is an
 * approximation (the image is not sheared to the parallelogram's slant) -
 * consistent with this renderer's other oblique-projection simplifications
 * (see `chart-3d-depth.ts`'s module doc).
 */
export function polygonBoundingBox(points: string): BoundingBox {
	const coords = points
		.trim()
		.split(/\s+/u)
		.map((pair) => pair.split(',').map(Number));
	const xs = coords.map(([x]) => x);
	const ys = coords.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const maxX = Math.max(...xs);
	const maxY = Math.max(...ys);
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Build the `<pattern>` def for one picture-filled primitive's bounding box.
 * `stretch` covers the whole box with one non-uniformly scaled copy, matching
 * PowerPoint's "Stretch" option; `stack`/`stackScale` repeat the image at
 * {@link tileHeightPx} (falling back to the box's own height, i.e. one tile,
 * when the point set no `c:pictureStackUnit`), cropped to the tile like
 * PowerPoint's "Stack" fill.
 */
export function buildPictureFillPatternDef(
	id: string,
	href: string,
	format: 'stretch' | 'stack' | 'stackScale',
	box: BoundingBox,
	tileHeightPx: number | undefined,
): ChartSvgDef {
	const stretch = format === 'stretch';
	return {
		kind: 'pattern',
		id,
		href,
		patternUnits: 'userSpaceOnUse',
		x: box.x,
		y: box.y,
		width: box.w,
		height: stretch ? box.h : (tileHeightPx ?? box.h),
		preserveAspectRatio: stretch ? 'none' : 'xMidYMid slice',
	};
}
