/**
 * 3D text effects (extrusion / bevel / scene) CSS builders, shared by every
 * binding's text renderer.
 *
 * Pure, framework-agnostic. {@link buildText3DShadowCss} stacks layered
 * `text-shadow` strings simulating extrusion depth, bevels, and material
 * specular highlights; {@link buildTextBody3DSceneStyle} maps a text body's
 * `a:scene3d` camera/light rig to a neutral CSS record (perspective + rotate
 * transform). Each binding casts the record into its own style type.
 */
import type { Pptx3DScene, TextStyle } from 'pptx-viewer-core';

import { normalizeHexColor } from './fill-style';
import type { TextCssProperties } from './text-fill';

/** EMU per pixel constant for 3D conversions. */
const TEXT_3D_EMU_PER_PX = 9525;
/** Maximum shadow layers for 3D extrusion (capped for performance). */
const MAX_EXTRUSION_LAYERS = 15;
/** Minimum shadow layers for 3D extrusion (ensures visible depth). */
const MIN_EXTRUSION_LAYERS = 3;

/** Parse a hex colour string into RGB channels. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const norm = normalizeHexColor(hex, '#888888');
	return {
		r: parseInt(norm.slice(1, 3), 16),
		g: parseInt(norm.slice(3, 5), 16),
		b: parseInt(norm.slice(5, 7), 16),
	};
}

/**
 * Darken a hex colour by a given factor (0-1 where 0 returns black). Used when
 * no explicit extrusion colour is specified.
 */
