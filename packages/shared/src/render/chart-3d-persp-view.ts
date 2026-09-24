/**
 * PowerPoint's perspective 3D chart camera (`c:view3D/@rAngAx=0`: line3D,
 * area3D, surface3D), as a pure projection plus its three.js camera.
 *
 * Fitted to PowerPoint's own exports of the three-d-parity deck: the ends and
 * corners of every wall gridline in `gt/chart-10..12,16` were traced and a
 * camera fitted to them (0.4-2pt RMS per chart):
 *
 * - The plot is a box `w x h x d` (x categories, y values, z depth away from
 *   the viewer). It is yawed by `rotY` about its vertical centre line, then
 *   pitched toward the viewer by `0.92 * rotX` (the fitted pitch was
 *   13.6-14.0 degrees for every `rotX = 15` chart).
 * - The camera looks at the box centre from `diagonal / (2 tan(fov / 2))`
 *   away, `fov` being `c:view3D/c:perspective` in degrees (default 30): the
 *   box's bounding sphere just fills the field of view. The fitted distances
 *   were 1.8-1.9 box diagonals.
 *
 * A box point `(x, y, z)` (origin at the front-bottom-left corner) lands at
 * chart px `(cx + f X / Z, cy - f Y / Z)`, `(X, Y, Z)` being the point in
 * camera space; {@link fitPerspView} picks `f`, `cx`, `cy` so the box fills a
 * target rect.
 *
 * @module chart-3d-persp-view
 */
import type * as THREE from 'three';

type ThreeModule = typeof THREE;

/** Fitted pitch per degree of `rotX`. */
export const PERSP_PITCH_PER_ROTX = 0.92;
/** `c:perspective` default: the field of view in degrees. */
export const PERSP_DEFAULT_FOV = 30;

export interface PerspBox {
	w: number;
	h: number;
	d: number;
}

export interface PerspCamera {
	box: PerspBox;
	/** Yaw (`rotY`) in radians: positive brings the box's right end toward the viewer. */
	yaw: number;
	/** Pitch in radians: positive tips the top of the box away (the viewer looks down). */
	pitch: number;
	/** Camera distance from the box centre, world units. */
	dist: number;
}

export interface PerspView extends PerspCamera {
	/** Focal length: chart px per world unit at unit depth. */
	focal: number;
	/** Chart px of the box centre. */
	cx: number;
	cy: number;
}

/** Camera-space coordinates `(X, Y, Z)` of a box point; `Z` is the depth ahead of the camera. */
export function perspToCamera(
	camera: PerspCamera,
	p: readonly [number, number, number],
): [number, number, number] {
	const x = p[0] - camera.box.w / 2;
	const y = p[1] - camera.box.h / 2;
	const z = p[2] - camera.box.d / 2;
	const cy = Math.cos(camera.yaw);
	const sy = Math.sin(camera.yaw);
	const cp = Math.cos(camera.pitch);
	const sp = Math.sin(camera.pitch);
	const x1 = x * cy + z * sy;
	const z1 = -x * sy + z * cy;
	return [x1, y * cp + z1 * sp, z1 * cp - y * sp + camera.dist];
}

/** Chart px of a box point. */
export function perspToScreen(
	view: PerspView,
	p: readonly [number, number, number],
): { x: number; y: number } {
	const [X, Y, Z] = perspToCamera(view, p);
	return { x: view.cx + (view.focal * X) / Z, y: view.cy - (view.focal * Y) / Z };
}

/** The camera for a box and its `c:view3D` angles (degrees), before scale and placement. */
export function perspCameraFor(
	box: PerspBox,
	rotXDeg: number,
	rotYDeg: number,
	fovDeg: number = PERSP_DEFAULT_FOV,
): PerspCamera {
	const diagonal = Math.hypot(box.w, box.h, box.d);
	const fov = Math.min(Math.max(fovDeg, 1), 170);
	const dist = diagonal / (2 * Math.tan(((fov / 2) * Math.PI) / 180));
	return {
		box,
		yaw: (rotYDeg * Math.PI) / 180,
		pitch: (rotXDeg * PERSP_PITCH_PER_ROTX * Math.PI) / 180,
		dist,
	};
}

/** The box's eight corners. */
function boxCorners(box: PerspBox): Array<[number, number, number]> {
	return Array.from({ length: 8 }, (_, i): [number, number, number] => [
		(i & 1) * box.w,
		((i >> 1) & 1) * box.h,
		((i >> 2) & 1) * box.d,
	]);
}

/** Bounds of the projection of `points` (default: the box corners) at focal 1, box centre at (0, 0). */
export function perspUnitBounds(
	camera: PerspCamera,
	points: ReadonlyArray<readonly [number, number, number]> = boxCorners(camera.box),
): { minX: number; maxX: number; minY: number; maxY: number } {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		const [X, Y, Z] = perspToCamera(camera, p);
		minX = Math.min(minX, X / Z);
		maxX = Math.max(maxX, X / Z);
		minY = Math.min(minY, -Y / Z);
		maxY = Math.max(maxY, -Y / Z);
	}
	return { minX, maxX, minY, maxY };
}

