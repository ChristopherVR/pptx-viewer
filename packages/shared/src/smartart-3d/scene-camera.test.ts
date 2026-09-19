/**
 * `contentSphere` / `cameraElevation` / `billboardLabels` tests.
 *
 * Regression coverage for three SmartArt 3D framing defects reported against
 * inserted list/cycle diagrams:
 *
 * 1. A wide, flat node's world-space bounding radius was computed as
 *    `max(halfWidth, halfHeight) + depth + bevel` and applied uniformly to
 *    every world axis, so the (tiny) extrusion depth got inflated by the
 *    (large) footprint on every axis, including the through-face one. That
 *    pushed the fit-to-frame camera much farther back than the content
 *    warranted, so list/cycle diagrams rendered at a small fraction of
 *    their frame. `contentSphere` now reprojects each mesh's local
 *    half-extents through its own Y rotation, so a flat mesh's Z extent is
 *    tied to its depth, not its footprint.
 * 2. `cycleSpatial` flattens every cycle/radial node onto `y = 0` (a ring in
 *    the XZ plane); the previous fixed, shallow camera elevation viewed
 *    that ring almost edge-on, collapsing most nodes behind the front one.
 *    `cameraElevation` now uses a steep, angle-based elevation for
 *    cycle/radial content specifically.
 * 3. Even with a steeper elevation, a label plane that merely followed its
 *    node's own rotation was only readable for nodes roughly facing the
 *    camera; nodes elsewhere around the ring (their front face edge-on, or
 *    facing away, to the camera) rendered no legible caption at all
 *    ("other nodes' labels missing entirely"). `billboardLabels` rotates
 *    every label toward the camera every frame instead.
 *
 * No WebGL context is exercised here (`mountSmartArt3D` itself needs a real
 * `WebGLRenderer`, covered by the bindings' own mount tests, which mock this
 * module entirely); these are pure-math unit tests of the helpers, using
 * real (non-WebGL) `three` math/object classes for `billboardLabels`.
 */
import { Mesh, PerspectiveCamera } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { SmartArt3DMesh, SmartArt3DModel } from '../render/smartart-3d-types';
import type { BuiltMeshGroup } from './meshes';
import {
	billboardLabels,
	cameraElevation,
	contentSphere,
	fitCamera,
	FOV,
	frameDistance,
	placeCamera,
} from './scene-camera';

function mesh(overrides: Partial<SmartArt3DMesh> = {}): SmartArt3DMesh {
	return {
		id: 'n',
		outline: [],
		rounded: false,
		depth: 4,
		bevel: 0,
		fill: '#4472C4',
		stroke: '#333333',
		strokeWidth: 1,
		opacity: 1,
		position: { x: 0, y: 0, z: 0 },
		rotation: { x: 0, y: 0, z: 0 },
		text: '',
		textColor: '#ffffff',
		fontSize: 12,
		halfWidth: 10,
		halfHeight: 10,
		...overrides,
	};
}

function model(meshes: SmartArt3DMesh[], family?: SmartArt3DModel['family']): SmartArt3DModel {
	return { meshes, connectors: [], bounds: { width: 100, height: 100 }, family };
}

