/**
 * Geometry for one lit SmartArt 3D solid: bevel bands, extrusion walls,
 * contour rim and the caps to triangulate (framework-agnostic, pure; the
 * three.js layer only triangulates the caps and uploads the arrays).
 *
 * Layout along z (mesh-local, the front face at `z = 0`, facing +z):
 *
 * ```
 *  0                      front cap (the outline inset by bevelT.w)
 *  0 .. -bevelT.h         top bevel band, outline -> inset
 *  .. -extrusion          side walls on the outline
 *  .. -bevelB.h           bottom bevel band, outline -> inset (back cap)
 * ```
 *
 * The contour (`a:sp3d/@contourW`) is a flat rim `contourW` wide around the
 * outline, at the front shoulder and at the back: the Brick Scene export
 * shows it as a thin line along the front edge and along the far end of the
 * extrusion walls, with the walls themselves in the extrusion colour.
 *
 * @module render/smartart-3d-solid-geometry
 */
import type { BevelProfilePoint } from './smartart-3d-bevel-profile';
import { getSmartArtBevelProfile } from './smartart-3d-bevel-profile';
import { offsetRing, ringShadingNormals, toCcwRing } from './smartart-3d-ring';
import type { SmartArt3DBevel, SmartArt3DSolid } from './smartart-3d-solid-types';
import type { Point2 } from './smartart-3d-types';

/** A triangle list: 9 floats (3 xyz vertices) per triangle, normals alike. */
export interface SolidTriangles {
	positions: number[];
	normals: number[];
}

/** A planar cap to triangulate (outer ring + holes) at depth `z`. */
export interface SolidCap {
	ring: Point2[];
	holes: Point2[][];
	z: number;
	/** +1: faces the viewer (front), -1: faces away (back). */
	facing: 1 | -1;
}

/** Everything the three.js layer needs to build one solid. */
export interface SmartArt3DSolidGeometry {
	/** Bevel bands, painted with the shape's fill. */
	body: SolidTriangles;
	/** Extrusion walls, painted with the extrusion colour. */
	sides: SolidTriangles;
	frontCap: SolidCap;
	/** Back cap (extrusion colour), when the solid has any depth. */
	backCap?: SolidCap;
	/** Contour rims (front and back annuli, contour colour). */
	contourCaps: SolidCap[];
}

/** Contour rims sit this far in front of the plane they ring, so they win the depth test. */
const CONTOUR_Z_LIFT = 0.05;
/** Slope used for a vertical profile segment (an outward, horizontal normal). */
const VERTICAL_SLOPE = 1e3;

function emptyTriangles(): SolidTriangles {
	return { positions: [], normals: [] };
}

function pushVertex(out: SolidTriangles, p: Point2, z: number, n: [number, number, number]): void {
	out.positions.push(p.x, p.y, z);
	out.normals.push(n[0], n[1], n[2]);
}

function normalize(x: number, y: number, z: number): [number, number, number] {
	const len = Math.hypot(x, y, z) || 1;
	return [x / len, y / len, z / len];
}

/** Push the two triangles of quad `a b c d` (in order around the quad). */
function pushQuad(
	out: SolidTriangles,
	corners: Array<{ p: Point2; z: number; n: [number, number, number] }>,
): void {
	const [a, b, c, d] = corners;
	for (const v of [a, b, c, a, c, d]) {
		pushVertex(out, v.p, v.z, v.n);
	}
}

/**
 * A bevel band from `ring` (at `zOuter`) inward to `ring` inset by the bevel
 * width, rising by the bevel height toward `facing` (+1 front, -1 back).
 * Returns the band's inner ring.
 */
