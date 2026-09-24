/**
 * chart-3d-projection.ts: resolve a chart's `c:view3D` into the projection
 * PowerPoint actually draws it with.
 *
 * PowerPoint's 3D charts use ONE of two fundamentally different projections,
 * picked by `c:view3D/@rAngAx` ("right angle axes"):
 *
 * - `rAngAx=1` (bar3D's own default, verified against `gt/chart-01.webp`):
 *   an OBLIQUE (cavalier-style) parallel projection. The front-facing plot
 *   (axes, gridlines, front face of every mark) is drawn perfectly flat and
 *   undistorted, exactly like the 2D chart; only each mark's own depth
 *   ("thickness") recedes along a fixed screen-space direction set by
 *   `rotX`/`rotY`. This is the SAME depth vector the flat 2D fallback already
 *   computes (`chart-3d-depth.ts#computeDepthVector`); this module exposes it
 *   as a unitless per-world-Z shear so a true WebGL scene's camera can
 *   reproduce it exactly instead of hand-drawn 2D parallelograms.
 * - `rAngAx=0` (line3D/area3D/pie3D/surface's own default, verified against
 *   `gt/chart-10.webp` and `gt/chart-16.webp`, which both show a genuine
 *   receding 3-axis box: category/series gridlines converge, unlike the
 *   orthogonal bar3D case): a real PERSPECTIVE camera, elevation `rotX`,
 *   azimuth `rotY`, field of view from `c:view3D/c:perspective`.
 *
 * Absent `rAngAx` defaults to PowerPoint's own per-chart-type default:
 * `true` for `bar3D`, `false` for everything else. `pie3D`'s own rotX/rotY
 * defaults (30/0, "tilt" with no azimuth) differ from every other 3D chart
 * type's (15/20), matching PowerPoint's Insert Chart gallery defaults.
 *
 * @module chart-3d-projection
 */
import type { PptxChartView3D } from 'pptx-viewer-core';

/** `rAngAx=1`: flat front faces, marks recede along a fixed screen-space shear. */
export interface Chart3DObliqueProjection {
	mode: 'oblique';
	/** World-X screen shift per world unit of depth (receding into the scene). */
	shearX: number;
	/** World-Y screen shift per world unit of depth. */
	shearY: number;
	rotXDeg: number;
	rotYDeg: number;
}

/** `rAngAx=0`: a real perspective camera framing the whole 3D grid. */
export interface Chart3DPerspectiveProjection {
	mode: 'perspective';
	/** Elevation in degrees (`c:view3D/@rotX`, -90..90). */
	rotXDeg: number;
	/** Azimuth in degrees (`c:view3D/@rotY`, 0..360). */
	rotYDeg: number;
	/** Resolved vertical field of view in degrees. */
	fovDeg: number;
}

export type Chart3DProjection = Chart3DObliqueProjection | Chart3DPerspectiveProjection;

const DEFAULT_ROT_X = 15;
const DEFAULT_ROT_Y = 20;
const DEFAULT_PIE_ROT_X = 30;
const DEFAULT_PIE_ROT_Y = 0;
const DEFAULT_PERSPECTIVE_DEG = 30;
/** `c:view3D/c:perspective` is documented 0-240 degrees; PowerPoint's own UI
 * caps the picker at 120, so anything past that is treated as "very deep". */
const PERSPECTIVE_MAX_DEG = 120;
const FOV_MIN = 15;
const FOV_MAX = 75;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Resolve the perspective camera's vertical field of view from `c:view3D/c:perspective`. */
function resolvePerspectiveFov(perspectiveDeg: number | undefined): number {
	const perspective = clamp(perspectiveDeg ?? DEFAULT_PERSPECTIVE_DEG, 0, PERSPECTIVE_MAX_DEG);
	return FOV_MIN + (perspective / PERSPECTIVE_MAX_DEG) * (FOV_MAX - FOV_MIN);
}

/**
 * Resolve a chart's actual projection from its type and `c:view3D`. Every 3D
 * chart type this module is consulted for (`bar3D`, `line3D`, `area3D`,
 * `pie3D`, and a `surface`/`surface3D` chart whose `chartData.view3D` is
 * present) always has SOME projection; there is no "no 3D" case here, that
 * gate belongs to the caller (`chart-3d-spec.ts#buildChart3DSpecForElement`).
 */
export function resolveChart3DProjection(
	chartType: string,
	view3D: PptxChartView3D | undefined,
): Chart3DProjection {
	const isPie = chartType === 'pie3D';
	const rotXDeg = view3D?.rotX ?? (isPie ? DEFAULT_PIE_ROT_X : DEFAULT_ROT_X);
	const rotYDeg = view3D?.rotY ?? (isPie ? DEFAULT_PIE_ROT_Y : DEFAULT_ROT_Y);
	const rAngAx = view3D?.rAngAx ?? chartType === 'bar3D';

	if (rAngAx) {
		const rx = (rotXDeg * Math.PI) / 180;
		const ry = (rotYDeg * Math.PI) / 180;
		return {
			mode: 'oblique',
			shearX: Math.sin(ry),
			shearY: -Math.sin(rx),
			rotXDeg,
			rotYDeg,
		};
	}

	return {
		mode: 'perspective',
		rotXDeg,
		rotYDeg,
		fovDeg: resolvePerspectiveFov(view3D?.perspective),
	};
}
