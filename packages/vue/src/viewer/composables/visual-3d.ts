/**
 * CSS-based 3D approximation for PPTX shapes (Vue port).
 *
 * Self-contained composable that translates OOXML scene3d/shape3d properties
 * (camera/perspective, extrusion depth, contour, bevel, material, light rig)
 * into CSS the Vue renderer can apply. This mirrors the React layer
 * (`packages/react/src/viewer/utils/shape-3d-styles.ts` +
 * `shape-visual-3d.ts`) closely enough that both bindings produce the same
 * visual output, while staying framework-agnostic (plain TS, unit-testable).
 *
 * The aggregate {@link getComputed3dStyle} deliberately returns the extrusion
 * box-shadow as a SEPARATE `extrusionBoxShadow` value (rather than folding it
 * into `boxShadow`) so the caller can comma-join it with any pre-existing
 * effect shadow instead of clobbering it.
 *
 * @module viewer/composables/visual-3d
 */

import type { PptxElement, Pptx3DScene, Pptx3DShape } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';

/**
 * EMU per CSS pixel. PowerPoint stores 3D dimensions in English Metric Units;
 * the React layer uses the same constant (9525). Defined locally to keep this
 * module self-contained.
 */
const EMU_PER_PX = 9525;

/**
 * Maximum stacked shadow layers for extrusion (performance guard). Matches the
 * React engine — each layer is a single box-shadow, so 40 is still performant.
 */
const MAX_EXTRUSION_LAYERS = 40;

// ── Material preset → CSS overrides ──────────────────────────────────────

/** CSS overrides that approximate an OOXML 3D material preset. */
interface MaterialCssOverrides {
	filter?: string;
	opacity?: number;
	boxShadow?: string;
	backgroundImage?: string;
}

const MATERIAL_MAP: Record<string, MaterialCssOverrides> = {
	matte: {
		filter: 'brightness(0.95) saturate(0.9)',
		backgroundImage:
			'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%, rgba(0,0,0,0.03) 100%)',
	},
	warmMatte: {
		filter: 'brightness(1.0) saturate(0.85) sepia(0.08)',
		backgroundImage:
			'linear-gradient(180deg, rgba(255,240,220,0.06) 0%, transparent 50%, rgba(0,0,0,0.03) 100%)',
	},
	plastic: {
		filter: 'brightness(1.05) contrast(1.05)',
		boxShadow:
			'inset -2px -2px 6px rgba(255,255,255,0.35), inset 1px 1px 3px rgba(255,255,255,0.15)',
		backgroundImage:
			'radial-gradient(ellipse 40% 30% at 25% 20%, rgba(255,255,255,0.18) 0%, transparent 70%)',
	},
	metal: {
		filter: 'brightness(1.1) contrast(1.15) saturate(1.2)',
		boxShadow:
			'inset -3px -3px 8px rgba(255,255,255,0.45), inset 2px 2px 4px rgba(255,255,255,0.2), inset 0 0 2px rgba(0,0,0,0.15)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 20%, transparent 45%, rgba(0,0,0,0.06) 75%, rgba(255,255,255,0.1) 100%)',
	},
	dkEdge: {
		filter: 'brightness(0.85) contrast(1.2)',
		boxShadow: 'inset 0 0 8px rgba(0,0,0,0.2), inset 0 0 2px rgba(0,0,0,0.1)',
		backgroundImage:
			'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
	},
	softEdge: {
		filter: 'brightness(1.05) contrast(0.9)',
		backgroundImage:
			'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 60%)',
	},
	flat: {},
	softmetal: {
		filter: 'brightness(1.05) contrast(1.08) saturate(1.1)',
		boxShadow:
			'inset -2px -2px 6px rgba(255,255,255,0.3), inset 1px 1px 3px rgba(255,255,255,0.12)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 25%, transparent 50%, rgba(0,0,0,0.04) 85%, rgba(255,255,255,0.06) 100%)',
	},
	clear: {
		opacity: 0.7,
		filter: 'brightness(1.15)',
		boxShadow: 'inset -1px -1px 4px rgba(255,255,255,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)',
		backgroundImage:
			'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, rgba(255,255,255,0.08) 100%)',
	},
	powder: {
		filter: 'brightness(1.1) contrast(0.85) saturate(0.8)',
		backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
	},
	translucentPowder: {
		opacity: 0.75,
		filter: 'brightness(1.1) contrast(0.85)',
		backgroundImage:
			'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)',
	},
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
		boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
	},
};

