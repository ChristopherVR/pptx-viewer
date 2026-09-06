/**
 * Extruded-box side-panel QUADRILATERAL for a homography-resolved camera
 * (framework-agnostic).
 *
 * `visual-3d-extrusion`'s panels used to share the front face's own
 * `matrix3d` and fold themselves into position with a local `rotateX`/
 * `rotateY(+/-90deg)` plus `translateZ`. That composition is exact for a real
 * CSS 3D `perspective` camera (see `visual-3d-camera`'s non-homography
 * branch), but is DEGENERATE for a homography-resolved camera: a COM-measured
 * unit-square homography (`visual-3d-camera-homography`) is a flat 2D
 * projective map whose CSS `matrix3d` embedding has an IDENTITY z-row (see
 * that module's doc comment), so it never feeds a point's z-coordinate into
 * the projective divide. A rigid local rotation moves the panel's "front" and
 * "back" edges apart only in z (their x/y stay identical before the
 * homography is applied), so both edges land on the exact SAME screen line
 * after the homography runs: the panel collapses to a zero-width sliver.
 * Verified 2026-09 by rendering the actual `build3DExtrusionData` output in a
 * real browser (Playwright, corner-marker `getBoundingClientRect`) for every
 * `isometric*`/`perspective*`/`oblique*` preset tested: the panel's front-edge
 * and back-edge markers landed on IDENTICAL pixels every time.
 *
 * This module replaces that composition with an EXPLICIT quadrilateral: the
 * front edge is the exact image of the shape's own unit-square edge under the
 * SAME homography the front face already uses (so it is pixel-identical to
 * the front face's boundary by construction, never "close"), and the back
 * edge is that same edge offset by a COM-measured 2D screen-space direction
 * vector, scaled by the actual rendered extrusion depth. The panel is then a
 * flat, untransformed `clip-path: polygon(...)` cut from a div sized to the
 * quad's own bounding box: exact, and framework-agnostic (every binding
 * already passes `ExtrusionPanel.style` through generically, so a new
 * `clipPath`/`left`/`top` reaches all five with no per-binding change).
 *
 * Ground-truthed 2026-09 (COM `Slide.Export`, 300dpi, a 2in square extruded
 * 36pt, front face red / `extrusionClr` green, convex-hull corner fit of the
 * green ink): the measured back-edge offset, expressed as a fraction of the
 * rendered extrusion depth (dimensionless: screen px moved per px of depth,
 * so the same ratio applies at any element size or DPI), for the families
 * this module covers. Presets with no ground truth here fall back to the
 * pre-existing (degenerate) composition in `visual-3d-extrusion` rather than
 * guessing an unmeasured skew: see that module's call site.
 *
 * @module render/visual-3d-panel-quad
 */

import type { Homography3 } from './visual-3d-camera-homography';
import type { PanelDepthSkew } from './visual-3d-panel-depth-skew-map';

// Re-exported for callers that historically imported the skew-map data from
// this module; the data itself lives in `visual-3d-panel-depth-skew-map` (a
// separate file to keep this one under the repo's LOC guideline).
export {
	PANEL_DEPTH_SKEW_MAP,
	getMeasuredPanelDepthSkew,
	type PanelDepthSkewEntry,
	type PanelDepthSkew,
} from './visual-3d-panel-depth-skew-map';

/** A single 2D point, in element-local CSS px (0,0 = the shape's own un-rotated top-left). */
export interface Point2D {
	x: number;
	y: number;
}

/**
 * Apply a unit-square homography to a single point `(u, v)` (both typically
 * in `[0, 1]`, the shape's own local fraction), returning its projected
 * position in the element's actual `width x height` CSS-px box. Pure
 * evaluation (no CSS string involved), so it can be reused for both the
 * front-face corners AND, offset by a depth skew, the back-face corners.
 */
export function projectHomographyPoint(
	h: Homography3,
	u: number,
	v: number,
	width: number,
	height: number,
): Point2D {
	const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = h;
	const w = h31 * u + h32 * v + h33;
	return {
		x: ((h11 * u + h12 * v + h13) / w) * width,
		y: ((h21 * u + h22 * v + h23) / w) * height,
	};
}

/** The 2 unit-square corners shared between the front face and each panel side. */
const SHARED_EDGE_UV: Record<
	'top' | 'bottom' | 'left' | 'right',
	readonly [readonly [number, number], readonly [number, number]]
> = {
	top: [
		[0, 0],
		[1, 0],
	],
	bottom: [
		[0, 1],
		[1, 1],
	],
	left: [
		[0, 0],
		[0, 1],
	],
	right: [
		[1, 0],
		[1, 1],
	],
};

/** An explicit, flat quadrilateral for one extrusion side panel. */
export interface PanelQuadGeometry {
	left: number;
	top: number;
	width: number;
	height: number;
	/** CSS `clip-path` polygon, in px relative to `(left, top)`. */
	clipPath: string;
}

/**
 * Compute a homography-resolved panel's exact projected quadrilateral: the
 * front edge (the image of the shape's own shared edge under `h`, identical
 * to the front face's own boundary) joined to that same edge offset by
 * `skew * depthPx` (see the module doc comment). Returns a flat bounding box
 * + `clip-path` polygon; the caller applies NO further transform.
 */
export function computeHomographyPanelQuad(
	h: Homography3,
	side: 'top' | 'bottom' | 'left' | 'right',
	width: number,
	height: number,
	depthPx: number,
	skew: PanelDepthSkew,
): PanelQuadGeometry {
	const [[u1, v1], [u2, v2]] = SHARED_EDGE_UV[side];
	const front1 = projectHomographyPoint(h, u1, v1, width, height);
	const front2 = projectHomographyPoint(h, u2, v2, width, height);
	const offsetX = skew.dx * depthPx;
	const offsetY = skew.dy * depthPx;
	const back1: Point2D = { x: front1.x + offsetX, y: front1.y + offsetY };
	const back2: Point2D = { x: front2.x + offsetX, y: front2.y + offsetY };

	const xs = [front1.x, front2.x, back1.x, back2.x];
	const ys = [front1.y, front2.y, back1.y, back2.y];
	const left = Math.min(...xs);
	const top = Math.min(...ys);
	const boxWidth = Math.max(...xs) - left;
	const boxHeight = Math.max(...ys) - top;

	const toLocal = (p: Point2D) =>
		`${Number((p.x - left).toFixed(2))}px ${Number((p.y - top).toFixed(2))}px`;
	const clipPath = `polygon(${[front1, front2, back2, back1].map(toLocal).join(', ')})`;

	return { left, top, width: boxWidth, height: boxHeight, clipPath };
}
