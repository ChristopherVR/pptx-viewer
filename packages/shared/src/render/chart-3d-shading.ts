/**
 * chart-3d-shading.ts: PowerPoint's flat chart-space shading for a 3D chart's
 * box faces, as one colour multiplier per named face.
 *
 * PowerPoint's 3D charts (bar3D, pie3D, line3D ribbons, area3D slabs, surface
 * bands) are flat-shaded in "chart space": every face of a given orientation
 * gets the SAME multiplier applied to the mark's base colour, regardless of
 * the chart's `c:view3D` tilt. Measured directly off the pixels of
 * `gt/chart-01.webp` (a 3-D Clustered Column, series 1 = theme accent1
 * `#156082`): the front (camera-facing) rect samples the base colour exactly
 * (`front = base`), the top face samples ~0.75x, and the visible side face
 * ~0.64x. `back`/`left` (mirrors of `right`) and `bottom` (rarely visible)
 * are not independently measured; `back`/`left` reuse the measured side
 * multiplier and `bottom` is a reasonable approximation between side and a
 * fully unlit face.
 *
 * @module chart-3d-shading
 */
import { shade } from './chart-palette';

/** A box mesh's six face orientations, in the chart's own (unrotated) local frame. */
export type Chart3DFace = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Darken amount (0-1, `chart-palette.ts#shade`'s `amount`) per face,
 * derived from the measured multipliers: `amount = 1 - multiplier`.
 */
const FACE_SHADE_AMOUNT: Record<Chart3DFace, number> = {
	front: 0,
	top: 0.25,
	right: 0.36,
	left: 0.36,
	back: 0.36,
	bottom: 0.5,
};

/** Apply PowerPoint's measured per-face flat shading to a mark's base colour. */
export function shadeChart3DFace(baseColor: string, face: Chart3DFace): string {
	const amount = FACE_SHADE_AMOUNT[face];
	return amount === 0 ? baseColor : shade(baseColor, amount);
}

/**
 * The six face colours for a box mesh, in the order three.js `BoxGeometry`
 * expects its `material` array (`[+x, -x, +y, -y, +z, -z]`): right, left,
 * top, bottom, front, back. `front`/`back` name whichever world axis the
 * scene treats as the camera-facing depth axis; the caller picks that
 * mapping (see `chart-3d-view-scene.ts`).
 */
export function buildChart3DBoxFaceColors(
	baseColor: string,
): readonly [string, string, string, string, string, string] {
	return [
		shadeChart3DFace(baseColor, 'right'),
		shadeChart3DFace(baseColor, 'left'),
		shadeChart3DFace(baseColor, 'top'),
		shadeChart3DFace(baseColor, 'bottom'),
		shadeChart3DFace(baseColor, 'front'),
		shadeChart3DFace(baseColor, 'back'),
	];
}