/**
 * Scale and place a camera so the projection of `points` (default: the box
 * corners) fits inside `rect` (chart px) as large as it can, centred in it
 * (`gt/chart-11`, a box too wide for its rect, sits midway down it).
 */
export function fitPerspView(
	camera: PerspCamera,
	rect: { left: number; top: number; right: number; bottom: number },
	points?: ReadonlyArray<readonly [number, number, number]>,
): PerspView {
	const b = perspUnitBounds(camera, points);
	const focal = Math.min(
		(rect.right - rect.left) / (b.maxX - b.minX),
		(rect.bottom - rect.top) / (b.maxY - b.minY),
	);
	return {
		...camera,
		focal,
		cx: (rect.left + rect.right) / 2 - (focal * (b.minX + b.maxX)) / 2,
		cy: (rect.top + rect.bottom) / 2 - (focal * (b.minY + b.maxY)) / 2,
	};
}

/**
 * Where the view ray through chart px `(sx, sy)` meets the horizontal box
 * plane at height `y`, as box `(x, z)`; `null` when the ray runs parallel to
 * it or meets it behind the camera.
 */
export function perspScreenToPlaneY(
	view: PerspView,
	sx: number,
	sy: number,
	y: number,
): { x: number; z: number } | null {
	// Ray direction in camera space (Z = 1), rotated back into box space.
	const dx = (sx - view.cx) / view.focal;
	const dy = (view.cy - sy) / view.focal;
	const cp = Math.cos(view.pitch);
	const sp = Math.sin(view.pitch);
	const cyw = Math.cos(view.yaw);
	const syw = Math.sin(view.yaw);
	// Inverse pitch: (x1, y, z1) from (X, Y, Z).
	const invPitch = (X: number, Y: number, Z: number): [number, number, number] => [
		X,
		Y * cp - Z * sp,
		Y * sp + Z * cp,
	];
	// Inverse yaw: box-centred (x, z) from (x1, z1).
	const invYaw = (x1: number, z1: number): [number, number] => [
		x1 * cyw - z1 * syw,
		x1 * syw + z1 * cyw,
	];
	const [ox1, oy, oz1] = invPitch(0, 0, -view.dist);
	const [dx1, dyb, dz1] = invPitch(dx, dy, 1);
	const [ox, oz] = invYaw(ox1, oz1);
	const [ddx, ddz] = invYaw(dx1, dz1);
	const target = y - view.box.h / 2;
	if (Math.abs(dyb) < 1e-12) {
		return null;
	}
	const t = (target - oy) / dyb;
	if (t <= 0) {
		return null;
	}
	return { x: ox + ddx * t + view.box.w / 2, z: oz + ddz * t + view.box.d / 2 };
}

/**
 * A three.js camera that renders box-space geometry exactly where
 * {@link perspToScreen} puts it, on a canvas of `svgWidth x svgHeight` chart
 * px. It sits at the origin looking down -Z with an off-centre projection;
 * place the box group with {@link perspBoxMatrix}.
 */
export function buildPerspCamera(
	three: ThreeModule,
	view: PerspView,
	svgWidth: number,
	svgHeight: number,
): THREE.PerspectiveCamera {
	const reach = Math.hypot(view.box.w, view.box.h, view.box.d);
	const near = Math.max(view.dist - reach, view.dist * 0.05);
	const far = view.dist + reach;
	const camera = new three.PerspectiveCamera(30, svgWidth / svgHeight, near, far);
	camera.projectionMatrix.set(
		(2 * view.focal) / svgWidth,
		0,
		(2 * view.cx) / svgWidth - 1,
		0,
		0,
		(2 * view.focal) / svgHeight,
		1 - (2 * view.cy) / svgHeight,
		0,
		0,
		0,
		-(far + near) / (far - near),
		(-2 * far * near) / (far - near),
		0,
		0,
		-1,
		0,
	);
	// Three's view space looks down -Z, so the third column multiplies -Z:
	// negate it for the principal-point terms to add at positive depth.
	const e = camera.projectionMatrix.elements;
	e[8] = -e[8];
	e[9] = -e[9];
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	return camera;
}

/** The matrix taking box space to the view space of {@link buildPerspCamera}. */
export function perspBoxMatrix(three: ThreeModule, view: PerspCamera): THREE.Matrix4 {
	const { w, h, d } = view.box;
	return new three.Matrix4()
		.makeScale(1, 1, -1)
		.multiply(new three.Matrix4().makeTranslation(0, 0, view.dist))
		.multiply(new three.Matrix4().makeRotationX(-view.pitch))
		.multiply(new three.Matrix4().makeRotationY(view.yaw))
		.multiply(new three.Matrix4().makeTranslation(-w / 2, -h / 2, -d / 2));
}
