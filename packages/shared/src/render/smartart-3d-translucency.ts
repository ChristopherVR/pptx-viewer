/**
 * Translucent lit SmartArt solids (framework-agnostic, pure).
 *
 * Basic Venn caches its circles as `accent1` at `a:alpha 50000`, and every
 * bevel / scene quick style keeps that alpha on the solid. PowerPoint blends
 * each solid ONCE: a face-on circle of Polished, Brick or Sunset reads exactly
 * the 50% blend of the flat style (`#89afc0` over white, `gt/sa-076.webp`),
 * and an overlap reads two layers (75%). Painting every surface of the solid
 * translucently (front cap, back cap and bevel bands all stacked) read 75% on
 * a single circle, so the three.js layer culls the surfaces facing away from
 * the camera; {@link orientSmartArt3DTriangles} makes each triangle's winding
 * agree with its shading normal so that culling is by the normal the lighting
 * already uses.
 *
 * `clear` (`a:sp3d/@prstMaterial`, Venn's Cartoon and Metallic Scene) is a
 * glass: a face-on surface keeps a fifth of its fill's alpha (the Cartoon
 * export reads a 50% circle as a 10% blend, `#e8eef2`, and its overlap as the
 * 19% of two such layers), while a surface tilted away from the view grows
 * denser, up to past the fill's own alpha at the silhouette (the Cartoon
 * bevel band reads a 59-66% blend next to the outline).
 * {@link smartArt3DSurfaceAlpha} is that curve.
 *
 * @module render/smartart-3d-translucency
 */
import type { SmartArt3DLightModel } from './smartart-3d-lighting';
import type { SolidTriangles } from './smartart-3d-solid-geometry';
import type { SmartArt3DMesh, Vec3 } from './smartart-3d-types';

/** Share of the fill alpha a face-on `clear` surface keeps. */
const CLEAR_FACE_ALPHA = 0.2;
/** How much denser a `clear` surface gets as it turns edge-on. */
const CLEAR_EDGE_GAIN = 2;
/** Falloff exponent of that growth in `1 - n.v`. */
const CLEAR_EDGE_EXPONENT = 1;

/** Whether a material paints its fill as a see-through glass. */
export function isSmartArt3DGlassMaterial(material: string | undefined): boolean {
	return material === 'clear';
}

/**
 * The alpha to paint a surface at.
 *
 * @param opacity - the fill's own alpha (1 for an opaque fill).
 * @param facing - cosine between the surface normal and the view direction
 *   (1 face-on, 0 edge-on).
 */
export function smartArt3DSurfaceAlpha(
	material: string | undefined,
	opacity: number,
	facing: number,
): number {
	if (!isSmartArt3DGlassMaterial(material)) {
		return opacity;
	}
	const tilt = 1 - Math.max(0, Math.min(1, facing));
	const share = CLEAR_FACE_ALPHA + CLEAR_EDGE_GAIN * tilt ** CLEAR_EDGE_EXPONENT;
	return Math.max(0, Math.min(1, opacity * share));
}

/**
 * Per-vertex alphas for a triangle list, from each vertex normal against the
 * view (the direction to `eye` under a perspective camera, else `+z`).
 */
export function smartArt3DVertexAlphas(
	positions: readonly number[],
	normals: readonly number[],
	material: string | undefined,
	opacity: number,
	eye?: Vec3,
): Float32Array {
	const out = new Float32Array(positions.length / 3);
	for (let i = 0, v = 0; i < positions.length; i += 3, v++) {
		let view: Vec3 = { x: 0, y: 0, z: 1 };
		if (eye) {
			const dx = eye.x - positions[i];
			const dy = eye.y - positions[i + 1];
			const dz = eye.z - positions[i + 2];
			const len = Math.hypot(dx, dy, dz) || 1;
			view = { x: dx / len, y: dy / len, z: dz / len };
		}
		const facing = normals[i] * view.x + normals[i + 1] * view.y + normals[i + 2] * view.z;
		out[v] = smartArt3DSurfaceAlpha(material, opacity, facing);
	}
	return out;
}

/**
 * Flip every triangle whose winding disagrees with its (averaged) shading
 * normal, in place, so counter-clockwise winding means "faces along the
 * normal" and back-face culling hides exactly the surfaces facing away.
 */
export function orientSmartArt3DTriangles(triangles: SolidTriangles): void {
	const { positions: p, normals: n } = triangles;
	for (let t = 0; t + 9 <= p.length; t += 9) {
		const ux = p[t + 3] - p[t];
		const uy = p[t + 4] - p[t + 1];
		const uz = p[t + 5] - p[t + 2];
		const vx = p[t + 6] - p[t];
		const vy = p[t + 7] - p[t + 1];
		const vz = p[t + 8] - p[t + 2];
		const cx = uy * vz - uz * vy;
		const cy = uz * vx - ux * vz;
		const cz = ux * vy - uy * vx;
		const nx = n[t] + n[t + 3] + n[t + 6];
		const ny = n[t + 1] + n[t + 4] + n[t + 7];
		const nz = n[t + 2] + n[t + 5] + n[t + 8];
		if (cx * nx + cy * ny + cz * nz < 0) {
			for (const arr of [p, n]) {
				for (let c = 0; c < 3; c++) {
					const b = arr[t + 3 + c];
					arr[t + 3 + c] = arr[t + 6 + c];
					arr[t + 6 + c] = b;
				}
			}
		}
	}
}

/** Whether a lit mesh is see-through (a fill alpha below 1 or a glass material). */
export function isSmartArt3DTranslucentMesh(mesh: SmartArt3DMesh): boolean {
	return !mesh.fillNone && (mesh.opacity < 1 || isSmartArt3DGlassMaterial(mesh.solid?.material));
}

/**
 * The light model a glass surface is painted with: its fill, unlit (only the
 * rig's face tint stays). The Cartoon export's bevel band is the plain fill
 * made denser toward the silhouette (`#456c7a` at the rim over white, the
 * fill at full alpha), with none of the brightening an opaque bevel band
 * gets from the key light; the alpha ramp alone draws it.
 */
export function smartArt3DGlassLightModel(model: SmartArt3DLightModel): SmartArt3DLightModel {
	return { ...model, ambient: 1, diffuse: 0 };
}
