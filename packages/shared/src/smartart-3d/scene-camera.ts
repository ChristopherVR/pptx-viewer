/**
 * Three.js SmartArt renderer - camera framing + label billboarding math.
 *
 * Pure geometry (no `three` rendering calls beyond the `Mesh`/`PerspectiveCamera`
 * types billboarding reads from) split out of `scene.ts` to keep that module
 * focused on mount/render-loop orchestration. Exported for unit tests
 * (`scene-camera.test.ts`); not part of the `pptx-viewer-shared/smartart-3d`
 * public subpath barrel (`index.ts`), which only re-exports `mountSmartArt3D`.
 */

import type { Mesh, PerspectiveCamera } from 'three';

import type { SmartArt3DMesh, SmartArt3DModel } from '../render/smartart-3d-types';
import type { BuiltMeshGroup } from './meshes';

/** Vertical field of view (degrees) the mounted camera uses. */
export const FOV = 42;

/** A bounding sphere of the 3D content (centre + radius) plus its axis-aligned half-extents. */
export interface ContentSphere {
	cx: number;
	cy: number;
	cz: number;
	radius: number;
	/** World-space half-extent of the content's AABB along X. */
	halfW: number;
	/** World-space half-extent of the content's AABB along Y. */
	halfH: number;
	/** World-space half-extent of the content's AABB along Z. */
	halfD: number;
}

/**
 * Expand a running world-space AABB (tracked via the six `min`/`max` closure
 * variables below) by an axis-aligned box centred at `(x, y, z)` with
 * per-axis half-extents `(rx, ry, rz)`.
 */
type BoundsExpander = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => void;

/**
 * Expand `bounds` by one mesh's true world-space footprint.
 *
 * Every mesh here only ever rotates about Y (see `applySpatialLayout`), so a
 * mesh's local box - footprint half-extents `(halfWidth, halfHeight)` in its
 * own XY plane, and an extrusion that spans local z from `0` to
 * `depth` (plus a small bevel overshoot on both ends) - can be exactly
 * reprojected into world X/Z with the standard rotated-box formula
 * (`|halfExtent * cos| + |otherHalfExtent * sin|` per axis). Using a single
 * scalar radius applied equally to every world axis (the previous approach)
 * conflated the footprint size with the much smaller extrusion depth,
 * wildly overstating a wide/flat node's extent along its through-face axis
 * and pushing the fit-to-frame camera far past where the content actually
 * needed it, so the whole diagram rendered tiny inside its frame.
 */
function expandForMesh(expand: BoundsExpander, m: SmartArt3DMesh): void {
	const hx = m.halfWidth + m.bevel;
	const hy = m.halfHeight + m.bevel;
	const hz = m.depth / 2 + m.bevel;
	const midZ = m.position.z + m.depth / 2;
	const cosY = Math.cos(m.rotation.y);
	const sinY = Math.sin(m.rotation.y);
	const worldHalfX = Math.abs(hx * cosY) + Math.abs(hz * sinY);
	const worldHalfZ = Math.abs(hx * sinY) + Math.abs(hz * cosY);
	expand(m.position.x, m.position.y, midZ, worldHalfX, hy, worldHalfZ);
}

/** Bounding sphere of all meshes (rotation-aware) + connectors. */
export function contentSphere(model: SmartArt3DModel): ContentSphere {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	const expand: BoundsExpander = (x, y, z, rx, ry, rz) => {
		minX = Math.min(minX, x - rx);
		minY = Math.min(minY, y - ry);
		minZ = Math.min(minZ, z - rz);
		maxX = Math.max(maxX, x + rx);
		maxY = Math.max(maxY, y + ry);
		maxZ = Math.max(maxZ, z + rz);
	};
	for (const m of model.meshes) {
		expandForMesh(expand, m);
	}
	for (const c of model.connectors) {
		for (const p of c.points) {
			expand(p.x, p.y, p.z, 1, 1, 1);
		}
	}
	if (!Number.isFinite(minX)) {
		const halfW = model.bounds.width / 2 || 1;
		const halfH = model.bounds.height / 2 || 1;
		const fallback = Math.max(halfW, halfH);
		return { cx: 0, cy: 0, cz: 0, radius: fallback, halfW, halfH, halfD: 1 };
	}
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		cz: (minZ + maxZ) / 2,
		radius: 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1,
		halfW: (maxX - minX) / 2,
		halfH: (maxY - minY) / 2,
		halfD: (maxZ - minZ) / 2,
	};
}

