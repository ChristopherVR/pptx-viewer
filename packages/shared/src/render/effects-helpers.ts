/**
 * effects-helpers.ts: Pure (no framework) helpers for the effects panel.
 *
 * Readers extract effect values from a PptxElement (with sensible defaults),
 * and patch-builders produce shallow-merge-ready Partial<PptxElement> objects
 * for the binding's element-update path. Shared across React, Vue, and Angular.
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

/** Editable glow state. */
export interface GlowState {
	enabled: boolean;
	color: string;
	radius: number;
	opacity: number;
}

/** Editable reflection state. */
export interface ReflectionState {
	enabled: boolean;
	blurRadius: number;
	startOpacity: number;
	endOpacity: number;
	distance: number;
	direction: number;
}

/** Editable soft-edge (blur) state. */
export interface SoftEdgeState {
	enabled: boolean;
	radius: number;
}

/** All effect values collected for the panel. */
export interface EffectsState {
	outerShadow: OuterShadowState;
	innerShadow: InnerShadowState;
	glow: GlowState;
	reflection: ReflectionState;
	softEdge: SoftEdgeState;
}

/**
 * Extract the full EffectsState from an element's shapeStyle.
 * Falls back to disabled defaults when the element carries no effects or is not
 * a shape-property element.
 */
export function effectsStateOf(el: PptxElement): EffectsState {
	const ss: ShapeStyle | undefined = hasShapeProperties(el) ? el.shapeStyle : undefined;
	return {
		outerShadow: outerShadowStateOf(ss),
		innerShadow: innerShadowStateOf(ss),
		glow: glowStateOf(ss),
		reflection: reflectionStateOf(ss),
		softEdge: softEdgeStateOf(ss),
	};
}

function outerShadowStateOf(ss: ShapeStyle | undefined): OuterShadowState {
	const enabled = Boolean(ss?.shadowColor) && ss?.shadowColor !== 'transparent';
	const color = ss?.shadowColor && ss.shadowColor !== 'transparent' ? ss.shadowColor : '#000000';
	const opacity = typeof ss?.shadowOpacity === 'number' ? ss.shadowOpacity : 0.35;
	const blur = typeof ss?.shadowBlur === 'number' ? ss.shadowBlur : 6;
	const angle = typeof ss?.shadowAngle === 'number' ? ss.shadowAngle : 315;
	const distance = typeof ss?.shadowDistance === 'number' ? ss.shadowDistance : 5.66;
	return { enabled, color, opacity, blur, angle, distance };
}

function innerShadowStateOf(ss: ShapeStyle | undefined): InnerShadowState {
	const enabled = Boolean(ss?.innerShadowColor) && ss?.innerShadowColor !== 'transparent';
	const color =
		ss?.innerShadowColor && ss.innerShadowColor !== 'transparent' ? ss.innerShadowColor : '#000000';
	const opacity = typeof ss?.innerShadowOpacity === 'number' ? ss.innerShadowOpacity : 0.5;
	const blur = typeof ss?.innerShadowBlur === 'number' ? ss.innerShadowBlur : 5;
	const offsetX = typeof ss?.innerShadowOffsetX === 'number' ? ss.innerShadowOffsetX : 0;
	const offsetY = typeof ss?.innerShadowOffsetY === 'number' ? ss.innerShadowOffsetY : 0;
	return { enabled, color, opacity, blur, offsetX, offsetY };
}

function glowStateOf(ss: ShapeStyle | undefined): GlowState {
	const enabled = Boolean(ss?.glowColor) && ss?.glowColor !== 'transparent';
	const color = ss?.glowColor && ss.glowColor !== 'transparent' ? ss.glowColor : '#ffff00';
	const radius = typeof ss?.glowRadius === 'number' ? ss.glowRadius : 6;
	const opacity = typeof ss?.glowOpacity === 'number' ? ss.glowOpacity : 0.75;
	return { enabled, color, radius, opacity };
}