describe('contentSphere', () => {
	it('ties a flat, unrotated mesh through-face (Z) extent to its depth, not its footprint', () => {
		// A wide, flat block (halfWidth 100 >> halfHeight 10 >> depth 10), like a
		// "list" item: the previous formula used `max(halfWidth, halfHeight) +
		// depth + bevel` (110) as a single radius applied to every axis,
		// including Z, wildly overstating the through-face extent. Here the true
		// bounding-sphere half-diagonal is hypot(100, 10, 5) ~= 100.6.
		const m = mesh({ halfWidth: 100, halfHeight: 10, depth: 10, bevel: 0 });
		const { radius } = contentSphere(model([m]));
		expect(radius).toBeGreaterThan(95);
		expect(radius).toBeLessThan(110);
	});

	it('matches a worked "3-item stacked list" example: occupancy recovers from ~53% radius inflation', () => {
		// Concrete numbers modelled on a 600x340 3-item Basic Block List (see the
		// task's reported defect): three wide, flat rows stacked in Y.
		const row = (y: number): SmartArt3DMesh =>
			mesh({ halfWidth: 290, halfHeight: 52, depth: 37, bevel: 7, position: { x: 0, y, z: 0 } });
		const stacked = model([row(-110), row(0), row(110)]);
		const { radius } = contentSphere(stacked);
		// The previous (buggy) formula produced a radius of ~648 for this exact
		// layout (hand-derived); the fix must shrink it substantially so the
		// camera frames the content close to its true size.
		expect(radius).toBeLessThan(648 * 0.6);
		expect(radius).toBeGreaterThan(300);
		expect(radius).toBeLessThan(380);
	});

	it('reprojects a rotated mesh footprint into Z instead of leaving it on X', () => {
		// Two wide, flat, unrotated blocks straddling the X axis: their footprint
		// (half-width 50) dominates the X extent, depth (half-extent 2) the Z.
		const flat = (x: number): SmartArt3DMesh =>
			mesh({ halfWidth: 50, halfHeight: 5, depth: 4, bevel: 0, position: { x, y: 0, z: 0 } });
		const unrotated = contentSphere(model([flat(100), flat(-100)]));

		// The same two blocks, each rotated 90 degrees about Y (as `cycleSpatial`
		// rotates ring nodes to face outward): their footprint now projects onto
		// Z, and only their (small) depth remains on X.
		const rotated90 = (x: number): SmartArt3DMesh =>
			mesh({
				halfWidth: 50,
				halfHeight: 5,
				depth: 4,
				bevel: 0,
				position: { x, y: 0, z: 0 },
				rotation: { x: 0, y: Math.PI / 2, z: 0 },
			});
		const rotated = contentSphere(model([rotated90(100), rotated90(-100)]));

		// A rotation-blind implementation (always projecting footprint onto X)
		// would compute the identical radius for both arrangements; a correct,
		// rotation-aware one must not, because the 90-degree case's world X
		// extent collapses to just the (small) depth while its Z extent grows to
		// the (large) footprint.
		expect(rotated.radius).toBeLessThan(unrotated.radius * 0.85);
	});

	it('falls back to a bounds-derived radius for an empty model instead of throwing', () => {
		const { radius, cx, cy, cz } = contentSphere(model([], 'list'));
		expect(radius).toBeGreaterThan(0);
		expect(cx).toBe(0);
		expect(cy).toBe(0);
		expect(cz).toBe(0);
	});
});

describe('cameraElevation', () => {
	it('uses a steep, angle-based elevation for cycle/radial content regardless of the radius/distance ratio', () => {
		const radius = 50;
		const dist = 300;
		const cycle = cameraElevation('cycle', radius, dist);
		const radial = cameraElevation('radial', radius, dist);
		const list = cameraElevation('list', radius, dist);
		// tan(34deg) ~= 0.6745
		expect(cycle).toBeCloseTo(dist * Math.tan((34 * Math.PI) / 180), 5);
		expect(radial).toBeCloseTo(cycle, 10);
		// The non-carousel formula is a fraction of `radius`, independent of `dist`.
		expect(list).toBeCloseTo(radius * 0.3, 10);
	});

	it('gives cycle/radial a much steeper elevation than the default when the ring is flat (small radius, large distance)', () => {
		// `cycleSpatial` flattens ring content onto y = 0, so the bounding
		// sphere's radius is dominated by the ring's horizontal spread while the
		// camera sits much farther back (`dist`). Under the old fixed-fraction
		// formula (`radius * 0.3`), that combination degenerates to a nearly
		// edge-on view; the angle-based elevation must not.
		const radius = 80;
		const dist = 400;
		const carousel = cameraElevation('cycle', radius, dist);
		const nonCarousel = cameraElevation(undefined, radius, dist);
		expect(carousel).toBeGreaterThan(nonCarousel * 3);
	});
});

