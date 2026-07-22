/**
 * CSS-based 3D approximation for PPTX shapes (framework-agnostic).
 *
 * Translates OOXML scene3d/shape3d properties (camera/perspective, extrusion
 * depth, contour, bevel, material, light rig) into the CSS pieces a renderer
 * can apply. This is the single source of truth consumed by every binding —
 * React, Vue, and Angular re-export it (the React layer used to reimplement
 * the whole engine; it now shims onto this module).
 *
 * Two complementary output shapes are provided:
 *
 * 1. **Neutral pieces** — {@link getComputed3dStyle} returns plain
 *    string/number CSS pieces (no framework `CSSProperties` type) so each
 *    binding can merge them into its own style object. The extrusion box-shadow
 *    is returned SEPARATELY as `extrusionBoxShadow` so callers can comma-join it
 *    with any pre-existing effect shadow rather than clobbering it.
 * 2. **Mutator helpers** — {@link apply3dEffects} folds the same effects into a
 *    caller-supplied mutable style object (the legacy React integration point).
 *    React/Vue/Angular pass their own `CSSProperties`-typed object in.
 *
 * Sibling modules keep this file small and reusable:
 * `visual-3d-camera` (camera presets), `visual-3d-materials` (material presets
 * + camera-aware overlay), `visual-3d-extrusion` (CSS 3D side panels),
 * `visual-3d-color` / `visual-3d-constants` (shared helpers).
 *
 * @module render/visual-3d
 */

import type { PptxElement, Pptx3DScene, Pptx3DShape, MaterialPresetType } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { getCameraTransform } from './visual-3d-camera';
import type { Scene3dParams } from './visual-3d-camera';
import { darkenColor } from './visual-3d-color';
import { EMU_PER_PX, MAX_EXTRUSION_LAYERS } from './visual-3d-constants';
import { getMaterialCssOverrides } from './visual-3d-materials';

export { getCameraTransform } from './visual-3d-camera';
export type { Scene3dParams, CameraTransform } from './visual-3d-camera';
export {
	getMaterialCssOverrides,
	getMaterialGradientOverlay,
	getLightAngleFromCamera,
} from './visual-3d-materials';
export type { MaterialCssOverrides } from './visual-3d-materials';
export { build3DExtrusionData } from './visual-3d-extrusion';
export type {
	Extrusion3DData,
	ExtrusionPanel,
	Extrusion3dCss,
	Shape3dExtrusionParams,
} from './visual-3d-extrusion';