/** Camera distance that frames a bounding sphere of `radius` at the given FOV. */
export function frameDistance(radius: number, aspect: number): number {
	const vFov = (FOV * Math.PI) / 180;
	const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
	const minFov = Math.min(vFov, hFov);
	return (radius / Math.sin(minFov / 2)) * 1.1;
}

/** Fraction of the frame the content's projected box may occupy on its tightest axis. */
const FRAME_FILL = 0.92;

/** The camera position for a given z-offset `dist`, plus the point it looks at. */
export interface CameraPlacement {
	position: [number, number, number];
	target: [number, number, number];
	/** The z-offset the placement was derived from (OrbitControls distance limits scale from it). */
	dist: number;
}

/**
 * Place the camera in front of the content: a slight x offset + elevation
 * gives the extrusion/spatial depth a readable three-quarter presence while
 * framing the content's own centroid (`cameraElevation` picks the tilt).
 */
export function placeCamera(
	bounds: ContentSphere,
	family: SmartArt3DModel['family'],
	dist: number,
): CameraPlacement {
	const { cx, cy, cz, radius } = bounds;
	const elevation = cameraElevation(family, radius, dist);
	return {
		position: [cx + radius * 0.25, cy + elevation, cz + dist],
		target: [cx, cy, cz],
		dist,
	};
}

/**
 * Largest ratio of a content-box corner's projected offset to the frame's
 * half-extent, seen from `placement`: `1` means the box exactly touches the
 * frame edge on its tightest axis, `>1` means it overflows. Corners behind
 * the camera count as infinitely overflowing.
 */
function projectedFill(bounds: ContentSphere, placement: CameraPlacement, aspect: number): number {
	const vFov = (FOV * Math.PI) / 180;
	const tanV = Math.tan(vFov / 2);
	const tanH = tanV * aspect;
	const [px, py, pz] = placement.position;
	const [tx, ty, tz] = placement.target;
	// Camera basis: forward toward the target, right = forward x worldUp, up = right x forward.
	let fx = tx - px,
		fy = ty - py,
		fz = tz - pz;
	const fl = Math.hypot(fx, fy, fz) || 1;
	fx /= fl;
	fy /= fl;
	fz /= fl;
	let rx = -fz,
		rz = fx;
	const rl = Math.hypot(rx, rz) || 1;
	rx /= rl;
	rz /= rl;
	const ux = -rz * fy,
		uy = rz * fx - rx * fz,
		uz = rx * fy;
	let worst = 0;
	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			for (const sz of [-1, 1]) {
				const dx = bounds.cx + sx * bounds.halfW - px;
				const dy = bounds.cy + sy * bounds.halfH - py;
				const dz = bounds.cz + sz * bounds.halfD - pz;
				const depth = dx * fx + dy * fy + dz * fz;
				if (depth <= 1e-6) {
					return Infinity;
				}
				const x = Math.abs(dx * rx + dz * rz) / (depth * tanH);
				const y = Math.abs(dx * ux + dy * uy + dz * uz) / (depth * tanV);
				worst = Math.max(worst, x, y);
			}
		}
	}
	return worst;
}

