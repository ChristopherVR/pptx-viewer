/**
 * CSS approximation of OOXML 3D material presets (framework-agnostic).
 *
 * Since a DOM-based renderer cannot use Three.js, material properties
 * (roughness, metalness, transparency) are approximated with CSS filters,
 * box-shadow variations, opacity and gradient overlays. Moved here verbatim
 * from React's `material-presets.ts` so every binding shares one source of
 * truth; the React/Vue/Angular layers re-export these.
 *
 * Each material maps to:
 * - `filter`: brightness, contrast, saturate, sepia adjustments
 * - `boxShadow`: inset specular highlight simulation
 * - `opacity`: transparency for translucent materials
 * - `backgroundImage`: gradient overlay for specular/environment reflections
 * - `mixBlendMode`: optional blend mode token for the fill overlay
 *
 * @module render/visual-3d-materials
 */

import type { MaterialPresetType } from 'pptx-viewer-core';

/** CSS overrides that approximate an OOXML 3D material preset. */
export interface MaterialCssOverrides {
	/** Extra CSS filter chain to append (e.g. "brightness(1.1) saturate(1.2)"). */
	filter?: string;
	/** Opacity override (0–1). */
	opacity?: number;
	/** Extra box-shadow to layer for specular highlight simulation. */
	boxShadow?: string;
	/**
	 * Blend mode for fill overlay. Framework-neutral string token (e.g.
	 * "normal", "multiply"); bindings cast it to their own CSS type.
	 */
	mixBlendMode?: string;
	/** Gradient overlay for specular/environment simulation. */
	backgroundImage?: string;
}

const MATERIAL_MAP: Record<MaterialPresetType, MaterialCssOverrides> = {
	matte: {
		filter: 'brightness(0.95) saturate(0.9)',
		// Matte: very subtle top-to-bottom gradient for diffuse light falloff
		backgroundImage:
			'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%, rgba(0,0,0,0.03) 100%)',
	},
	warmMatte: {
		filter: 'brightness(1.0) saturate(0.85) sepia(0.08)',
		// Warm matte: slight warm-toned gradient falloff
		backgroundImage:
			'linear-gradient(180deg, rgba(255,240,220,0.06) 0%, transparent 50%, rgba(0,0,0,0.03) 100%)',
	},
	plastic: {
		filter: 'brightness(1.05) contrast(1.05)',
		// Plastic: bright specular highlight spot on upper-left, subtle rim
		boxShadow:
			'inset -2px -2px 6px rgba(255,255,255,0.35), inset 1px 1px 3px rgba(255,255,255,0.15)',
		backgroundImage:
			'radial-gradient(ellipse 40% 30% at 25% 20%, rgba(255,255,255,0.18) 0%, transparent 70%)',
	},
	metal: {
		filter: 'brightness(1.1) contrast(1.15) saturate(1.2)',
		// Metal: strong directional specular band, edge-lit contour
		boxShadow:
			'inset -3px -3px 8px rgba(255,255,255,0.45), inset 2px 2px 4px rgba(255,255,255,0.2), inset 0 0 2px rgba(0,0,0,0.15)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 20%, transparent 45%, rgba(0,0,0,0.06) 75%, rgba(255,255,255,0.1) 100%)',
	},
	dkEdge: {
		filter: 'brightness(0.85) contrast(1.2)',
		// Dark edge: darkened perimeter with subtle interior light
		boxShadow: 'inset 0 0 8px rgba(0,0,0,0.2), inset 0 0 2px rgba(0,0,0,0.1)',
		backgroundImage:
			'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
	},
	softEdge: {
		filter: 'brightness(1.05) contrast(0.9)',
		// Soft edge: gentle highlight falloff from center
		backgroundImage:
			'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 60%)',
	},
	flat: {},
	softmetal: {
		filter: 'brightness(1.05) contrast(1.08) saturate(1.1)',
		// Soft metal: softer version of metal with broader specular
		boxShadow:
			'inset -2px -2px 6px rgba(255,255,255,0.3), inset 1px 1px 3px rgba(255,255,255,0.12)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 25%, transparent 50%, rgba(0,0,0,0.04) 85%, rgba(255,255,255,0.06) 100%)',
	},
	clear: {
		opacity: 0.7,
		filter: 'brightness(1.15)',
		// Clear: glass-like specular highlight with transparency
		boxShadow: 'inset -1px -1px 4px rgba(255,255,255,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, rgba(255,255,255,0.08) 100%)',
	},
	powder: {
		filter: 'brightness(1.1) contrast(0.85) saturate(0.8)',
		// Powder: very diffuse, almost no specular
		backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
	},
	translucentPowder: {
		opacity: 0.75,
		filter: 'brightness(1.1) contrast(0.85)',
		// Translucent powder: slight translucent glow
		backgroundImage:
			'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)',
	},
	// Legacy materials (PowerPoint 2007 / earlier). Render as muted variants
	// of the modern equivalents so legacy decks still resemble the originals.
	legacyMatte: {
		filter: 'brightness(0.92) saturate(0.85)',
		backgroundImage:
			'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.04) 100%)',
	},
	legacyPlastic: {
		filter: 'brightness(1.02) contrast(1.03)',
		boxShadow: 'inset -2px -2px 5px rgba(255,255,255,0.3)',
		backgroundImage:
			'radial-gradient(ellipse 35% 25% at 25% 20%, rgba(255,255,255,0.15) 0%, transparent 70%)',
	},
	legacyMetal: {
		filter: 'brightness(1.05) contrast(1.1) saturate(1.1)',
		boxShadow:
			'inset -2px -2px 6px rgba(255,255,255,0.35), inset 1px 1px 3px rgba(255,255,255,0.15)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 25%, transparent 50%, rgba(0,0,0,0.05) 80%)',
	},
	legacyWireframe: {
		filter: 'brightness(1) contrast(1.4) saturate(0.6)',
		// Wireframe: high contrast outline-emphasising look
		boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
	},
};