/** CSS overrides for a material preset; empty object for unknown/undefined. */
function getMaterialCssOverrides(material: string | undefined): MaterialCssOverrides {
	if (!material) {
		return {};
	}
	return MATERIAL_MAP[material] ?? {};
}

// ── Camera preset mapping ────────────────────────────────────────────────

interface CameraPresetConfig {
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

const CAMERA_PRESET_MAP: Record<string, CameraPresetConfig> = {
	orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveFront: { perspective: '1000px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveAbove: { perspective: '1000px', rotateX: -20, rotateY: 0, rotateZ: 0 },
	perspectiveBelow: { perspective: '1000px', rotateX: 20, rotateY: 0, rotateZ: 0 },
	perspectiveLeft: { perspective: '1000px', rotateX: 0, rotateY: 20, rotateZ: 0 },
	perspectiveRight: { perspective: '1000px', rotateX: 0, rotateY: -20, rotateZ: 0 },
	perspectiveAboveLeftFacing: { perspective: '1000px', rotateX: -20, rotateY: 25, rotateZ: 0 },
	perspectiveAboveRightFacing: { perspective: '1000px', rotateX: -20, rotateY: -25, rotateZ: 0 },
	perspectiveContrastingLeftFacing: { perspective: '800px', rotateX: -15, rotateY: 30, rotateZ: 0 },
	perspectiveContrastingRightFacing: {
		perspective: '800px',
		rotateX: -15,
		rotateY: -30,
		rotateZ: 0,
	},
	perspectiveHeroicLeftFacing: { perspective: '600px', rotateX: -10, rotateY: 35, rotateZ: 0 },
	perspectiveHeroicRightFacing: { perspective: '600px', rotateX: -10, rotateY: -35, rotateZ: 0 },
	perspectiveHeroicExtremeLeftFacing: {
		perspective: '500px',
		rotateX: -8,
		rotateY: 45,
		rotateZ: 0,
	},
	perspectiveHeroicExtremeRightFacing: {
		perspective: '500px',
		rotateX: -8,
		rotateY: -45,
		rotateZ: 0,
	},
	perspectiveRelaxed: { perspective: '1200px', rotateX: -10, rotateY: 0, rotateZ: 0 },
	perspectiveRelaxedModerately: { perspective: '1400px', rotateX: -5, rotateY: 0, rotateZ: 0 },
	isometricLeftDown: { perspective: '1200px', rotateX: -35, rotateY: 45, rotateZ: 0 },
	isometricRightUp: { perspective: '1200px', rotateX: -35, rotateY: -45, rotateZ: 0 },
	isometricTopUp: { perspective: '1200px', rotateX: -55, rotateY: 0, rotateZ: 45 },
	isometricTopDown: { perspective: '1200px', rotateX: -55, rotateY: 0, rotateZ: -45 },
	isometricBottomUp: { perspective: '1200px', rotateX: 55, rotateY: 0, rotateZ: 45 },
	isometricBottomDown: { perspective: '1200px', rotateX: 55, rotateY: 0, rotateZ: -45 },
	isometricOffAxis1Left: { perspective: '1200px', rotateX: -30, rotateY: 30, rotateZ: 0 },
	isometricOffAxis1Right: { perspective: '1200px', rotateX: -30, rotateY: -30, rotateZ: 0 },
	isometricOffAxis1Top: { perspective: '1200px', rotateX: -45, rotateY: 0, rotateZ: 30 },
	isometricOffAxis2Left: { perspective: '1200px', rotateX: -30, rotateY: 20, rotateZ: 0 },
	isometricOffAxis2Right: { perspective: '1200px', rotateX: -30, rotateY: -20, rotateZ: 0 },
	isometricOffAxis2Top: { perspective: '1200px', rotateX: -45, rotateY: 0, rotateZ: -30 },
	isometricOffAxis3Left: { perspective: '1200px', rotateX: -25, rotateY: 35, rotateZ: 0 },
	isometricOffAxis3Right: { perspective: '1200px', rotateX: -25, rotateY: -35, rotateZ: 0 },
	isometricOffAxis3Bottom: { perspective: '1200px', rotateX: 45, rotateY: 0, rotateZ: 30 },
	isometricOffAxis4Left: { perspective: '1200px', rotateX: -25, rotateY: 25, rotateZ: 0 },
	isometricOffAxis4Right: { perspective: '1200px', rotateX: -25, rotateY: -25, rotateZ: 0 },
	isometricOffAxis4Bottom: { perspective: '1200px', rotateX: 45, rotateY: 0, rotateZ: -30 },
	obliqueTopLeft: { perspective: '900px', rotateX: -20, rotateY: 20, rotateZ: 0 },
	obliqueTop: { perspective: '900px', rotateX: -25, rotateY: 0, rotateZ: 0 },
	obliqueTopRight: { perspective: '900px', rotateX: -20, rotateY: -20, rotateZ: 0 },
	obliqueLeft: { perspective: '900px', rotateX: 0, rotateY: 25, rotateZ: 0 },
	obliqueRight: { perspective: '900px', rotateX: 0, rotateY: -25, rotateZ: 0 },
	obliqueBottomLeft: { perspective: '900px', rotateX: 20, rotateY: 20, rotateZ: 0 },
	obliqueBottom: { perspective: '900px', rotateX: 25, rotateY: 0, rotateZ: 0 },
	obliqueBottomRight: { perspective: '900px', rotateX: 20, rotateY: -20, rotateZ: 0 },
};

interface CameraTransform {
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

/**
 * Resolve a camera preset name + explicit rotation overrides into final CSS
 * perspective and rotation (degrees). Explicit `cameraRot*` (1/60000 deg)
 * override preset defaults; the X axis is negated to match CSS conventions.
 */
function getCameraTransform(scene3d: Pptx3DScene | undefined): CameraTransform {
	if (!scene3d) {
		return { rotateX: 0, rotateY: 0, rotateZ: 0 };
	}

	const preset = scene3d.cameraPreset ? CAMERA_PRESET_MAP[scene3d.cameraPreset] : undefined;

	let perspective = preset?.perspective;
	let rotateX = preset?.rotateX ?? 0;
	let rotateY = preset?.rotateY ?? 0;
	let rotateZ = preset?.rotateZ ?? 0;

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

	return { perspective, rotateX, rotateY, rotateZ };
}

// ── Light rig mapping ────────────────────────────────────────────────────

interface LightRigCssConfig {
	backgroundImage?: string;
	filter?: string;
}

const LIGHT_RIG_MAP: Record<string, LightRigCssConfig> = {
	threePt: {
		backgroundImage: [
			'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 35%)',
			'linear-gradient(315deg, rgba(255,255,255,0.05) 0%, transparent 25%)',
			'linear-gradient(0deg, rgba(0,0,0,0.06) 0%, transparent 20%)',
		].join(', '),
	},
	balanced: {
		backgroundImage: [
			'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)',
			'linear-gradient(0deg, rgba(255,255,255,0.03) 0%, transparent 30%)',
			'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 20%)',
		].join(', '),
	},
	harsh: {
		backgroundImage: [
			'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 28%)',
			'linear-gradient(315deg, rgba(0,0,0,0.12) 0%, transparent 40%)',
		].join(', '),
		filter: 'contrast(1.08)',
	},
	flat: {},
	flood: {
		backgroundImage:
			'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
		filter: 'brightness(1.08)',
	},
	contrasting: {
		backgroundImage: [
			'linear-gradient(120deg, rgba(255,255,255,0.2) 0%, transparent 30%)',
			'linear-gradient(300deg, rgba(0,0,0,0.1) 0%, transparent 35%)',
		].join(', '),
		filter: 'contrast(1.1)',
	},
	morning: {
		backgroundImage: [
			'linear-gradient(90deg, rgba(255,240,200,0.16) 0%, transparent 45%)',
			'linear-gradient(270deg, rgba(0,0,0,0.04) 0%, transparent 30%)',
		].join(', '),
	},
	sunrise: {
		backgroundImage: [
			'linear-gradient(45deg, rgba(255,220,180,0.16) 0%, transparent 40%)',
			'radial-gradient(ellipse at 20% 80%, rgba(255,200,140,0.08) 0%, transparent 50%)',
		].join(', '),
	},
	sunset: {
		backgroundImage: [
			'linear-gradient(270deg, rgba(255,180,100,0.14) 0%, transparent 45%)',
			'radial-gradient(ellipse at 85% 50%, rgba(255,160,60,0.06) 0%, transparent 40%)',
		].join(', '),
	},
	chilly: {
		backgroundImage: [
			'linear-gradient(180deg, rgba(180,200,255,0.1) 0%, transparent 50%)',
			'radial-gradient(ellipse at center, rgba(200,220,255,0.04) 0%, transparent 60%)',
		].join(', '),
	},
	freezing: {
		backgroundImage: [
			'linear-gradient(180deg, rgba(160,190,255,0.16) 0%, transparent 40%)',
			'linear-gradient(0deg, rgba(140,170,255,0.06) 0%, transparent 25%)',
		].join(', '),
		filter: 'saturate(0.9)',
	},
	glow: {
		backgroundImage:
			'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)',
	},
	brightRoom: {
		backgroundImage: [
			'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
			'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)',
		].join(', '),
		filter: 'brightness(1.05)',
	},
	soft: {
		backgroundImage: [
			'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)',
			'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)',
		].join(', '),
		filter: 'contrast(0.95)',
	},
	twoPt: {
		backgroundImage: [
			'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, transparent 35%)',
			'linear-gradient(270deg, rgba(255,255,255,0.07) 0%, transparent 30%)',
		].join(', '),
	},
	legacyFlat1: {},
	legacyFlat2: {},
	legacyFlat3: {},
	legacyFlat4: {},
	legacyNormal1: {
		backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
	},
	legacyNormal2: {
		backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
	},
	legacyNormal3: {
		backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
	},
	legacyNormal4: {
		backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
	},
	legacyHarsh1: {
		backgroundImage: [
			'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 28%)',
			'linear-gradient(315deg, rgba(0,0,0,0.1) 0%, transparent 35%)',
		].join(', '),
		filter: 'contrast(1.1)',
	},
	legacyHarsh2: {
		backgroundImage: [
			'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, transparent 28%)',
			'linear-gradient(315deg, rgba(0,0,0,0.08) 0%, transparent 35%)',
		].join(', '),
		filter: 'contrast(1.08)',
	},
	legacyHarsh3: {
		backgroundImage: [
			'linear-gradient(120deg, rgba(255,255,255,0.2) 0%, transparent 28%)',
			'linear-gradient(300deg, rgba(0,0,0,0.1) 0%, transparent 35%)',
		].join(', '),
		filter: 'contrast(1.1)',
	},
	legacyHarsh4: {
		backgroundImage: [
			'linear-gradient(150deg, rgba(255,255,255,0.2) 0%, transparent 28%)',
			'linear-gradient(330deg, rgba(0,0,0,0.1) 0%, transparent 35%)',
		].join(', '),
		filter: 'contrast(1.1)',
	},
};

/** Map a light-rig direction token to a CSS gradient angle (degrees). */
function getLightDirectionAngle(direction: string | undefined): number {
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
			return 135;
	}
}

/** Shift every `linear-gradient(Ndeg` angle in a background-image by a delta. */
function rotateGradientAngles(backgroundImage: string, angleDelta: number): string {
	if (angleDelta === 0) {
		return backgroundImage;
	}
	return backgroundImage.replace(/linear-gradient\((?<deg>\d+)deg/gu, (_match, degStr: string) => {
		const newAngle = (parseInt(degStr, 10) + angleDelta + 360) % 360;
		return `linear-gradient(${newAngle}deg`;
	});
}

/** Resolve light rig CSS overrides for a given rig type + direction. */
function getLightRigCss(
	lightRigType: string | undefined,
	lightRigDirection: string | undefined,
): LightRigCssConfig {
	if (!lightRigType) {
		return {};
	}
	const config = LIGHT_RIG_MAP[lightRigType];
	if (!config) {
		return {};
	}

	if (config.backgroundImage && lightRigDirection) {
		const targetAngle = getLightDirectionAngle(lightRigDirection);
		const delta = targetAngle - 135;
		if (delta !== 0) {
			return {
				...config,
				backgroundImage: rotateGradientAngles(config.backgroundImage, delta),
			};
		}
	}

	return config;
}

// ── Bevel preset mapping ─────────────────────────────────────────────────

function getBevelShadow(bevelType: string, bW: number, bH: number, isBottom: boolean): string {
	const hlDir = isBottom ? -1 : 1;
	const shDir = isBottom ? 1 : -1;
	const hlOpacity = isBottom ? 0.2 : 0.3;
	const shOpacity = isBottom ? 0.3 : 0.2;
	const maxDim = Math.max(bW, bH);

	switch (bevelType) {
		case 'circle':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 2}px rgba(255,255,255,${hlOpacity + 0.12})`,
				`inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${maxDim + 4}px rgba(255,255,255,${hlOpacity * 0.4})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 2}px rgba(0,0,0,${shOpacity + 0.06})`,
				`inset ${shDir * Math.round(bW * 0.5)}px ${shDir * Math.round(bH * 0.5)}px ${maxDim + 4}px rgba(0,0,0,${shOpacity * 0.3})`,
			].join(', ');

		case 'relaxedInset':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 5}px rgba(255,255,255,${hlOpacity - 0.04})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 5}px rgba(0,0,0,${shOpacity - 0.04})`,
				`inset 0 0 ${maxDim + 8}px rgba(0,0,0,${shOpacity * 0.15})`,
			].join(', ');

		case 'hardEdge':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.18})`,
				`inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.18})`,
				`inset ${hlDir * Math.round(bW * 0.4)}px ${hlDir * Math.round(bH * 0.4)}px 0 rgba(255,255,255,${hlOpacity * 0.3})`,
			].join(', ');

		case 'cross':
			return [
				`inset ${hlDir * bW}px 0 ${bW}px rgba(255,255,255,${hlOpacity})`,
				`inset 0 ${hlDir * bH}px ${bH}px rgba(255,255,255,${hlOpacity})`,
				`inset ${shDir * bW}px 0 ${bW}px rgba(0,0,0,${shOpacity})`,
				`inset 0 ${shDir * bH}px ${bH}px rgba(0,0,0,${shOpacity})`,
				`inset 0 0 ${Math.round(maxDim * 0.5)}px rgba(0,0,0,${shOpacity * 0.2})`,
			].join(', ');

		case 'coolSlant':
			return [
				`inset ${hlDir * bW}px ${hlDir * Math.round(bH * 0.4)}px ${maxDim}px rgba(255,255,255,${hlOpacity + 0.12})`,
				`inset ${hlDir * Math.round(bW * 0.6)}px 0 ${Math.round(maxDim * 0.6)}px rgba(255,255,255,${hlOpacity * 0.4})`,
				`inset ${shDir * Math.round(bW * 0.4)}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity + 0.1})`,
			].join(', ');

		case 'angle':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${Math.round(maxDim * 0.4)}px rgba(255,255,255,${hlOpacity + 0.16})`,
				`inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px 0 rgba(255,255,255,${hlOpacity * 0.5})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${Math.round(maxDim * 0.4)}px rgba(0,0,0,${shOpacity + 0.12})`,
			].join(', ');

		case 'softRound':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 7}px rgba(255,255,255,${hlOpacity + 0.02})`,
				`inset ${hlDir * Math.round(bW * 0.3)}px ${hlDir * Math.round(bH * 0.3)}px ${maxDim + 10}px rgba(255,255,255,${hlOpacity * 0.3})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 7}px rgba(0,0,0,${shOpacity - 0.04})`,
			].join(', ');

		case 'convex':
			return [
				`inset 0 0 ${maxDim + 4}px rgba(255,255,255,${hlOpacity + 0.06})`,
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim}px rgba(255,255,255,${hlOpacity + 0.02})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
				`inset ${shDir * Math.round(bW * 1.5)}px ${shDir * Math.round(bH * 1.5)}px ${maxDim + 2}px rgba(0,0,0,${shOpacity * 0.3})`,
			].join(', ');

		case 'slope':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 4}px rgba(255,255,255,${hlOpacity + 0.06})`,
				`inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${maxDim + 6}px rgba(255,255,255,${hlOpacity * 0.35})`,
				`inset ${shDir * Math.round(bW * 0.7)}px ${shDir * Math.round(bH * 0.7)}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
			].join(', ');

		case 'divot':
			return [
				`inset ${shDir * Math.round(bW * 0.5)}px ${shDir * Math.round(bH * 0.5)}px ${Math.round(maxDim * 0.5)}px rgba(255,255,255,${hlOpacity + 0.06})`,
				`inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${Math.round(maxDim * 0.5)}px rgba(0,0,0,${shOpacity + 0.12})`,
				`inset 0 0 ${Math.round(maxDim * 0.3)}px rgba(0,0,0,${shOpacity * 0.3})`,
			].join(', ');

		case 'riblet':
			return [
				`inset 0 ${hlDir * bH}px ${Math.round(bH * 0.4)}px rgba(255,255,255,${hlOpacity + 0.02})`,
				`inset 0 ${shDir * bH}px ${Math.round(bH * 0.4)}px rgba(0,0,0,${shOpacity})`,
				`inset 0 ${hlDir * Math.round(bH * 2)}px ${bH}px rgba(255,255,255,${hlOpacity * 0.45})`,
				`inset 0 ${shDir * Math.round(bH * 2)}px ${bH}px rgba(0,0,0,${shOpacity * 0.25})`,
			].join(', ');

		case 'artDeco':
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.12})`,
				`inset ${hlDir * Math.round(bW * 2)}px ${hlDir * Math.round(bH * 2)}px 0 rgba(255,255,255,${hlOpacity * 0.45})`,
				`inset ${hlDir * Math.round(bW * 3)}px ${hlDir * Math.round(bH * 3)}px 0 rgba(255,255,255,${hlOpacity * 0.2})`,
				`inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.12})`,
				`inset ${shDir * Math.round(bW * 2)}px ${shDir * Math.round(bH * 2)}px 0 rgba(0,0,0,${shOpacity * 0.4})`,
			].join(', ');

		default:
			return [
				`inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim}px rgba(255,255,255,${hlOpacity})`,
				`inset ${shDir * bW}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
			].join(', ');
	}
}

// ── Extrusion shadow generation ──────────────────────────────────────────

/** Darken a hex colour by a factor (0 = black, 1 = unchanged). */
function darkenColor(hex: string, factor: number): string {
	const clean = hex.replace('#', '');
	const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
	const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
	const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
	return `rgb(${r},${g},${b})`;
}

/** Compute (dx, dy) extrusion offset direction from camera rotation. */
function getExtrusionDirection(rotateX: number, rotateY: number): { dx: number; dy: number } {
	let dx = 1;
	let dy = 1;

	if (rotateY > 5) {
		dx = -1;
	} else if (rotateY < -5) {
		dx = 1;
	}

	if (rotateX < -5) {
		dy = 1;
	} else if (rotateX > 5) {
		dy = -1;
	}

	return { dx, dy };
}

// ── Public pure functions ────────────────────────────────────────────────

/** The CSS pieces produced by {@link get3dTransformCss}. */
export interface Transform3dCss {
	transform?: string;
	transformStyle?: string;
	perspective?: string;
}

/**
 * Camera/perspective → CSS transform. Maps OOXML camera presets and explicit
 * rotation angles to `perspective(...)` + `rotateX/Y/Z(...)`. When extrusion is
 * present a `translateZ` is appended so the front face sits above the stacked
 * box-shadow depth (mirrors React's `apply3dEffects`).
 *
 * Returns `undefined` when there is nothing 3D to apply.
 */
export function get3dTransformCss(
	scene3d: Pptx3DScene | undefined,
	shape3d: Pptx3DShape | undefined,
): Transform3dCss | undefined {
	if (!scene3d && !shape3d) {
		return undefined;
	}

	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);
	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	const hasExtrusion = Boolean(shape3d?.extrusionHeight && shape3d.extrusionHeight > 0);

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

	if (hasExtrusion && shape3d) {
		const depthPx = Math.max(1, Math.round((shape3d.extrusionHeight ?? 0) / EMU_PER_PX));
		const halfDepth = Math.min(depthPx, 80) / 2;
		transforms.push(`translateZ(${halfDepth}px)`);
	}

	const has3D = hasRotation || Boolean(perspective) || Boolean(shape3d);
	if (!has3D && transforms.length === 0) {
		return undefined;
	}

	const result: Transform3dCss = {};
	if (perspective) {
		result.perspective = perspective;
	}
	if (transforms.length > 0) {
		result.transform = transforms.join(' ');
	}
	if (has3D) {
		result.transformStyle = 'preserve-3d';
	}

	return result;
}

/**
 * Extrusion depth → layered `box-shadow`. Stacks up to {@link MAX_EXTRUSION_LAYERS}
 * offset shadows (radiating per camera angle) with a final soft shadow for
 * depth perception. Returns `undefined` when there is no extrusion.
 */
export function getExtrusionBoxShadow(
	shape3d: Pptx3DShape | undefined,
	cameraRotX = 0,
	cameraRotY = 0,
): string | undefined {
	if (!shape3d?.extrusionHeight || shape3d.extrusionHeight <= 0) {
		return undefined;
	}

	const rawDepthPx = Math.round(shape3d.extrusionHeight / EMU_PER_PX);
	if (rawDepthPx <= 0) {
		return undefined;
	}

	const layerCount = Math.min(rawDepthPx, MAX_EXTRUSION_LAYERS);
	const step = rawDepthPx / layerCount;

	const extColor = shape3d.extrusionColor || '#888888';
	const { dx, dy } = getExtrusionDirection(cameraRotX, cameraRotY);
	const depthShadows: string[] = [];

	for (let i = 1; i <= layerCount; i++) {
		const offset = Math.round(i * step);
		const darkenFactor = 1 - (i / layerCount) * 0.25;
		const layerColor = i > layerCount * 0.7 ? darkenColor(extColor, darkenFactor) : extColor;
		const spread = step > 1.5 ? Math.ceil(step / 2) : 0;
		depthShadows.push(`${dx * offset}px ${dy * offset}px ${spread}px ${layerColor}`);
	}

	const finalOffset = rawDepthPx + 1;
	depthShadows.push(
		`${dx * finalOffset}px ${dy * finalOffset}px ${Math.max(2, Math.round(rawDepthPx / 3))}px rgba(0,0,0,0.2)`,
	);

	return depthShadows.join(', ');
}

/** Contour (outline ring) → box-shadow. Returns `undefined` when no contour. */
export function getContourBoxShadow(shape3d: Pptx3DShape | undefined): string | undefined {
	if (!shape3d?.contourWidth || shape3d.contourWidth <= 0) {
		return undefined;
	}
	const widthPx = Math.max(1, Math.round(shape3d.contourWidth / EMU_PER_PX));
	const color = shape3d.contourColor || '#000000';
	return `0 0 0 ${widthPx}px ${color}`;
}

/** The CSS produced by {@link getBevelStyle}. */
export interface BevelCss {
	boxShadow: string;
	background?: string;
}

/**
 * Bevel preset → inset `box-shadow` (top + bottom bevels combined), plus an
 * optional background gradient for presets that benefit from one
 * (convex/divot/softRound). Returns `undefined` when no bevel is present.
 */
export function getBevelStyle(shape3d: Pptx3DShape | undefined): BevelCss | undefined {
	if (!shape3d) {
		return undefined;
	}

	const parts: string[] = [];

	if (shape3d.bevelTopType && shape3d.bevelTopType !== 'none') {
		const bW = shape3d.bevelTopWidth
			? Math.max(1, Math.round(shape3d.bevelTopWidth / EMU_PER_PX))
			: 3;
		const bH = shape3d.bevelTopHeight
			? Math.max(1, Math.round(shape3d.bevelTopHeight / EMU_PER_PX))
			: 3;
		parts.push(getBevelShadow(shape3d.bevelTopType, bW, bH, false));
	}

	if (shape3d.bevelBottomType && shape3d.bevelBottomType !== 'none') {
		const bW = shape3d.bevelBottomWidth
			? Math.max(1, Math.round(shape3d.bevelBottomWidth / EMU_PER_PX))
			: 3;
		const bH = shape3d.bevelBottomHeight
			? Math.max(1, Math.round(shape3d.bevelBottomHeight / EMU_PER_PX))
			: 3;
		parts.push(getBevelShadow(shape3d.bevelBottomType, bW, bH, true));
	}

	if (parts.length === 0) {
		return undefined;
	}

	let background: string | undefined;
	switch (shape3d.bevelTopType) {
		case 'convex':
			background =
				'radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)';
			break;
		case 'divot':
			background = 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.04) 0%, transparent 50%)';
			break;
		case 'softRound':
			background =
				'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.06) 0%, transparent 55%)';
			break;
	}

	return { boxShadow: parts.join(', '), background };
}

/** Material preset → CSS `filter`. Returns `undefined` when none/flat. */
export function getMaterialFilter(shape3d: Pptx3DShape | undefined): string | undefined {
	if (!shape3d?.presetMaterial) {
		return undefined;
	}
	return getMaterialCssOverrides(shape3d.presetMaterial).filter;
}

/**
 * Aggregate 3D CSS for a shape style's `scene3d`/`shape3d`.
 *
 * NOTE: the extrusion box-shadow is returned SEPARATELY as `extrusionBoxShadow`
 * (and contour/bevel/material/backdrop shadows folded into `boxShadow`). The
 * caller is expected to comma-join `extrusionBoxShadow` AND `boxShadow` with
 * any pre-existing effect shadow rather than overwrite it. `filter`,
 * `backgroundImage` and `opacity` should likewise be merged, not clobbered.
 */
export interface Computed3dStyle {
	transform?: string;
	transformStyle?: string;
	perspective?: string;
	willChange?: string;
	/** Stacked extrusion depth shadow — combine separately from `boxShadow`. */
	extrusionBoxShadow?: string;
	/** Contour + bevel + backdrop + material specular shadows (comma-joined). */
	boxShadow?: string;
	background?: string;
	backgroundImage?: string;
	filter?: string;
	opacity?: number;
}

/**
 * Compute the complete set of 3D CSS for an element's shape style. Reads
 * `scene3d`/`shape3d` off the element's `shapeStyle`. Returns `undefined`
 * when the element carries no 3D data so callers can skip merging entirely.
 */
export function getComputed3dStyle(el: PptxElement): Computed3dStyle | undefined {
	if (!hasShapeProperties(el)) {
		return undefined;
	}
	const ss = el.shapeStyle;
	const scene3d = ss?.scene3d;
	const shape3d = ss?.shape3d;

	if (!scene3d && !shape3d) {
		return undefined;
	}

	const result: Computed3dStyle = {};

	// ── Camera / perspective / rotation ──
	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);
	const transformCss = get3dTransformCss(scene3d, shape3d);
	if (transformCss?.perspective) {
		result.perspective = transformCss.perspective;
	}
	if (transformCss?.transform) {
		result.transform = transformCss.transform;
	}
	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	if (hasRotation || perspective || shape3d) {
		result.willChange = 'transform';
		result.transformStyle = 'preserve-3d';
	}

	// ── Extrusion (kept SEPARATE for shadow combination) ──
	const extrusion = getExtrusionBoxShadow(shape3d, rotateX, rotateY);
	if (extrusion) {
		result.extrusionBoxShadow = extrusion;
	}

	// ── Contour + bevel + backdrop shadows (folded into boxShadow) ──
	const shadowParts: string[] = [];
	const contour = getContourBoxShadow(shape3d);
	if (contour) {
		shadowParts.push(contour);
	}
	const bevel = getBevelStyle(shape3d);
	if (bevel) {
		shadowParts.push(bevel.boxShadow);
		if (bevel.background) {
			result.background = bevel.background;
		}
	}
	if (scene3d?.hasBackdrop) {
		shadowParts.push('0px 8px 24px -4px rgba(0,0,0,0.25)');
	}

	// ── Material preset ──
	const filterParts: string[] = [];
	const bgParts: string[] = [];
	if (shape3d?.presetMaterial) {
		const mat = getMaterialCssOverrides(shape3d.presetMaterial);
		if (mat.filter) {
			filterParts.push(mat.filter);
		}
		if (mat.opacity !== undefined) {
			result.opacity = mat.opacity;
		}
		if (mat.boxShadow) {
			shadowParts.push(mat.boxShadow);
		}
		if (mat.backgroundImage) {
			bgParts.push(mat.backgroundImage);
		}
	}

	// ── Light rig ──
	const lightRig = getLightRigCss(scene3d?.lightRigType, scene3d?.lightRigDirection);
	if (lightRig.filter) {
		filterParts.push(lightRig.filter);
	}
	if (lightRig.backgroundImage) {
		bgParts.push(lightRig.backgroundImage);
	}

	if (shadowParts.length > 0) {
		result.boxShadow = shadowParts.join(', ');
	}
	if (filterParts.length > 0) {
		result.filter = filterParts.join(' ');
	}
	if (bgParts.length > 0) {
		result.backgroundImage = bgParts.join(', ');
	}

	return result;
}

/**
 * Convenience: merge a {@link Computed3dStyle} into an existing `CSSProperties`
 * object, COMBINING shadows/filters/backgrounds rather than overwriting. This
 * is the recommended integration helper for `getShapeFillStrokeStyle`.
 *
 * - `extrusionBoxShadow` + `boxShadow` are comma-joined with `base.boxShadow`.
 * - `filter` is space-joined; `backgroundImage` comma-joined (3D layer first).
 * - `transform` from 3D is appended after any existing transform.
 */
export function merge3dStyle(base: CSSProperties, computed: Computed3dStyle | undefined): void {
	if (!computed) {
		return;
	}

	const shadowPieces: string[] = [];
	if (base.boxShadow) {
		shadowPieces.push(String(base.boxShadow));
	}
	if (computed.extrusionBoxShadow) {
		shadowPieces.push(computed.extrusionBoxShadow);
	}
	if (computed.boxShadow) {
		shadowPieces.push(computed.boxShadow);
	}
	if (shadowPieces.length > 0) {
		base.boxShadow = shadowPieces.join(', ');
	}

	if (computed.transform) {
		base.transform = base.transform
			? `${String(base.transform)} ${computed.transform}`
			: computed.transform;
	}
	if (computed.perspective) {
		base.perspective = computed.perspective;
	}
	if (computed.transformStyle) {
		base.transformStyle = computed.transformStyle as CSSProperties['transformStyle'];
	}
	if (computed.willChange) {
		base.willChange = computed.willChange;
	}
	if (computed.filter) {
		base.filter = base.filter ? `${String(base.filter)} ${computed.filter}` : computed.filter;
	}
	if (computed.backgroundImage) {
		base.backgroundImage = base.backgroundImage
			? `${computed.backgroundImage}, ${String(base.backgroundImage)}`
			: computed.backgroundImage;
	}
	if (computed.background && !base.background) {
		base.background = computed.background;
	}
	if (computed.opacity !== undefined && base.opacity === undefined) {
		base.opacity = computed.opacity;
	}
}