/**
 * Camera placement whose view fits the content's projected bounding BOX to
 * the frame (`FRAME_FILL` of the tightest axis).
 *
 * `frameDistance` fits the bounding SPHERE to the smaller field of view,
 * which is only tight for roughly cubic content: a wide, flat list diagram
 * (600 x 340 x 40) has a sphere nearly as wide as the diagram but the frame
 * is 1.76x wider than it is tall, so the sphere fit left the diagram at ~45%
 * of the frame width with its captions unreadably small. Starting from the
 * sphere fit, this re-projects the box's eight corners through the actual
 * (elevated, x-offset) camera and rescales the distance until the box just
 * fills the frame; the ratio is close to linear in `dist`, so a handful of
 * fixed-point steps converge.
 */
export function fitCamera(
	bounds: ContentSphere,
	family: SmartArt3DModel['family'],
	aspect: number,
): CameraPlacement {
	let dist = frameDistance(bounds.radius, aspect);
	let placement = placeCamera(bounds, family, dist);
	for (let step = 0; step < 8; step++) {
		const fill = projectedFill(bounds, placement, aspect);
		if (!Number.isFinite(fill)) {
			dist *= 2;
		} else {
			const ratio = fill / FRAME_FILL;
			if (Math.abs(ratio - 1) < 0.01) {
				break;
			}
			dist *= ratio;
		}
		placement = placeCamera(bounds, family, dist);
	}
	return placement;
}

/** Elevation angle (degrees, above the content's own horizontal plane) for a near-overhead ring view. */
const CAROUSEL_ELEVATION_DEG = 34;

/**
 * World-space Y offset for the camera above the content's own centroid.
 *
 * `cycleSpatial` (see `smartart-3d-spatial.ts`) flattens every node onto
 * `y = 0`, arranging them on a ring in the XZ plane. The default modest
 * elevation (a good three-quarter tilt for extruded-flat and receding-tree
 * content, which both keep real vertical extent) views that flat ring
 * almost edge-on: nodes on the far side of the ring sit almost directly
 * behind the near ones from the camera's angle, so the diagram reads as a
 * couple of overlapping shapes instead of the circle the 2D layout shows.
 * A steep, near-overhead elevation (expressed as a fixed angle, not a
 * fraction of `radius`, so it holds regardless of the radius/distance
 * ratio) opens the ring up into a readable circle, matching the 2D
 * cycle/radial layout's own top-down gestalt.
 */
export function cameraElevation(
	family: SmartArt3DModel['family'],
	radius: number,
	dist: number,
): number {
	if (family === 'cycle' || family === 'radial') {
		return dist * Math.tan((CAROUSEL_ELEVATION_DEG * Math.PI) / 180);
	}
	return radius * 0.3;
}

/**
 * Y-axis-only billboard: rotate every label plane to face the camera's
 * current azimuth, keeping the plane vertical (so captions never tilt or
 * flip upside down).
 *
 * A label's position floats just off its node's own (possibly rotated,
 * possibly radially-outward-facing) front face, but a plane rotated to
 * match that face is only readable when the camera happens to be roughly
 * in front of it. For a spatial/carousel arrangement (`cycleSpatial`),
 * that is true for at most the ~180 degrees of the ring facing the
 * camera, and only good for reading text within roughly +/-45 degrees of
 * dead-on; nodes further round the ring go edge-on (near-zero projected
 * width; `DoubleSide` on the material does not help, since that only
 * fixes a plane facing directly away, not sideways) or fully backward.
 * Re-orienting the plane itself toward the camera, every frame (so this
 * keeps working through an interactive orbit), makes every node's caption
 * legible regardless of which way its underlying block happens to face.
 */
export function billboardLabels(built: BuiltMeshGroup, camera: PerspectiveCamera): void {
	built.forEachLabelPlane((plane: Mesh) => {
		const dx = camera.position.x - plane.position.x;
		const dz = camera.position.z - plane.position.z;
		plane.rotation.set(0, Math.atan2(dx, dz), 0);
	});
}