describe('frameDistance', () => {
	it('grows with radius and shrinks the sphere back to fit the same angular size', () => {
		const aspect = 16 / 9;
		const small = frameDistance(10, aspect);
		const large = frameDistance(20, aspect);
		expect(large).toBeCloseTo(small * 2, 5);
	});
});

describe('fitCamera', () => {
	/** The 600x340 3-item Basic Block List from the reported defect. */
	const stackedList = (): SmartArt3DModel => {
		const row = (y: number): SmartArt3DMesh =>
			mesh({ halfWidth: 290, halfHeight: 52, depth: 37, bevel: 7, position: { x: 0, y, z: 0 } });
		return model([row(-110), row(0), row(110)], 'list');
	};

	/**
	 * Projected half-width / half-height of the content box, as fractions of
	 * the frame's half-extents, from a placement (a standalone re-derivation of
	 * the projection the fitter uses, kept simple: it only walks the 8 corners).
	 */
	function projectedExtents(
		bounds: ReturnType<typeof contentSphere>,
		placement: { position: [number, number, number]; target: [number, number, number] },
		aspect: number,
	): { x: number; y: number } {
		const tanV = Math.tan((FOV * Math.PI) / 360);
		const tanH = tanV * aspect;
		const [px, py, pz] = placement.position;
		const f = [bounds.cx - px, bounds.cy - py, bounds.cz - pz];
		const fl = Math.hypot(...f);
		const fw = f.map((v) => v / fl);
		const r = [-fw[2], 0, fw[0]];
		const rl = Math.hypot(...r);
		const rt = r.map((v) => v / rl);
		const up = [
			rt[1] * fw[2] - rt[2] * fw[1],
			rt[2] * fw[0] - rt[0] * fw[2],
			rt[0] * fw[1] - rt[1] * fw[0],
		];
		let x = 0;
		let y = 0;
		for (const sx of [-1, 1]) {
			for (const sy of [-1, 1]) {
				for (const sz of [-1, 1]) {
					const d = [
						bounds.cx + sx * bounds.halfW - px,
						bounds.cy + sy * bounds.halfH - py,
						bounds.cz + sz * bounds.halfD - pz,
					];
					const depth = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
					x = Math.max(x, Math.abs(d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2]) / (depth * tanH));
					y = Math.max(y, Math.abs(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (depth * tanV));
				}
			}
		}
		return { x, y };
	}

	it('fills a wide 600x340 frame with a wide, flat list instead of the ~45% the sphere fit gave', () => {
		const aspect = 600 / 340;
		const bounds = contentSphere(stackedList());
		const sphereOnly = placeCamera(bounds, 'list', frameDistance(bounds.radius, aspect));
		const fitted = fitCamera(bounds, 'list', aspect);

		const before = projectedExtents(bounds, sphereOnly, aspect);
		const after = projectedExtents(bounds, fitted, aspect);
		// The sphere fit leaves the wide diagram well under half the frame width.
		expect(before.x).toBeLessThan(0.55);
		// The box fit brings the tightest axis up to ~FRAME_FILL (0.92) ...
		expect(Math.max(after.x, after.y)).toBeGreaterThan(0.88);
		// ... without overflowing the frame on either axis.
		expect(after.x).toBeLessThanOrEqual(0.95);
		expect(after.y).toBeLessThanOrEqual(0.95);
		expect(fitted.dist).toBeLessThan(sphereOnly.dist);
	});

	it('keeps a flat cycle ring inside the frame under its steep elevation', () => {
		// Four ring nodes flattened onto y = 0 (as `cycleSpatial` lays them out),
		// spread across X/Z: the steep carousel elevation projects the ring's Z
		// spread into frame height, which a naive front-on fit would ignore.
		const ring = (x: number, z: number, rotY: number): SmartArt3DMesh =>
			mesh({
				halfWidth: 60,
				halfHeight: 40,
				depth: 20,
				position: { x, y: 0, z },
				rotation: { x: 0, y: rotY, z: 0 },
			});
		const cycle = model(
			[
				ring(0, -150, 0),
				ring(150, 0, Math.PI / 2),
				ring(0, 150, Math.PI),
				ring(-150, 0, -Math.PI / 2),
			],
			'cycle',
		);
		const aspect = 16 / 9;
		const bounds = contentSphere(cycle);
		const fitted = fitCamera(bounds, 'cycle', aspect);
		const after = projectedExtents(bounds, fitted, aspect);
		expect(Math.max(after.x, after.y)).toBeGreaterThan(0.85);
		expect(after.x).toBeLessThanOrEqual(0.95);
		expect(after.y).toBeLessThanOrEqual(0.95);
	});

	it('reports the AABB half-extents alongside the sphere', () => {
		const bounds = contentSphere(stackedList());
		expect(bounds.halfW).toBeCloseTo(297, 5);
		expect(bounds.halfH).toBeCloseTo(110 + 52 + 7, 5);
		expect(bounds.halfD).toBeCloseTo(37 / 2 + 7, 5);
	});
});