/**
 * Returns CSS overrides that approximate the given OOXML 3D material preset.
 * Returns an empty object for `undefined` or unrecognised values.
 */
export function getMaterialCssOverrides(
	material: MaterialPresetType | undefined,
): MaterialCssOverrides {
	if (!material) {
		return {};
	}
	return MATERIAL_MAP[material] ?? {};
}

// ── Camera-aware front-face material overlay ─────────────────────────────

/**
 * Compute the lighting angle in CSS degrees based on camera rotation.
 * When the camera rotates right (rotateY < 0), the specular highlight
 * should shift left to remain consistent with the viewer's perspective.
 * Returns a gradient angle in CSS degrees (0 = upward, 90 = rightward).
 */
export function getLightAngleFromCamera(rotateX: number, rotateY: number): number {
	// Base angle: 135deg = light from top-left
	let angle = 135;
	// Shift by camera Y rotation (yaw) — looking from right means highlight moves left
	angle -= rotateY * 0.6;
	// Shift by camera X rotation (pitch) — looking from above means highlight moves up
	angle += rotateX * 0.4;
	// Normalise to [0, 360)
	return ((angle % 360) + 360) % 360;
}

/**
 * Map camera rotation to a gradient overlay for material simulation on the
 * front face of an extruded shape. The gradient direction adapts to the camera
 * rotation so the specular highlight appears to track the light source relative
 * to the viewer. Returns `undefined` for materials without a directional overlay.
 */
export function getMaterialGradientOverlay(
	material: string | undefined,
	rotateX: number,
	rotateY: number,
): string | undefined {
	if (!material) {
		return undefined;
	}

	const angle = Math.round(getLightAngleFromCamera(rotateX, rotateY));
	const oppositeAngle = (angle + 180) % 360;

	switch (material) {
		case 'plastic':
			return `linear-gradient(${angle}deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 60%, rgba(0,0,0,0.06) 100%)`;
		case 'metal':
			return [
				`linear-gradient(${angle}deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%, transparent 50%, rgba(0,0,0,0.1) 80%, rgba(255,255,255,0.08) 100%)`,
				`linear-gradient(${oppositeAngle}deg, rgba(255,255,255,0.06) 0%, transparent 30%)`,
			].join(', ');
		case 'softmetal':
			return `linear-gradient(${angle}deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 25%, transparent 55%, rgba(0,0,0,0.06) 100%)`;
		case 'warmMatte':
			return `linear-gradient(${angle}deg, rgba(255,240,220,0.08) 0%, transparent 60%, rgba(0,0,0,0.04) 100%)`;
		case 'matte':
			return `linear-gradient(${angle}deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(0,0,0,0.04) 100%)`;
		case 'dkEdge':
			return `linear-gradient(${angle}deg, transparent 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.15) 100%)`;
		case 'softEdge':
			return `radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 55%, rgba(0,0,0,0.04) 100%)`;
		case 'clear':
		case 'translucentPowder':
			return `linear-gradient(${angle}deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)`;
		case 'powder':
			return `linear-gradient(${angle}deg, rgba(255,255,255,0.08) 0%, transparent 60%)`;
		default:
			return undefined;
	}
}
