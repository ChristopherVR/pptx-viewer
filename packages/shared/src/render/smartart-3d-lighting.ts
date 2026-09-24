/**
 * Per-vertex shading for the lit SmartArt 3D solids (framework-agnostic,
 * pure).
 *
 * The three.js layer paints every lit surface unlit (`MeshBasicMaterial`)
 * and applies `colour * mul + add` from here, per vertex, in display (sRGB)
 * space. Normalising the diffuse term by the value of a surface facing the
 * viewer keeps a front face at exactly its authored fill (PowerPoint's own
 * exports show a flat face unchanged by every rig and material, see
 * `visual-3d-bevel-lighting.ts`), so only tilted surfaces (bevel bands,
 * extrusion walls, a whole diagram turned by a scene camera) change colour.
 *
 * Reuses the shared bevel tables: the key light's azimuth comes from
 * `getBevelHighlightDirection` (the COM-measured cardinal snap of
 * `a:lightRig/@dir`) and the material response from `getMaterialLighting`.
 * The elevation and ambient share were fitted against the SmartArt bevel
 * quick-style exports in `e2e/fixtures/three-d-parity/gt`.
 *
 * @module render/smartart-3d-lighting
 */
import type { SmartArt3DLighting } from './smartart-3d-solid-types';
import type { Vec3 } from './smartart-3d-types';
import { getBevelHighlightDirection } from './visual-3d-bevel-light';
import { getMaterialLighting } from './visual-3d-bevel-lighting-tables';

/** The resolved light for one solid: a key light plus a material response. */
export interface SmartArt3DLightModel {
	/** Unit vector toward the key (diffuse) light (diagram space: y-up, +z toward the viewer). */
	light: Vec3;
	/** Unit vector toward the light the specular highlight reflects (same azimuth, higher). */
	specularLight: Vec3;
	/** Share of the diffuse response that does not depend on the normal. */
	ambient: number;
	diffuse: number;
	specular: number;
	exponent: number;
	/**
	 * Linear per-channel factor the rig applies to every surface, including a
	 * face-on one (see {@link RIG_FACE_READING}).
	 */
	tint: [number, number, number];
}

/** A vertex's shading: display colour = `fill * mul + add` (per channel, 0..1). */
export interface SmartArt3DShade {
	mul: number;
	add: number;
}

/**
 * Key light elevation above the diagram plane, degrees. Low: the bevel
 * exports keep a surface facing away from the light close to the face colour
 * (Polished's bottom band) while a band tilted toward it doubles in
 * brightness (Polished's top band), which only a grazing key light gives.
 */
const KEY_ELEVATION_DEG = 5;
/** Elevation of the light the specular highlight reflects, degrees. */
const SPECULAR_ELEVATION_DEG = 60;
/** Ambient share of the diffuse response. */
const AMBIENT = 0.5;
/** Scales the material table's specular constant to this shading model. */
const SPECULAR_GAIN = 0.6;

const VIEW: Vec3 = { x: 0, y: 0, z: 1 };

/** The mid-grey reading every rig is measured against. */
const RIG_REFERENCE_GREY = 127;

/**
 * What a face-on `#7f7f7f` shape reads under a rig (sRGB 0..255). `morning`
 * is the COM measurement quoted in `visual-3d-bevel-lighting.ts`; `soft` is
 * read off the Bird's Eye Scene export (accent1 face, converted to the grey
 * equivalent in linear light, which also reproduces the `morning` export of
 * Sunset Scene). Rigs not listed leave a face-on surface at its fill, as
 * `flat` and `threePt` measure.
 */
const RIG_FACE_READING: Record<string, [number, number, number]> = {
	morning: [112, 108, 98],
	soft: [121, 121, 121],
};

function srgbChannelToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rigTint(rig: string | undefined): [number, number, number] {
	const reading = rig ? RIG_FACE_READING[rig] : undefined;
	if (!reading) {
		return [1, 1, 1];
	}
	const reference = srgbChannelToLinear(RIG_REFERENCE_GREY / 255);
	return reading.map((c) => srgbChannelToLinear(c / 255) / reference) as [number, number, number];
}

function dot(a: Vec3, b: Vec3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
	const len = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Resolve the light model for a rig and an `a:sp3d/@prstMaterial`. */
export function resolveSmartArt3DLightModel(
	lighting: SmartArt3DLighting | undefined,
	material: string | undefined,
): SmartArt3DLightModel {
	// CSS space (y-down) -> view space (y-up), then the rig's own revolution.
	const snap = getBevelHighlightDirection(lighting?.direction ?? 't');
	const rev = ((lighting?.revDeg ?? 0) * Math.PI) / 180;
	const ax = snap.dx;
	const ay = -snap.dy;
	const az = Math.hypot(ax, ay) || 1;
	const azX = (ax * Math.cos(rev) - ay * Math.sin(rev)) / az;
	const azY = (ax * Math.sin(rev) + ay * Math.cos(rev)) / az;
	const toward = (elevationDeg: number): Vec3 => {
		const elevation = (elevationDeg * Math.PI) / 180;
		return normalize({
			x: azX * Math.cos(elevation),
			y: azY * Math.cos(elevation),
			z: Math.sin(elevation),
		});
	};
	const response = getMaterialLighting(material);
	return {
		light: toward(KEY_ELEVATION_DEG),
		specularLight: toward(SPECULAR_ELEVATION_DEG),
		ambient: AMBIENT,
		diffuse: response.diffuseConstant,
		specular: response.specularConstant * SPECULAR_GAIN,
		exponent: response.specularExponent,
		tint: rigTint(lighting?.rig),
	};
}

/**
 * Shade one unit normal (diagram space).
 *
 * @param eye - unit direction from the surface point toward the camera. When
 *   omitted (a face-on, parallel view) the specular term is measured against a
 *   face-on surface, so a normal facing the viewer returns exactly
 *   `{ mul: 1, add: 0 }`. A perspective scene camera passes the real per-point
 *   direction instead, and its faces pick up the moving highlight a metal
 *   diagram shows in the Metallic Scene export.
 */
export function shadeSmartArt3DNormal(
	normal: Vec3,
	model: SmartArt3DLightModel,
	eye?: Vec3,
): SmartArt3DShade {
	const lambert = (n: Vec3): number =>
		model.ambient + model.diffuse * Math.max(0, dot(n, model.light));
	const mul = lambert(normal) / lambert(VIEW);
	const view = eye ?? VIEW;
	const half = normalize({
		x: model.specularLight.x + view.x,
		y: model.specularLight.y + view.y,
		z: model.specularLight.z + view.z,
	});
	const peak = (n: Vec3): number => Math.max(0, dot(n, half)) ** model.exponent;
	const add = model.specular * Math.max(0, peak(normal) - (eye ? 0 : peak(VIEW)));
	return { mul, add };
}