/** Structural subset of `Pptx3DShape` consumed by the 3D helpers. */
export interface Shape3dParams {
	extrusionHeight?: number;
	extrusionColor?: string;
	contourWidth?: number;
	contourColor?: string;
	bevelTopType?: string;
	bevelTopWidth?: number;
	bevelTopHeight?: number;
	bevelBottomType?: string;
	bevelBottomWidth?: number;
	bevelBottomHeight?: number;
	presetMaterial?: string;
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

/**
 * Normalise an arbitrary colour string to an expanded `#RRGGBB` hex, or
 * `undefined` when it is missing/not a hex colour. 3-digit shorthand (`#000`)
 * is expanded to 6 digits. Used so extrusion/contour colours (which are passed
 * straight into CSS and into {@link darkenColor}, both of which require a
 * `#`-prefixed 6-digit hex) never emit an invalid value such as a bare
 * `FF0000`, a themed `rgb()` string, or an 8-digit hex.
 */
function safeHexColor(color: string | undefined): string | undefined {
	if (!color) {
		return undefined;
	}
	const candidate = color.startsWith('#') ? color : `#${color}`;
	if (/^#[0-9a-fA-F]{6}$/u.test(candidate)) {
		return candidate;
	}
	const short = /^#(?<r>[0-9a-fA-F])(?<g>[0-9a-fA-F])(?<b>[0-9a-fA-F])$/u.exec(candidate);
	if (short?.groups) {
		const { r, g, b } = short.groups;
		return `#${r}${r}${g}${g}${b}${b}`;
	}
	return undefined;
}

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
export function getLightRigCss(
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
 *
 * Exported under two names: {@link getExtrusionBoxShadow} (neutral pieces API)
 * and the React-compatible alias {@link getExtrusionShadow}.
 *
 * `fillColorFallback` supplies the shape's resolved fill colour, which is what
 * PowerPoint uses for the extrusion side faces when `a:sp3d/@extrusionClr` is
 * omitted; only when neither is a valid hex do we fall back to a neutral grey.
 */
export function getExtrusionBoxShadow(
	shape3d: Shape3dParams | undefined,
	cameraRotX = 0,
	cameraRotY = 0,
	fillColorFallback?: string,
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

	const extColor =
		safeHexColor(shape3d.extrusionColor) ?? safeHexColor(fillColorFallback) ?? '#888888';
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

/** React-compatible alias for {@link getExtrusionBoxShadow}. */
export const getExtrusionShadow = getExtrusionBoxShadow;

/**
 * Contour (outline ring) → box-shadow. Returns `undefined` when no contour.
 *
 * The ring width mirrors `a:sp3d/@contourW` faithfully (EMU → px, min 1px).
 * `lineColorFallback` supplies the shape's stroke/line colour, which PowerPoint
 * uses for the contour when `a:sp3d/a:contourClr` is omitted; the previous
 * `contourColor || '#000000'` fallback also emitted an invalid CSS colour when
 * the parsed contour colour lacked a leading `#`, which {@link safeHexColor}
 * now normalises.
 */
export function getContourBoxShadow(
	shape3d: Shape3dParams | undefined,
	lineColorFallback?: string,
): string | undefined {
	if (!shape3d?.contourWidth || shape3d.contourWidth <= 0) {
		return undefined;
	}
	const widthPx = Math.max(1, Math.round(shape3d.contourWidth / EMU_PER_PX));
	const color = safeHexColor(shape3d.contourColor) ?? safeHexColor(lineColorFallback) ?? '#000000';
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
export function getBevelStyle(shape3d: Shape3dParams | undefined): BevelCss | undefined {
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

/**
 * Bevel preset → inset `box-shadow` string only (top + bottom combined). The
 * React-compatible counterpart to {@link getBevelStyle} that returns just the
 * shadow (no background gradient). Returns `undefined` when no bevel is present.
 */
export function get3DBevelShadow(shape3d: Shape3dParams | undefined): string | undefined {
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

	return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Material preset → CSS `filter`. Returns `undefined` when none/flat. */
export function getMaterialFilter(shape3d: Shape3dParams | undefined): string | undefined {
	if (!shape3d?.presetMaterial) {
		return undefined;
	}
	return getMaterialCssOverrides(shape3d.presetMaterial as MaterialPresetType).filter;
}

/** React-compatible alias for {@link getMaterialFilter}. */
export const get3DMaterialFilter = getMaterialFilter;

/**
 * Camera/perspective → mutable CSS transform fields. React-compatible helper:
 * returns a plain object with `perspective`/`transform`/`willChange`. Unlike
 * {@link get3dTransformCss} this does NOT append an extrusion `translateZ`
 * (that is handled by {@link apply3dEffects}).
 */
export function get3DTransformStyle(
	scene3d: Scene3dParams | undefined,
	shape3d?: Shape3dParams | undefined,
): Record<string, string> {
	if (!scene3d && !shape3d) {
		return {};
	}

	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);

	const style: Record<string, string> = {};

	if (perspective) {
		style.perspective = perspective;
	}

	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	const has3D = hasRotation || Boolean(perspective) || Boolean(shape3d);

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

	if (has3D) {
		style.willChange = 'transform';
	}

	return style;
}

/**
 * A mutable CSS style object the {@link apply3dEffects} mutator folds effects
 * into. Framework-neutral (string/number map); bindings pass their own
 * `CSSProperties`-typed object, which structurally satisfies this.
 */
export type MutableCss = {
	transform?: string;
	transformStyle?: string;
	perspective?: string | number;
	willChange?: string;
	boxShadow?: string;
	background?: string;
	backgroundImage?: string;
	filter?: string;
	opacity?: number;
};

/**
 * Apply 3D effects (perspective, rotation, extrusion, bevel, material, light
 * rig, contour, backdrop) to a mutable CSS properties object. The legacy React
 * integration point: each binding passes its own `CSSProperties` object (which
 * structurally satisfies {@link MutableCss}) and the fields are folded in,
 * preserving any pre-existing `transform`/`boxShadow`/`filter`/`backgroundImage`.
 *
 * `fillColorFallback` (the shape's resolved fill colour) is used as the
 * extrusion side-face and contour colour when `extrusionClr`/`contourClr` are
 * omitted, matching PowerPoint; callers that have the resolved fill should pass
 * it for higher fidelity.
 */
export function apply3dEffects(
	base: MutableCss,
	scene3d: Scene3dParams | undefined,
	shape3d: Shape3dParams | undefined,
	fillColorFallback?: string,
): void {
	if (!scene3d && !shape3d) {
		return;
	}

	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);

	if (perspective) {
		base.perspective = perspective;
	}

	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;

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
		const rotation3d = transforms.join(' ');
		// Compose with any existing transform (e.g. flip/rotation).
		base.transform = base.transform ? `${base.transform} ${rotation3d}` : rotation3d;
	}

	// When extrusion is active, push the front face forward in Z-space so the
	// stacked box-shadow extrusion appears behind it.
	if (shape3d?.extrusionHeight && shape3d.extrusionHeight > 0) {
		const depthPx = Math.max(1, Math.round(shape3d.extrusionHeight / EMU_PER_PX));
		const halfDepth = Math.min(depthPx, 80) / 2;
		const zTranslate = `translateZ(${halfDepth}px)`;
		base.transform = base.transform ? `${base.transform} ${zTranslate}` : zTranslate;
	}

	if (hasRotation || perspective || shape3d) {
		base.willChange = 'transform';
		base.transformStyle = 'preserve-3d';
	}

	// ── Extrusion depth → stacked box-shadow ──
	const extrusionShadow = getExtrusionBoxShadow(shape3d, rotateX, rotateY, fillColorFallback);
	if (extrusionShadow) {
		base.boxShadow = base.boxShadow ? `${base.boxShadow}, ${extrusionShadow}` : extrusionShadow;
	}

	// ── Contour (outline ring) ──
	const contourShadow = getContourBoxShadow(shape3d, fillColorFallback);
	if (contourShadow) {
		base.boxShadow = base.boxShadow ? `${base.boxShadow}, ${contourShadow}` : contourShadow;
	}

	// ── Bevel highlights/shadows ──
	const bevelShadow = get3DBevelShadow(shape3d);
	if (bevelShadow) {
		base.boxShadow = base.boxShadow ? `${base.boxShadow}, ${bevelShadow}` : bevelShadow;
	}

	// ── Backdrop plane → ground-plane shadow ──
	if (scene3d?.hasBackdrop) {
		const backdropShadow = '0px 8px 24px -4px rgba(0,0,0,0.25)';
		base.boxShadow = base.boxShadow ? `${base.boxShadow}, ${backdropShadow}` : backdropShadow;
	}

	// ── Material preset → CSS filter/opacity/gradient ──
	if (shape3d?.presetMaterial) {
		const matOverrides = getMaterialCssOverrides(shape3d.presetMaterial as MaterialPresetType);
		if (matOverrides.filter) {
			base.filter = base.filter ? `${base.filter} ${matOverrides.filter}` : matOverrides.filter;
		}
		if (matOverrides.opacity !== undefined) {
			base.opacity = matOverrides.opacity;
		}
		if (matOverrides.boxShadow) {
			base.boxShadow = base.boxShadow
				? `${base.boxShadow}, ${matOverrides.boxShadow}`
				: matOverrides.boxShadow;
		}
		if (matOverrides.backgroundImage) {
			base.backgroundImage = base.backgroundImage
				? `${matOverrides.backgroundImage}, ${base.backgroundImage}`
				: matOverrides.backgroundImage;
		}
	}

	// ── Light rig → gradient overlay and filter adjustment ──
	const lightRig = getLightRigCss(scene3d?.lightRigType, scene3d?.lightRigDirection);
	if (lightRig.filter) {
		base.filter = base.filter ? `${base.filter} ${lightRig.filter}` : lightRig.filter;
	}
	if (lightRig.backgroundImage) {
		base.backgroundImage = base.backgroundImage
			? `${lightRig.backgroundImage}, ${base.backgroundImage}`
			: lightRig.backgroundImage;
	}
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

	// Resolved fill/stroke colours drive the extrusion side-face and contour
	// colours when `extrusionClr`/`contourClr` are omitted (PowerPoint default).
	const fillColor = ss?.fillColor;
	const strokeColor = ss?.strokeColor;

	// ── Extrusion (kept SEPARATE for shadow combination) ──
	const extrusion = getExtrusionBoxShadow(shape3d, rotateX, rotateY, fillColor);
	if (extrusion) {
		result.extrusionBoxShadow = extrusion;
	}

	// ── Contour + bevel + backdrop shadows (folded into boxShadow) ──
	const shadowParts: string[] = [];
	const contour = getContourBoxShadow(shape3d, strokeColor ?? fillColor);
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
		const mat = getMaterialCssOverrides(shape3d.presetMaterial as MaterialPresetType);
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
