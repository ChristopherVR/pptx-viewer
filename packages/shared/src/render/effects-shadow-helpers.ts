/**
 * effects-shadow-helpers.ts: Pure (no framework) outer/inner shadow helpers
 * for the effects panel.
 *
 * Split out of `effects-helpers.ts` (glow/reflection/soft-edge stay there) to
 * keep both files under this repo's 300-LOC-per-file budget; `EffectsState`
 * still composes both halves into one shape for the panel.
 */

import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

/** Editable outer shadow state. */
export interface OuterShadowState {
	enabled: boolean;
	color: string;
	opacity: number;
	blur: number;
	/** Direction angle in degrees. */
	angle: number;
	/** Distance in px. */
	distance: number;
	/**
	 * Whether the shadow rotates along with the shape (`a:outerShdw@rotWithShape`).
	 * Defaults `true`, matching PowerPoint's own default when the attribute is
	 * absent.
	 */
	rotateWithShape: boolean;
}

/** Editable inner shadow state. */
export interface InnerShadowState {
	enabled: boolean;
	color: string;
	opacity: number;
	blur: number;
	offsetX: number;
	offsetY: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/**
 * Build a Partial<PptxElement> by merging `changes` into the element's
 * existing shapeStyle. Preserves all unrelated ShapeStyle fields.
 */
function shapeStyleMergePatch(el: PptxElement, changes: Partial<ShapeStyle>): Partial<PptxElement> {
	const base: ShapeStyle = hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	return { shapeStyle: { ...base, ...changes } } as Partial<PptxElement>;
}

/** Extract the current outer-shadow state from a shapeStyle, with defaults. */
export function outerShadowStateOf(ss: ShapeStyle | undefined): OuterShadowState {
	const enabled = Boolean(ss?.shadowColor) && ss?.shadowColor !== 'transparent';
	const color = ss?.shadowColor && ss.shadowColor !== 'transparent' ? ss.shadowColor : '#000000';
	const opacity = typeof ss?.shadowOpacity === 'number' ? ss.shadowOpacity : 0.35;
	const blur = typeof ss?.shadowBlur === 'number' ? ss.shadowBlur : 6;
	const angle = typeof ss?.shadowAngle === 'number' ? ss.shadowAngle : 315;
	const distance = typeof ss?.shadowDistance === 'number' ? ss.shadowDistance : 5.66;
	const rotateWithShape = ss?.shadowRotateWithShape ?? true;
	return { enabled, color, opacity, blur, angle, distance, rotateWithShape };
}

/** Extract the current inner-shadow state from a shapeStyle, with defaults. */
export function innerShadowStateOf(ss: ShapeStyle | undefined): InnerShadowState {
	const enabled = Boolean(ss?.innerShadowColor) && ss?.innerShadowColor !== 'transparent';
	const color =
		ss?.innerShadowColor && ss.innerShadowColor !== 'transparent' ? ss.innerShadowColor : '#000000';
	const opacity = typeof ss?.innerShadowOpacity === 'number' ? ss.innerShadowOpacity : 0.5;
	const blur = typeof ss?.innerShadowBlur === 'number' ? ss.innerShadowBlur : 5;
	const offsetX = typeof ss?.innerShadowOffsetX === 'number' ? ss.innerShadowOffsetX : 0;
	const offsetY = typeof ss?.innerShadowOffsetY === 'number' ? ss.innerShadowOffsetY : 0;
	return { enabled, color, opacity, blur, offsetX, offsetY };
}

/** Enable outer shadow with current or default values. */
export function enableOuterShadowPatch(
	el: PptxElement,
	state: OuterShadowState,
): Partial<PptxElement> {
	const angleRad = (state.angle * Math.PI) / 180;
	return shapeStyleMergePatch(el, {
		shadowColor: state.color,
		shadowOpacity: state.opacity,
		shadowBlur: state.blur,
		shadowAngle: state.angle,
		shadowDistance: state.distance,
		shadowOffsetX: Math.cos(angleRad) * state.distance,
		shadowOffsetY: Math.sin(angleRad) * state.distance,
		shadowRotateWithShape: state.rotateWithShape,
	});
}

/** Disable outer shadow by setting transparent. */
export function disableOuterShadowPatch(el: PptxElement): Partial<PptxElement> {
	return shapeStyleMergePatch(el, { shadowColor: 'transparent' });
}

/**
 * Update a single outer-shadow field. Re-derives offsetX/Y from angle+distance
 * when either is changed to keep the coordinate pair consistent.
 */
export function updateOuterShadowPatch(
	el: PptxElement,
	changes: Partial<OuterShadowState>,
): Partial<PptxElement> {
	const cur = outerShadowStateOf(hasShapeProperties(el) ? el.shapeStyle : undefined);
	const next = { ...cur, ...changes };
	const angleRad = (next.angle * Math.PI) / 180;
	return shapeStyleMergePatch(el, {
		shadowColor: next.color,
		shadowOpacity: clamp(next.opacity, 0, 1),
		shadowBlur: Math.max(0, next.blur),
		shadowAngle: next.angle,
		shadowDistance: Math.max(0, next.distance),
		shadowOffsetX: Math.cos(angleRad) * next.distance,
		shadowOffsetY: Math.sin(angleRad) * next.distance,
		shadowRotateWithShape: next.rotateWithShape,
	});
}

/** Enable inner shadow with current or default values. */
export function enableInnerShadowPatch(
	el: PptxElement,
	state: InnerShadowState,
): Partial<PptxElement> {
	return shapeStyleMergePatch(el, {
		innerShadowColor: state.color,
		innerShadowOpacity: state.opacity,
		innerShadowBlur: state.blur,
		innerShadowOffsetX: state.offsetX,
		innerShadowOffsetY: state.offsetY,
	});
}

/** Disable inner shadow. */
export function disableInnerShadowPatch(el: PptxElement): Partial<PptxElement> {
	return shapeStyleMergePatch(el, { innerShadowColor: 'transparent' });
}

/** Update a single inner-shadow field. */
export function updateInnerShadowPatch(
	el: PptxElement,
	changes: Partial<InnerShadowState>,
): Partial<PptxElement> {
	const cur = innerShadowStateOf(hasShapeProperties(el) ? el.shapeStyle : undefined);
	const next = { ...cur, ...changes };
	return shapeStyleMergePatch(el, {
		innerShadowColor: next.color,
		innerShadowOpacity: clamp(next.opacity, 0, 1),
		innerShadowBlur: Math.max(0, next.blur),
		innerShadowOffsetX: next.offsetX,
		innerShadowOffsetY: next.offsetY,
	});
}
