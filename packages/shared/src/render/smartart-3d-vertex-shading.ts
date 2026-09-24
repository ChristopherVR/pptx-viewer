/**
 * Per-vertex colour factors for a lit SmartArt 3D solid (framework-agnostic,
 * pure).
 *
 * The three.js layer paints a solid with `MeshBasicMaterial` (base colour or
 * gradient map) times a per-vertex colour. This module computes that vertex
 * colour so the displayed (sRGB) result is `base * mul + add` from
 * `shadeSmartArt3DNormal`, with the division done in linear space because
 * three multiplies linear values.
 *
 * @module render/smartart-3d-vertex-shading
 */
import type { SmartArt3DLightModel } from './smartart-3d-lighting';
import { shadeSmartArt3DNormal } from './smartart-3d-lighting';
import type { Point2, Vec3 } from './smartart-3d-types';

/** An sRGB colour, channels 0..1. */
export type Rgb = [number, number, number];

/** sRGB channel (0..1) -> linear. */
export function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** `#rrggbb` -> sRGB channels 0..1 (black when unparsable). */
export function hexToRgb(hex: string): Rgb {
	const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
	if (!match) {
		return [0, 0, 0];
	}
	const n = Number.parseInt(match[1], 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function normalizeVec(v: Vec3): Vec3 {
	const len = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Floor for a base channel, so the linear ratio stays finite on black. */
const MIN_LINEAR = 1e-4;

/**
 * Vertex colours (3 floats per vertex, linear factors) for a triangle list.
 *
 * @param positions - mesh-local xyz per vertex.
 * @param normals - mesh-local unit normals per vertex.
 * @param baseAt - the sRGB base colour painted at a mesh-local point.
 * @param eye - camera position in mesh-local space, for a perspective scene
 *   camera; omitted for a parallel view.
 *
 * The light is fixed to the diagram, not the camera: a scene camera turning
 * the diagram does not relight its faces (the scene-style exports keep every
 * face at the same colour however far it is turned).
 */
export function shadeSmartArt3DVertices(
	positions: readonly number[],
	normals: readonly number[],
	baseAt: (p: Point2) => Rgb,
	model: SmartArt3DLightModel,
	eye?: Vec3,
): Float32Array {
	const out = new Float32Array(positions.length);
	for (let i = 0; i < positions.length; i += 3) {
		const normal = { x: normals[i], y: normals[i + 1], z: normals[i + 2] };
		const toEye = eye
			? normalizeVec({
					x: eye.x - positions[i],
					y: eye.y - positions[i + 1],
					z: eye.z - positions[i + 2],
				})
			: undefined;
		const { mul, add } = shadeSmartArt3DNormal(normal, model, toEye);
		const base = baseAt({ x: positions[i], y: positions[i + 1] });
		for (let c = 0; c < 3; c++) {
			const target = Math.min(1, Math.max(0, base[c] * mul + add));
			const linBase = Math.max(MIN_LINEAR, srgbToLinear(base[c]));
			out[i + c] = (srgbToLinear(target) / linBase) * model.tint[c];
		}
	}
	return out;
}
