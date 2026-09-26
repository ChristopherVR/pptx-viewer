/**
 * The specular lights of a SmartArt 3D light rig (framework-agnostic, pure).
 *
 * PowerPoint's `a:lightRig` presets are several directional lights, not one.
 * The single-light tables in `visual-3d-bevel-lighting-tables.ts` capture
 * what a rig does to a BEVEL (the key light's elevation and which edge it
 * lights); they say nothing about the other lights, which only show where a
 * specular material meets a changing view direction. A perspective scene
 * camera is exactly that case: every point of a flat face is seen from a
 * slightly different angle, so a metal face picks up the broad sweep of a
 * light the bevel campaign never saw (Metallic Scene: `threePt` + `metal`
 * under `perspectiveLeft`, bright at the diagram's top-left and fading to the
 * plain fill at its bottom-right).
 *
 * Under a perspective scene camera, each rig listed here replaces the default
 * highlight (one light above the key light's azimuth) with its own lights. A
 * parallel view keeps the default: the bevel constants in
 * `smartart-3d-lighting.ts` were fitted against the bevel quick styles with
 * that highlight, and the `threePt` light below over-brightens Inset's bevel
 * bands (every layout's Inset export regressed with it). Azimuths are relative to the key
 * light's (the snapped `a:lightRig/@dir` turned by the rig's `rev`),
 * counter-clockwise in diagram space; `intensity` scales the material's own
 * specular constant and `sharpness` its exponent.
 *
 * `threePt`'s highlight light was fitted to the Metallic Scene export
 * (`e2e/fixtures/three-d-parity/gt/sa-012.webp`): 838 face samples mapped
 * back onto the diagram plane through the fitted scene camera, Blinn lobe,
 * mean absolute error 2.3 (0-255) against a fill + white highlight. Adding
 * the default highlight to the fit gave it a zero weight, so the default is
 * replaced rather than kept.
 *
 * @module render/smartart-3d-light-rig
 */

/** One specular light of a rig. */
export interface SmartArt3DRigLight {
	/** Azimuth relative to the key light, degrees, counter-clockwise. */
	azimuthDeg: number;
	/** Elevation above the diagram plane, degrees. */
	elevationDeg: number;
	/** Multiplier on the material's specular constant. */
	intensity: number;
	/** Multiplier on the material's specular exponent. */
	sharpness: number;
}

/** Elevation of the default highlight light, degrees. */
const DEFAULT_HIGHLIGHT_ELEVATION_DEG = 60;

const DEFAULT_HIGHLIGHT: readonly SmartArt3DRigLight[] = [
	{ azimuthDeg: 0, elevationDeg: DEFAULT_HIGHLIGHT_ELEVATION_DEG, intensity: 1, sharpness: 1 },
];

/** Rigs whose specular lights are known (see the module doc). */
export const SMARTART_RIG_SPECULAR_LIGHTS: Record<string, readonly SmartArt3DRigLight[]> = {
	threePt: [{ azimuthDeg: 64, elevationDeg: 44, intensity: 4.6, sharpness: 3 }],
};

/**
 * The specular lights of a rig: its own under a perspective scene camera,
 * otherwise (or for a rig not listed) the default single highlight.
 */
export function smartArt3DRigSpecularLights(
	rig: string | undefined,
	perspective: boolean,
): readonly SmartArt3DRigLight[] {
	const own = perspective && rig ? SMARTART_RIG_SPECULAR_LIGHTS[rig] : undefined;
	return own ?? DEFAULT_HIGHLIGHT;
}

/** The key (diffuse) light of a rig, relative to the snapped `a:lightRig/@dir`. */
export interface SmartArt3DRigKeyLight {
	/** Azimuth relative to the key light's direction, degrees, counter-clockwise. */
	azimuthDeg: number;
	/** Elevation above the diagram plane, degrees. */
	elevationDeg: number;
}

/**
 * Key-light elevations under a scene camera, fitted per rig against the scene
 * quick styles' exports (whole-slide MAE over all eight layouts of each
 * style in `e2e/fixtures/three-d-parity/gt/`, sweeping the elevation):
 * `flat` (Brick Scene, isometric) 4.18 -> 3.94 at 40, `threePt` (Metallic
 * Scene) 3.89 -> 3.60 at 90, `morning` (Sunset Scene) 3.63 -> 3.53 at 60,
 * `soft` (Bird's Eye Scene) 3.69 -> 3.12 at 80. Under a parallel view the
 * grazing default stays: raising it made Polished (`flat`) and Cartoon
 * (`contrasting`) worse, because the bevel constants were fitted with it.
 */
export const SMARTART_RIG_SCENE_KEY_LIGHTS: Record<string, SmartArt3DRigKeyLight> = {
	flat: { azimuthDeg: 0, elevationDeg: 40 },
	threePt: { azimuthDeg: 0, elevationDeg: 90 },
	morning: { azimuthDeg: 0, elevationDeg: 60 },
	soft: { azimuthDeg: 0, elevationDeg: 80 },
};

/**
 * A rig's own key light under a scene camera, or `undefined` for the default
 * (a grazing light from `@dir`, fitted against the bevel quick styles).
 */
export function smartArt3DRigKeyLight(
	rig: string | undefined,
	sceneCamera: boolean,
): SmartArt3DRigKeyLight | undefined {
	return sceneCamera && rig ? SMARTART_RIG_SCENE_KEY_LIGHTS[rig] : undefined;
}