function reflectionStateOf(ss: ShapeStyle | undefined): ReflectionState {
	const enabled =
		(typeof ss?.reflectionBlurRadius === 'number' && ss.reflectionBlurRadius > 0) ||
		(typeof ss?.reflectionStartOpacity === 'number' && ss.reflectionStartOpacity > 0);
	const blurRadius = typeof ss?.reflectionBlurRadius === 'number' ? ss.reflectionBlurRadius : 3;
	const startOpacity =
		typeof ss?.reflectionStartOpacity === 'number' ? ss.reflectionStartOpacity : 50;
	const endOpacity = typeof ss?.reflectionEndOpacity === 'number' ? ss.reflectionEndOpacity : 0;
	const distance = typeof ss?.reflectionDistance === 'number' ? ss.reflectionDistance : 0;
	const direction = typeof ss?.reflectionDirection === 'number' ? ss.reflectionDirection : 90;
	return { enabled, blurRadius, startOpacity, endOpacity, distance, direction };
}

function softEdgeStateOf(ss: ShapeStyle | undefined): SoftEdgeState {
	const radius = typeof ss?.softEdgeRadius === 'number' ? ss.softEdgeRadius : 0;
	return { enabled: radius > 0, radius };
}

/**
 * Helper: build a Partial<PptxElement> by merging `changes` into the element's
 * existing shapeStyle. Preserves all unrelated ShapeStyle fields.
 */
function shapeStyleMergePatch(el: PptxElement, changes: Partial<ShapeStyle>): Partial<PptxElement> {
	const base: ShapeStyle = hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	return { shapeStyle: { ...base, ...changes } } as Partial<PptxElement>;
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

/** Enable glow with current or default values. */
export function enableGlowPatch(el: PptxElement, state: GlowState): Partial<PptxElement> {
	return shapeStyleMergePatch(el, {
		glowColor: state.color,
		glowRadius: Math.max(0, state.radius),
		glowOpacity: clamp(state.opacity, 0, 1),
	});
}

/** Disable glow. */
export function disableGlowPatch(el: PptxElement): Partial<PptxElement> {
	return shapeStyleMergePatch(el, { glowColor: 'transparent', glowRadius: 0 });
}

/** Update a single glow field. */
export function updateGlowPatch(
	el: PptxElement,
	changes: Partial<GlowState>,
): Partial<PptxElement> {
	const cur = glowStateOf(hasShapeProperties(el) ? el.shapeStyle : undefined);
	const next = { ...cur, ...changes };
	return shapeStyleMergePatch(el, {
		glowColor: next.color,
		glowRadius: Math.max(0, next.radius),
		glowOpacity: clamp(next.opacity, 0, 1),
	});
}

/** Enable reflection with current or default values. */
export function enableReflectionPatch(
	el: PptxElement,
	state: ReflectionState,
): Partial<PptxElement> {
	return shapeStyleMergePatch(el, {
		reflectionBlurRadius: Math.max(0, state.blurRadius),
		reflectionStartOpacity: clamp(state.startOpacity, 0, 100),
		reflectionEndOpacity: clamp(state.endOpacity, 0, 100),
		reflectionDistance: Math.max(0, state.distance),
		reflectionDirection: state.direction,
	});
}

/** Disable reflection. */
export function disableReflectionPatch(el: PptxElement): Partial<PptxElement> {
	return shapeStyleMergePatch(el, {
		reflectionBlurRadius: 0,
		reflectionStartOpacity: 0,
		reflectionEndOpacity: 0,
		reflectionDistance: 0,
		reflectionDirection: 0,
	});
}

/** Update a single reflection field. */
export function updateReflectionPatch(
	el: PptxElement,
	changes: Partial<ReflectionState>,
): Partial<PptxElement> {
	const cur = reflectionStateOf(hasShapeProperties(el) ? el.shapeStyle : undefined);
	const next = { ...cur, ...changes };
	return enableReflectionPatch(el, next);
}

/** Enable soft edge with the given radius. */
export function enableSoftEdgePatch(el: PptxElement, radius: number): Partial<PptxElement> {
	return shapeStyleMergePatch(el, { softEdgeRadius: Math.max(0, radius) });
}

/** Disable soft edge. */
export function disableSoftEdgePatch(el: PptxElement): Partial<PptxElement> {
	return shapeStyleMergePatch(el, { softEdgeRadius: 0 });
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}
