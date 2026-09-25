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

type ShadeFamily = 'box' | 'cylinder' | 'cone' | 'pyramid';

/**
 * Per-shape shade coefficients `[x, y, z]` for {@link chart3DNormalShade}.
 * `box` reproduces the face multipliers above (right 0.64, top 0.75, front
 * 1.0); the others are fitted to `gt/chart-07..09.webp` (accent1 columns):
 * a cylinder runs 1.07x at its centre line to ~0.64x at the silhouette, a
 * cone 1.16x to ~0.7x, a pyramid's front face 1.03x and its side 0.68x. Tops
 * (cylinder cap, box top) sample 0.75x throughout.
 */
const NORMAL_SHADE: Record<ShadeFamily, readonly [number, number, number]> = {
	box: [0.64, 0.75, 1],
	cylinder: [0.62, 0.75, 1.07],
	cone: [0.7, 0.75, 1.16],
	pyramid: [0.68, 0.75, 1.03],
};

/** Multiplier for a downward-facing surface (a bar's underside), rarely visible. */
const UNDERSIDE_SHADE = 0.5;

function shadeFamily(shape: string | undefined): ShadeFamily {
	switch (shape) {
		case 'cylinder':
			return 'cylinder';
		case 'cone':
		case 'coneToMax':
			return 'cone';
		case 'pyramid':
		case 'pyramidToMax':
			return 'pyramid';
		default:
			return 'box';
	}
}

/**
 * PowerPoint's flat chart-space shade for a surface of a `c:shape` bar with
 * unit world normal `(nx, ny, nz)` (x right, y up, z toward the viewer), as
 * a multiplier of the base colour: the quadratic form
 * `cx nx^2 + cy ny^2 + cz nz^2`, which for a box's axis-aligned faces is
 * exactly the per-face table above.
 */
export function chart3DNormalShade(
	shape: string | undefined,
	nx: number,
	ny: number,
	nz: number,
): number {
	const [cx, cy, cz] = NORMAL_SHADE[shadeFamily(shape)];
	return cx * nx * nx + (ny >= 0 ? cy : UNDERSIDE_SHADE) * ny * ny + cz * nz * nz;
}