function addBand(
	out: SolidTriangles,
	ring: Point2[],
	bevel: SmartArt3DBevel,
	zOuter: number,
	facing: 1 | -1,
): Point2[] {
	const profile: BevelProfilePoint[] = getSmartArtBevelProfile(bevel.profile);
	const rings = profile.map((pt) => offsetRing(ring, bevel.width * pt.s));
	const shading = ringShadingNormals(ring);
	const n = ring.length;
	for (let k = 0; k < profile.length - 1; k++) {
		const ds = profile[k + 1].s - profile[k].s;
		const dt = profile[k + 1].t - profile[k].t;
		const slope =
			Math.abs(ds) < 1e-6
				? Math.sign(dt || 1) * VERTICAL_SLOPE
				: (bevel.height * dt) / (bevel.width * ds);
		const z0 = zOuter + facing * bevel.height * profile[k].t;
		const z1 = zOuter + facing * bevel.height * profile[k + 1].t;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			const [mi, mj] = shading[i];
			const ni = normalize(-slope * mi.x, -slope * mi.y, facing);
			const nj = normalize(-slope * mj.x, -slope * mj.y, facing);
			pushQuad(out, [
				{ p: rings[k][i], z: z0, n: ni },
				{ p: rings[k][j], z: z0, n: nj },
				{ p: rings[k + 1][j], z: z1, n: nj },
				{ p: rings[k + 1][i], z: z1, n: ni },
			]);
		}
	}
	return rings[rings.length - 1];
}

/** Vertical walls around `ring` from `zTop` down to `zBottom`, facing outward. */
function addWalls(out: SolidTriangles, ring: Point2[], zTop: number, zBottom: number): void {
	if (zTop - zBottom <= 0) {
		return;
	}
	const shading = ringShadingNormals(ring);
	const n = ring.length;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		const [mi, mj] = shading[i];
		const ni = normalize(-mi.x, -mi.y, 0);
		const nj = normalize(-mj.x, -mj.y, 0);
		pushQuad(out, [
			{ p: ring[i], z: zTop, n: ni },
			{ p: ring[j], z: zTop, n: nj },
			{ p: ring[j], z: zBottom, n: nj },
			{ p: ring[i], z: zBottom, n: ni },
		]);
	}
}

/**
 * Build the geometry for one solid from its mesh-local outline (and holes,
 * which are cut from the caps but not bevelled).
 */
export function buildSmartArt3DSolidGeometry(
	outline: readonly Point2[],
	holes: readonly Point2[][],
	solid: SmartArt3DSolid,
): SmartArt3DSolidGeometry {
	const ring = toCcwRing(outline);
	const body = emptyTriangles();
	const sides = emptyTriangles();
	const topHeight = solid.bevelTop?.height ?? 0;
	const zShoulder = -topHeight;
	const zBackShoulder = zShoulder - solid.extrusion;
	const backHeight = solid.bevelBottom?.height ?? 0;
	const zBack = zBackShoulder - backHeight;
	const holeRings = holes.map((hole) => toCcwRing(hole)).filter((hole) => hole.length >= 3);

	const frontRing = solid.bevelTop ? addBand(body, ring, solid.bevelTop, zShoulder, 1) : ring;
	addWalls(sides, ring, zShoulder, zBackShoulder);
	const hasDepth = zBack < 0;
	const backRing =
		hasDepth && solid.bevelBottom
			? addBand(sides, ring, solid.bevelBottom, zBackShoulder, -1)
			: ring;

	const contourCaps: SolidCap[] = [];
	if (solid.contourWidth > 0) {
		const rim = offsetRing(ring, -solid.contourWidth);
		const inner = [...ring].reverse();
		contourCaps.push({ ring: rim, holes: [inner], z: zShoulder + CONTOUR_Z_LIFT, facing: 1 });
		if (hasDepth) {
			contourCaps.push({ ring: rim, holes: [inner], z: zBack - CONTOUR_Z_LIFT, facing: -1 });
		}
	}

	return {
		body,
		sides,
		frontCap: { ring: frontRing, holes: holeRings, z: 0, facing: 1 },
		...(hasDepth ? { backCap: { ring: backRing, holes: holeRings, z: zBack, facing: -1 } } : {}),
		contourCaps,
	};
}