function darkenHex(hex: string, factor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/**
 * Lighten a hex colour by mixing toward white.
 * @param hex - source colour
 * @param factor - 0 = original colour, 1 = white
 */
function lightenHex(hex: string, factor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
}

// ── Material preset configuration ────────────────────────────────────────
/**
 * Material configuration determines how extrusion shadow layers darken and
 * whether a specular highlight shadow is added.
 */
interface MaterialConfig {
	/** Base darkening factor for extrusion layers (0-1, lower = darker). */
	darkenBase: number;
	/** How steeply the layers darken toward the back (0-1). */
	darkenFalloff: number;
	/** Whether to add a specular highlight shadow on the face edge. */
	specular: boolean;
	/** Specular highlight opacity (0-1). */
	specularOpacity: number;
	/** Specular highlight sharpness (blur radius in px). */
	specularBlur: number;
}

const MATERIAL_CONFIGS: Record<string, MaterialConfig> = {
	matte: {
		darkenBase: 0.55,
		darkenFalloff: 0.6,
		specular: false,
		specularOpacity: 0,
		specularBlur: 0,
	},
	warmMatte: {
		darkenBase: 0.5,
		darkenFalloff: 0.5,
		specular: false,
		specularOpacity: 0,
		specularBlur: 0,
	},
	plastic: {
		darkenBase: 0.5,
		darkenFalloff: 0.5,
		specular: true,
		specularOpacity: 0.55,
		specularBlur: 1,
	},
	metal: {
		darkenBase: 0.35,
		darkenFalloff: 0.7,
		specular: true,
		specularOpacity: 0.7,
		specularBlur: 0,
	},
	dkEdge: {
		darkenBase: 0.3,
		darkenFalloff: 0.8,
		specular: true,
		specularOpacity: 0.5,
		specularBlur: 1,
	},
	softEdge: {
		darkenBase: 0.55,
		darkenFalloff: 0.4,
		specular: true,
		specularOpacity: 0.3,
		specularBlur: 3,
	},
	flat: {
		darkenBase: 0.6,
		darkenFalloff: 0.3,
		specular: false,
		specularOpacity: 0,
		specularBlur: 0,
	},
	softmetal: {
		darkenBase: 0.4,
		darkenFalloff: 0.6,
		specular: true,
		specularOpacity: 0.55,
		specularBlur: 2,
	},
	clear: {
		darkenBase: 0.6,
		darkenFalloff: 0.4,
		specular: true,
		specularOpacity: 0.4,
		specularBlur: 2,
	},
	powder: {
		darkenBase: 0.55,
		darkenFalloff: 0.5,
		specular: false,
		specularOpacity: 0,
		specularBlur: 0,
	},
	translucentPowder: {
		darkenBase: 0.6,
		darkenFalloff: 0.4,
		specular: true,
		specularOpacity: 0.25,
		specularBlur: 3,
	},
};

/** Default material config when the preset is unknown or unset. */
const DEFAULT_MATERIAL: MaterialConfig = MATERIAL_CONFIGS.plastic;

/** Resolve a MaterialConfig from the preset material token. */
function getMaterialConfig(preset: string | undefined): MaterialConfig {
	if (!preset) {
		return DEFAULT_MATERIAL;
	}
	return MATERIAL_CONFIGS[preset] ?? DEFAULT_MATERIAL;
}

// ── Bevel type configuration ─────────────────────────────────────────────
/**
 * Bevel configuration affects highlight/shadow opacity and blur for the top
 * and bottom bevel edge simulations.
 */
interface BevelConfig {
	/** Highlight opacity on the lit edge. */
	highlightOpacity: number;
	/** Shadow opacity on the shaded edge. */
	shadowOpacity: number;
	/** Blur radius multiplier for the bevel glow (0 = sharp, 1 = soft). */
	blurMultiplier: number;
	/** Extra highlight layer for pronounced bevels. */
	extraHighlight: boolean;
}

const BEVEL_CONFIGS: Record<string, BevelConfig> = {
	circle: {
		highlightOpacity: 0.45,
		shadowOpacity: 0.3,
		blurMultiplier: 1.0,
		extraHighlight: false,
	},
	relaxedInset: {
		highlightOpacity: 0.35,
		shadowOpacity: 0.25,
		blurMultiplier: 1.2,
		extraHighlight: false,
	},
	cross: { highlightOpacity: 0.5, shadowOpacity: 0.35, blurMultiplier: 0.8, extraHighlight: true },
	coolSlant: {
		highlightOpacity: 0.4,
		shadowOpacity: 0.3,
		blurMultiplier: 0.6,
		extraHighlight: true,
	},
	angle: { highlightOpacity: 0.55, shadowOpacity: 0.35, blurMultiplier: 0.5, extraHighlight: true },
	softRound: {
		highlightOpacity: 0.4,
		shadowOpacity: 0.25,
		blurMultiplier: 1.5,
		extraHighlight: false,
	},
	convex: { highlightOpacity: 0.5, shadowOpacity: 0.3, blurMultiplier: 1.0, extraHighlight: true },
	slope: { highlightOpacity: 0.4, shadowOpacity: 0.3, blurMultiplier: 1.0, extraHighlight: false },
	divot: { highlightOpacity: 0.3, shadowOpacity: 0.35, blurMultiplier: 0.8, extraHighlight: false },
	riblet: { highlightOpacity: 0.35, shadowOpacity: 0.3, blurMultiplier: 0.6, extraHighlight: true },
	hardEdge: {
		highlightOpacity: 0.6,
		shadowOpacity: 0.4,
		blurMultiplier: 0.3,
		extraHighlight: true,
	},
	artDeco: {
		highlightOpacity: 0.55,
		shadowOpacity: 0.35,
		blurMultiplier: 0.4,
		extraHighlight: true,
	},
};

const DEFAULT_BEVEL: BevelConfig = BEVEL_CONFIGS.circle;

function getBevelConfig(type: string | undefined): BevelConfig {
	if (!type || type === 'none') {
		return DEFAULT_BEVEL;
	}
	return BEVEL_CONFIGS[type] ?? DEFAULT_BEVEL;
}

// ── Text body 3D scene direction helpers ──────────────────────────────────

/**
 * Compute extrusion offset direction from scene3d camera settings. Returns
 * (dx, dy) multipliers for text-shadow offsets. When no scene3d is present,
 * defaults to bottom-right (1, 1).
 */
function getTextExtrusionDirection(scene3d: Pptx3DScene | undefined): { dx: number; dy: number } {
	if (!scene3d) {
		return { dx: 1, dy: 1 };
	}

	let dx = 1;
	let dy = 1;

	// Camera rotation in 1/60000 degrees -> degrees
	const rotX = scene3d.cameraRotX ? -(scene3d.cameraRotX / 60000) : 0;
	const rotY = scene3d.cameraRotY ? scene3d.cameraRotY / 60000 : 0;

	// Camera presets influence default direction
	const preset = scene3d.cameraPreset || '';
	if (preset.includes('Left')) {
		dx = -1;
	} else if (preset.includes('Right')) {
		dx = 1;
	}
	if (preset.includes('Above') || preset.includes('Top')) {
		dy = 1;
	} else if (preset.includes('Below') || preset.includes('Bottom')) {
		dy = -1;
	}

	// Explicit rotation overrides preset direction
	if (rotY > 5) {
		dx = -1;
	} else if (rotY < -5) {
		dx = 1;
	}
	if (rotX < -5) {
		dy = 1;
	} else if (rotX > 5) {
		dy = -1;
	}

	return { dx, dy };
}

/**
 * Map the light rig direction token to a shadow angle in degrees. The shadow
 * falls opposite to the light source direction.
 */
function getLightRigShadowAngle(direction: string | undefined): number {
	switch (direction) {
		case 't':
			return 180;
		case 'b':
			return 0;
		case 'l':
			return 90;
		case 'r':
			return 270;
		case 'tl':
			return 135;
		case 'tr':
			return 225;
		case 'bl':
			return 45;
		case 'br':
			return 315;
		default:
			return 135; // default: light from top-left
	}
}

/**
 * Build CSS `text-shadow` layers that simulate 3D text extrusion.
 *
 * The shadow stack is built from three independent components: extrusion depth
 * layers (progressively darkened per the {@link MaterialConfig}), bevel edges
 * (highlight + shadow per the bevel preset), and a material specular highlight.
 * When `textBodyScene3d` is available, the extrusion direction and light rig
 * shadow adapt to the camera and light rig settings.
 */
export function buildText3DShadowCss(style: TextStyle): string | undefined {
	const t3d = style.text3d;
	if (!t3d) {
		return undefined;
	}
	const hasExtrusion = t3d.extrusionHeight && t3d.extrusionHeight > 0;
	const hasBevelTop = t3d.bevelTopType && t3d.bevelTopType !== 'none';
	const hasBevelBottom = t3d.bevelBottomType && t3d.bevelBottomType !== 'none';
	if (!hasExtrusion && !hasBevelTop && !hasBevelBottom) {
		return undefined;
	}

	const scene3d = style.textBodyScene3d;
	const { dx, dy } = getTextExtrusionDirection(scene3d);
	const material = getMaterialConfig(t3d.presetMaterial);
	const baseColor = style.color || '#000000';

	const layers: string[] = [];

	// ── Extrusion depth layers ──────────────────────────────────────────
	if (hasExtrusion) {
		const rawDepthPx = Math.round((t3d.extrusionHeight ?? 0) / TEXT_3D_EMU_PER_PX);
		const depthPx = Math.max(MIN_EXTRUSION_LAYERS, Math.min(rawDepthPx, MAX_EXTRUSION_LAYERS));

		const hasExplicitColor = Boolean(t3d.extrusionColor);
		const extBaseHex = hasExplicitColor
			? normalizeHexColor(t3d.extrusionColor, '#888888')
			: baseColor;

		for (let i = 1; i <= depthPx; i++) {
			const t = i / depthPx;
			const darkenFactor = hasExplicitColor
				? 1 - t * material.darkenFalloff * 0.3
				: material.darkenBase * (1 - t * material.darkenFalloff);
			const color = darkenHex(extBaseHex, Math.max(0.1, darkenFactor));
			layers.push(`${dx * i}px ${dy * i}px 0 ${color}`);
		}

		if (depthPx > 0) {
			layers.push(
				`${dx * (depthPx + 1)}px ${dy * (depthPx + 1)}px ${Math.max(2, Math.round(depthPx / 2))}px rgba(0,0,0,0.3)`,
			);
		}

		if (material.specular && depthPx > 0) {
			const highlightColor = lightenHex(baseColor, material.specularOpacity);
			layers.push(`${-dx}px ${-dy}px ${material.specularBlur}px ${highlightColor}`);
			if (material.specularOpacity > 0.5) {
				const bloomColor = lightenHex(baseColor, material.specularOpacity * 0.4);
				layers.push(`${-dx * 2}px ${-dy * 2}px ${material.specularBlur + 2}px ${bloomColor}`);
			}
		}

		if (depthPx >= 3) {
			layers.push(
				`${dx * (depthPx + 2)}px ${dy * (depthPx + 2)}px ${Math.max(3, Math.round(depthPx * 0.6))}px rgba(0,0,0,0.12)`,
			);
		}
	}

	// ── Top bevel ───────────────────────────────────────────────────────
	if (hasBevelTop) {
		const bevelCfg = getBevelConfig(t3d.bevelTopType);
		const bW = t3d.bevelTopWidth
			? Math.max(1, Math.round(t3d.bevelTopWidth / TEXT_3D_EMU_PER_PX))
			: 1;
		const bH = t3d.bevelTopHeight
			? Math.max(1, Math.round(t3d.bevelTopHeight / TEXT_3D_EMU_PER_PX))
			: 1;
		const blurPx = Math.max(1, Math.round(Math.max(bW, bH) * bevelCfg.blurMultiplier));
		layers.push(
			`${-dx * bW}px ${-dy * bH}px ${blurPx}px rgba(255,255,255,${bevelCfg.highlightOpacity})`,
		);
		layers.push(`${dx * bW}px ${dy * bH}px ${blurPx}px rgba(0,0,0,${bevelCfg.shadowOpacity})`);
		if (bevelCfg.extraHighlight) {
			layers.push(
				`${-dx}px ${-dy}px 0 rgba(255,255,255,${Math.round(bevelCfg.highlightOpacity * 0.5 * 100) / 100})`,
			);
		}
	}

	// ── Bottom bevel ────────────────────────────────────────────────────
	if (hasBevelBottom) {
		const bevelCfg = getBevelConfig(t3d.bevelBottomType);
		const bW = t3d.bevelBottomWidth
			? Math.max(1, Math.round(t3d.bevelBottomWidth / TEXT_3D_EMU_PER_PX))
			: 1;
		const bH = t3d.bevelBottomHeight
			? Math.max(1, Math.round(t3d.bevelBottomHeight / TEXT_3D_EMU_PER_PX))
			: 1;
		const blurPx = Math.max(1, Math.round(Math.max(bW, bH) * bevelCfg.blurMultiplier));
		layers.push(`${dx * bW}px ${dy * bH}px ${blurPx}px rgba(0,0,0,${bevelCfg.shadowOpacity})`);
		layers.push(
			`${-dx * bW}px ${-dy * bH}px ${blurPx}px rgba(255,255,255,${Math.round(bevelCfg.highlightOpacity * 0.6 * 100) / 100})`,
		);
	}

	// ── Light rig shadow ────────────────────────────────────────────────
	if (scene3d?.lightRigType && scene3d.lightRigType !== 'flat') {
		const angle = getLightRigShadowAngle(scene3d.lightRigDirection);
		const rad = (angle * Math.PI) / 180;
		const lx = Math.round(Math.cos(rad) * 2 * 100) / 100;
		const ly = Math.round(Math.sin(rad) * 2 * 100) / 100;
		layers.push(`${lx}px ${ly}px 3px rgba(0,0,0,0.15)`);
	}

	return layers.length > 0 ? layers.join(', ') : undefined;
}

// ── Text body 3D scene style ─────────────────────────────────────────────

/**
 * Camera preset configuration: CSS perspective distance and base rotation
 * angles (in degrees). Mirrors the shape-level CAMERA_PRESET_MAP but with
 * reduced rotation values for text (text 3D is typically subtler).
 */
interface TextCameraPresetConfig {
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

const TEXT_CAMERA_PRESET_MAP: Record<string, TextCameraPresetConfig> = {
	orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveFront: { perspective: '800px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveAbove: { perspective: '800px', rotateX: -12, rotateY: 0, rotateZ: 0 },
	perspectiveBelow: { perspective: '800px', rotateX: 12, rotateY: 0, rotateZ: 0 },
	perspectiveLeft: { perspective: '800px', rotateX: 0, rotateY: 12, rotateZ: 0 },
	perspectiveRight: { perspective: '800px', rotateX: 0, rotateY: -12, rotateZ: 0 },
	perspectiveAboveLeftFacing: { perspective: '800px', rotateX: -12, rotateY: 15, rotateZ: 0 },
	perspectiveAboveRightFacing: { perspective: '800px', rotateX: -12, rotateY: -15, rotateZ: 0 },
	perspectiveContrastingLeftFacing: { perspective: '700px', rotateX: -10, rotateY: 20, rotateZ: 0 },
	perspectiveContrastingRightFacing: {
		perspective: '700px',
		rotateX: -10,
		rotateY: -20,
		rotateZ: 0,
	},
	perspectiveHeroicLeftFacing: { perspective: '600px', rotateX: -8, rotateY: 25, rotateZ: 0 },
	perspectiveHeroicRightFacing: { perspective: '600px', rotateX: -8, rotateY: -25, rotateZ: 0 },
	perspectiveHeroicExtremeLeftFacing: {
		perspective: '500px',
		rotateX: -6,
		rotateY: 30,
		rotateZ: 0,
	},
	perspectiveHeroicExtremeRightFacing: {
		perspective: '500px',
		rotateX: -6,
		rotateY: -30,
		rotateZ: 0,
	},
	perspectiveRelaxed: { perspective: '1000px', rotateX: -6, rotateY: 0, rotateZ: 0 },
	perspectiveRelaxedModerately: { perspective: '1200px', rotateX: -3, rotateY: 0, rotateZ: 0 },
	isometricLeftDown: { perspective: '1000px', rotateX: -20, rotateY: 25, rotateZ: 0 },
	isometricRightUp: { perspective: '1000px', rotateX: -20, rotateY: -25, rotateZ: 0 },
	isometricTopUp: { perspective: '1000px', rotateX: -30, rotateY: 0, rotateZ: 25 },
	isometricTopDown: { perspective: '1000px', rotateX: -30, rotateY: 0, rotateZ: -25 },
	isometricBottomUp: { perspective: '1000px', rotateX: 30, rotateY: 0, rotateZ: 25 },
	isometricBottomDown: { perspective: '1000px', rotateX: 30, rotateY: 0, rotateZ: -25 },
	obliqueTopLeft: { perspective: '800px', rotateX: -12, rotateY: 12, rotateZ: 0 },
	obliqueTop: { perspective: '800px', rotateX: -15, rotateY: 0, rotateZ: 0 },
	obliqueTopRight: { perspective: '800px', rotateX: -12, rotateY: -12, rotateZ: 0 },
	obliqueLeft: { perspective: '800px', rotateX: 0, rotateY: 15, rotateZ: 0 },
	obliqueRight: { perspective: '800px', rotateX: 0, rotateY: -15, rotateZ: 0 },
	obliqueBottomLeft: { perspective: '800px', rotateX: 12, rotateY: 12, rotateZ: 0 },
	obliqueBottom: { perspective: '800px', rotateX: 15, rotateY: 0, rotateZ: 0 },
	obliqueBottomRight: { perspective: '800px', rotateX: 12, rotateY: -12, rotateZ: 0 },
};

/**
 * Build CSS properties for 3D scene rendering on a text body.
 *
 * Maps `a:bodyPr/a:scene3d` camera presets and explicit rotations to CSS
 * `perspective` + `transform` (rotateX/Y/Z) plus `transform-style:
 * preserve-3d`. Returns `undefined` when no scene3d (or no effective rotation/
 * perspective) is present. Applied as a wrapper style on the text body
 * container.
 */
export function buildTextBody3DSceneStyle(
	textStyle: TextStyle | undefined,
): TextCssProperties | undefined {
	const scene3d = textStyle?.textBodyScene3d;
	if (!scene3d) {
		return undefined;
	}

	const preset = scene3d.cameraPreset ? TEXT_CAMERA_PRESET_MAP[scene3d.cameraPreset] : undefined;

	let perspective = preset?.perspective;
	let rotateX = preset?.rotateX ?? 0;
	let rotateY = preset?.rotateY ?? 0;
	let rotateZ = preset?.rotateZ ?? 0;

	// Explicit rotation angles override preset defaults (values in 1/60000 degrees)
	if (scene3d.cameraRotX) {
		rotateX = -(scene3d.cameraRotX / 60000);
	}
	if (scene3d.cameraRotY) {
		rotateY = scene3d.cameraRotY / 60000;
	}
	if (scene3d.cameraRotZ) {
		rotateZ = scene3d.cameraRotZ / 60000;
	}

	if (!perspective && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0)) {
		perspective = '800px';
	}

	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	const hasScene = hasRotation || Boolean(perspective);

	if (!hasScene) {
		return undefined;
	}

	const style: TextCssProperties = {};

	if (perspective) {
		style.perspective = perspective;
	}

	if (hasRotation) {
		const transforms: string[] = [];
		if (rotateX !== 0) {
			transforms.push(`rotateX(${rotateX}deg)`);
		}
		if (rotateY !== 0) {
			transforms.push(`rotateY(${rotateY}deg)`);
		}
		if (rotateZ !== 0) {
			transforms.push(`rotateZ(${rotateZ}deg)`);
		}
		style.transform = transforms.join(' ');
	}

	// Preserve 3D space for child elements
	style.transformStyle = 'preserve-3d';

	return style;
}