describe('billboardLabels', () => {
	/** A `BuiltMeshGroup` stub exposing exactly the planes given. */
	function stubGroup(planes: Mesh[]): BuiltMeshGroup {
		return {
			group: undefined as never,
			setTextStyle: vi.fn(),
			forEachLabelPlane: (fn) => planes.forEach(fn),
			dispose: vi.fn(),
		};
	}

	it("rotates a label to face the camera azimuth, ignoring the label's own prior rotation", () => {
		const plane = new Mesh();
		plane.position.set(0, 0, 0);
		// Pre-rotated as if it were still following its (radially outward,
		// away from the camera) node face - billboarding must override this.
		plane.rotation.set(0.4, Math.PI, -0.2);
		const camera = new PerspectiveCamera();
		camera.position.set(0, 50, 100);

		billboardLabels(stubGroup([plane]), camera);

		// Facing the camera from the origin means yaw = atan2(dx, dz) with the
		// camera at (0, 50, 100): atan2(0, 100) = 0. Pitch/roll must be zeroed
		// (Y-axis-only billboard: the caption stays upright).
		expect(plane.rotation.x).toBeCloseTo(0, 10);
		expect(plane.rotation.y).toBeCloseTo(0, 10);
		expect(plane.rotation.z).toBeCloseTo(0, 10);
	});

	it('faces a plane on the +X side of the ring toward a camera sitting on +Z', () => {
		const plane = new Mesh();
		plane.position.set(100, 0, 0);
		const camera = new PerspectiveCamera();
		camera.position.set(0, 30, 300);

		billboardLabels(stubGroup([plane]), camera);

		const expectedYaw = Math.atan2(0 - 100, 300 - 0);
		expect(plane.rotation.y).toBeCloseTo(expectedYaw, 10);
		// A non-trivial azimuth: this is the exact "left/right ring node" case
		// that a face-following (non-billboarded) label left edge-on to the
		// camera.
		expect(Math.abs(plane.rotation.y)).toBeGreaterThan(0.2);
	});

	it('visits every plane `forEachLabelPlane` yields', () => {
		const planes = [new Mesh(), new Mesh(), new Mesh()];
		const forEachLabelPlane = vi.fn((fn: (p: Mesh) => void) => planes.forEach(fn));
		const camera = new PerspectiveCamera();
		billboardLabels(
			{ group: undefined as never, setTextStyle: vi.fn(), forEachLabelPlane, dispose: vi.fn() },
			camera,
		);
		expect(forEachLabelPlane).toHaveBeenCalledOnce();
	});
});
