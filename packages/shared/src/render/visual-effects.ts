/**
 * Visual effects composable — pure CSS computation for OOXML shape/image effects.
 *
 * Mirrors the React `pptx-viewer` effect layer (shape-visual-style.ts +
 * color-core.ts + effect-dag-filters.ts) without any React/Vue runtime
 * dependency. Everything here is a pure function so it can be unit-tested
 * without mounting a component, then wired into `element-style.ts` /
 * `ElementRenderer.vue` by the integrator.
 *
 * It covers, for shapes/connectors/images:
 *  - **Outer shadow**       → CSS `box-shadow`
 *  - **Inner shadow**       → CSS `inset` `box-shadow`
 *  - **Multi-layer shadow** → comma-joined `box-shadow` (from `shadows[]`)
 *  - **Outer glow**         → CSS `filter: drop-shadow(...)` (simple path) and
 *                             optional layered `box-shadow` (high-fidelity path)
 *  - **Soft edges / blur**  → CSS `filter: blur(...)`
 *  - **Reflection**         → Chromium `-webkit-box-reflect`
 *  - **Effect DAG**         → CSS `filter` (grayscale/biLevel/lum/hsl/tint…),
 *                             `opacity`, `mix-blend-mode`, + optional duotone
 *                             `<filter>` SVG markup (high-fidelity path)
 *
 * Units/precedence match the React implementation: spatial values are already
 * in px on `ShapeStyle` (pre-converted from EMU by core), angles are degrees,
 * alpha is 0–1. The EMU constants are re-exported from core for callers that
 * need to convert raw values themselves.
 *
 * @module viewer/composables/visual-effects
 */

import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

// ── Low-level colour helpers (ported from React color-core.ts) ─────────────

const DEFAULT_SHADOW_COLOR = '#000000';
const DEFAULT_GLOW_COLOR = '#ffff00';

/**
 * Escape a string for safe inclusion in an SVG/XML attribute value. Applied
 * to element-derived ids before they're interpolated into hand-built
 * `<filter>` markup (some bindings inject that markup via `innerHTML`/
 * `v-html`, so an unescaped id from a crafted OOXML shape id could otherwise
 * break out of the attribute).
 */
function escapeSvgAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** Clamp a numeric value to the [0, 1] range. */
function clampUnitInterval(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Normalize an arbitrary colour string to a 6-digit hex value (`#RRGGBB`).
 * Returns `fallback` when the input is missing, "transparent", or invalid.
 */
function normalizeHexColor(value: string | undefined, fallback: string): string {
	if (!value || value === 'transparent') {
		return fallback;
	}
	const candidate = value.startsWith('#') ? value : `#${value}`;
	return /^#[0-9A-Fa-f]{6}$/u.test(candidate) ? candidate : fallback;
}

/** Parse a 6-digit hex colour into 0–255 R/G/B channels, or `null` if invalid. */
function hexToRgbChannels(color: string): { r: number; g: number; b: number } | null {
	const normalized = color.replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/u.test(normalized)) {
		return null;
	}
	return {
		r: Number.parseInt(normalized.slice(0, 2), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		b: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

/**
 * Convert a hex colour to an `rgba()` string with the given opacity. When
 * `opacity` is `undefined` the original colour is returned unchanged.
 */
function colorWithOpacity(color: string, opacity: number | undefined): string {
	if (opacity === undefined) {
		return color;
	}
	const rgb = hexToRgbChannels(color);
	if (!rgb) {
		return color;
	}
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnitInterval(opacity)})`;
}

// ── Outer / inner / multi-layer shadow (box-shadow) ────────────────────────

/**
 * Build a CSS `box-shadow` value from the single outer-shadow properties on a
 * {@link ShapeStyle}. Supports both angle/distance and direct x/y offset modes.
 * Returns `undefined` when no shadow colour is defined.
 */
export function getOuterShadowCss(style: ShapeStyle | undefined): string | undefined {
	if (!style?.shadowColor || style.shadowColor === 'transparent') {
		return undefined;
	}

	let offsetX: number;
	let offsetY: number;
	if (typeof style.shadowAngle === 'number' && typeof style.shadowDistance === 'number') {
		const angleRad = (style.shadowAngle * Math.PI) / 180;
		offsetX = Math.cos(angleRad) * style.shadowDistance;
		offsetY = Math.sin(angleRad) * style.shadowDistance;
	} else {
		offsetX =
			typeof style.shadowOffsetX === 'number' && Number.isFinite(style.shadowOffsetX)
				? style.shadowOffsetX
				: 4;
		offsetY =
			typeof style.shadowOffsetY === 'number' && Number.isFinite(style.shadowOffsetY)
				? style.shadowOffsetY
				: 4;
	}

	const blur =
		typeof style.shadowBlur === 'number' && Number.isFinite(style.shadowBlur)
			? Math.max(0, style.shadowBlur)
			: 6;
	const opacity =
		typeof style.shadowOpacity === 'number' && Number.isFinite(style.shadowOpacity)
			? clampUnitInterval(style.shadowOpacity)
			: 0.35;

	// Honour @sx/@sy (1000ths of a percent, 100000 = 100%) as a box-shadow
	// spread: a scaled-up shadow grows outward, a scaled-down one shrinks. This
	// is a best-effort mapping (box-shadow has no true scale). @kx/@ky skew and
	// @algn alignment cannot be represented by box-shadow at all and are left
	// to a drop-shadow / pseudo-element renderer (see report).
	const spread = getShadowScaleSpread(style.shadowScaleX, style.shadowScaleY, blur);

	const color = colorWithOpacity(
		normalizeHexColor(style.shadowColor, DEFAULT_SHADOW_COLOR),
		opacity,
	);
	const geometry = `${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px`;
	return spread === 0 ? `${geometry} ${color}` : `${geometry} ${spread}px ${color}`;
}

/**
 * Derive a box-shadow spread (px) from outer-shadow `@sx`/`@sy` scale factors
 * (1000ths of a percent; 100000 = 100%). The spread is proportional to the
 * blur so a larger shadow scale reads as a larger halo. Returns `0` when no
 * scale is set or it resolves to 100%, keeping the classic 3-length output.
 */
function getShadowScaleSpread(
	scaleX: number | undefined,
	scaleY: number | undefined,
	blur: number,
): number {
	const sx = typeof scaleX === 'number' && Number.isFinite(scaleX) ? scaleX / 100000 : 1;
	const sy = typeof scaleY === 'number' && Number.isFinite(scaleY) ? scaleY / 100000 : 1;
	const avgScale = (sx + sy) / 2;
	if (avgScale === 1) {
		return 0;
	}
	const base = Math.max(blur, 4);
	return Math.round(base * (avgScale - 1));
}

/**
 * Build a CSS `inset` `box-shadow` value from the inner-shadow properties on a
 * {@link ShapeStyle}. Returns `undefined` when no inner-shadow colour is set.
 */
export function getInnerShadowCss(style: ShapeStyle | undefined): string | undefined {
	if (!style?.innerShadowColor || style.innerShadowColor === 'transparent') {
		return undefined;
	}
	const offsetX =
		typeof style.innerShadowOffsetX === 'number' && Number.isFinite(style.innerShadowOffsetX)
			? style.innerShadowOffsetX
			: 0;
	const offsetY =
		typeof style.innerShadowOffsetY === 'number' && Number.isFinite(style.innerShadowOffsetY)
			? style.innerShadowOffsetY
			: 0;
	const blur =
		typeof style.innerShadowBlur === 'number' && Number.isFinite(style.innerShadowBlur)
			? Math.max(0, style.innerShadowBlur)
			: 6;
	const opacity =
		typeof style.innerShadowOpacity === 'number' && Number.isFinite(style.innerShadowOpacity)
			? clampUnitInterval(style.innerShadowOpacity)
			: 0.5;

	return `inset ${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px ${colorWithOpacity(
		normalizeHexColor(style.innerShadowColor, DEFAULT_SHADOW_COLOR),
		opacity,
	)}`;
}

/**
 * Build a comma-joined CSS `box-shadow` string for all layers in the `shadows`
 * array (PowerPoint compound outer shadows). Returns `undefined` when empty.
 */
export function getMultiLayerShadowCss(style: ShapeStyle | undefined): string | undefined {
	if (!style?.shadows || style.shadows.length === 0) {
		return undefined;
	}
	const parts: string[] = [];
	for (const shadow of style.shadows) {
		if (!shadow.color || shadow.color === 'transparent') {
			continue;
		}
		const angleRad = ((shadow.angle ?? 0) * Math.PI) / 180;
		const dist = shadow.distance ?? 0;
		const offsetX = Math.round(Math.cos(angleRad) * dist);
		const offsetY = Math.round(Math.sin(angleRad) * dist);
		const blur = Math.round(Math.max(0, shadow.blur ?? 6));
		const opacity = clampUnitInterval(shadow.opacity ?? 0.35);
		const color = colorWithOpacity(normalizeHexColor(shadow.color, DEFAULT_SHADOW_COLOR), opacity);
		parts.push(`${offsetX}px ${offsetY}px ${blur}px ${color}`);
	}
	return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Build a high-fidelity layered `box-shadow` for a glow effect (3 concentric
 * shadows at increasing radius / decreasing opacity). This supplements the
 * filter-based glow from {@link getEffectFilterCss}. Returns `undefined` when
 * no glow is configured.
 */
export function getGlowBoxShadowCss(
	color: string | undefined,
	radius: number | undefined,
	opacity: number | undefined,
): string | undefined {
	if (!color || color === 'transparent' || !radius || radius <= 0) {
		return undefined;
	}
	const baseOpacity = typeof opacity === 'number' ? clampUnitInterval(opacity) : 0.75;
	const normalizedColor = normalizeHexColor(color, DEFAULT_GLOW_COLOR);

	const r1 = Math.round(radius * 0.33);
	const c1 = colorWithOpacity(normalizedColor, baseOpacity);
	const r2 = Math.round(radius * 0.66);
	const c2 = colorWithOpacity(normalizedColor, baseOpacity * 0.6);
	const r3 = Math.round(radius);
	const c3 = colorWithOpacity(normalizedColor, baseOpacity * 0.3);

	return `0 0 ${r1}px ${c1}, 0 0 ${r2}px ${c2}, 0 0 ${r3}px ${c3}`;
}

/**
 * Combine outer-shadow, multi-layer shadow, inner-shadow and (optionally) the
 * layered glow into a single CSS `box-shadow` value, with the same precedence
 * as the React `getShapeVisualStyle`:
 *   multi-layer (if any) **else** single outer-shadow, then inner-shadow,
 *   then layered glow.
 *
 * @returns A `box-shadow` value string, or `undefined` if nothing applies.
 */
export function getBoxShadowCss(
	style: ShapeStyle | undefined,
	options: { includeGlow?: boolean } = {},
): string | undefined {
	if (!style) {
		return undefined;
	}
	const parts: string[] = [];

	const multiLayer = getMultiLayerShadowCss(style);
	if (multiLayer) {
		parts.push(multiLayer);
	} else {
		const outer = getOuterShadowCss(style);
		if (outer) {
			parts.push(outer);
		}
	}

	const inner = getInnerShadowCss(style);
	if (inner) {
		parts.push(inner);
	}

	if (options.includeGlow !== false) {
		const glow = getGlowBoxShadowCss(style.glowColor, style.glowRadius, style.glowOpacity);
		if (glow) {
			parts.push(glow);
		}
	}

	return parts.length > 0 ? parts.join(', ') : undefined;
}

// ── Per-binding name aliases (shadow box-shadow builders) ──────────────────
// React's `color-core.ts` historically exposed these builders under the names
// below; the binding shims re-export them so existing consumers/colocated tests
// keep importing the same symbols.

/** Alias of {@link getOuterShadowCss} (React `buildShadowCssFromShapeStyle`). */
export const buildShadowCssFromShapeStyle = getOuterShadowCss;
/** Alias of {@link getInnerShadowCss} (React `buildInnerShadowCssFromShapeStyle`). */
export const buildInnerShadowCssFromShapeStyle = getInnerShadowCss;
/** Alias of {@link getMultiLayerShadowCss} (React `buildMultiLayerShadowCss`). */
export const buildMultiLayerShadowCss = getMultiLayerShadowCss;
/** Alias of {@link getGlowBoxShadowCss} (React `buildGlowBoxShadow`). */
export const buildGlowBoxShadow = getGlowBoxShadowCss;
/** Alias of {@link buildReflectionCssValue} (React `buildReflectionCss`). */
export const buildReflectionCss = buildReflectionCssValue;

// ── Line effects (connector / shape outline shadow + glow) ─────────────────

/** Resolved parameters for a line-level (`a:ln`) outer shadow. */
export interface LineShadowParams {
	offsetX: number;
	offsetY: number;
	blur: number;
	color: string;
	opacity: number;
}

/**
 * Resolve the line-level shadow (`a:ln/a:effectLst/a:outerShdw`) parameters from
 * a {@link ShapeStyle}, applying PowerPoint's defaults for any missing values.
 * Returns `undefined` when no line shadow colour is defined, so callers can gate
 * on it. Feeds both the CSS box-shadow ({@link getLineShadowCss}) and the SVG
 * `feDropShadow` used to shadow connector strokes.
 */
export function getLineShadowParams(style: ShapeStyle | undefined): LineShadowParams | undefined {
	if (!style?.lineShadowColor || style.lineShadowColor === 'transparent') {
		return undefined;
	}
	return {
		offsetX: typeof style.lineShadowOffsetX === 'number' ? style.lineShadowOffsetX : 2,
		offsetY: typeof style.lineShadowOffsetY === 'number' ? style.lineShadowOffsetY : 2,
		blur: typeof style.lineShadowBlur === 'number' ? Math.max(0, style.lineShadowBlur) : 4,
		color: normalizeHexColor(style.lineShadowColor, DEFAULT_SHADOW_COLOR),
		opacity:
			typeof style.lineShadowOpacity === 'number'
				? clampUnitInterval(style.lineShadowOpacity)
				: 0.35,
	};
}

/**
 * Build a CSS `box-shadow` value for a line-level shadow. Returns `undefined`
 * when no line shadow is defined. Mirrors React's `buildLineShadowCss`.
 */
export function getLineShadowCss(style: ShapeStyle | undefined): string | undefined {
	const p = getLineShadowParams(style);
	if (!p) {
		return undefined;
	}
	return `${Math.round(p.offsetX)}px ${Math.round(p.offsetY)}px ${Math.round(
		p.blur,
	)}px ${colorWithOpacity(p.color, p.opacity)}`;
}

/**
 * Build a CSS `filter` value for a line-level glow (`a:ln/a:effectLst/a:glow`).
 * Returns `undefined` when no line glow is defined. Mirrors React's
 * `buildLineGlowFilter`.
 */
export function getLineGlowFilterCss(style: ShapeStyle | undefined): string | undefined {
	if (!style?.lineGlowColor || style.lineGlowColor === 'transparent' || !style.lineGlowRadius) {
		return undefined;
	}
	const glowOpacity = typeof style.lineGlowOpacity === 'number' ? style.lineGlowOpacity : 0.75;
	const glowRad = Math.round(Math.max(0, style.lineGlowRadius));
	const glowCol = colorWithOpacity(
		normalizeHexColor(style.lineGlowColor, DEFAULT_GLOW_COLOR),
		glowOpacity,
	);
	return `drop-shadow(0 0 ${glowRad}px ${glowCol})`;
}

/** Alias of {@link getLineShadowCss} (React `buildLineShadowCss`). */
export const buildLineShadowCss = getLineShadowCss;
/** Alias of {@link getLineGlowFilterCss} (React `buildLineGlowFilter`). */
export const buildLineGlowFilter = getLineGlowFilterCss;

// ── Glow / soft-edge / blur / DAG (CSS filter) ─────────────────────────────

/**
 * Map effect-DAG properties on a {@link ShapeStyle} to CSS `filter` functions.
 * Ported verbatim from the React `getEffectDagCssFilter`. Returns `undefined`
 * when no DAG filters apply.
 *
 * @param style     - The shape style carrying the `dag*` fields.
 * @param elementId - Element ID, used only for the duotone `url(#…)` reference.
 */
export function getEffectDagCssFilter(
	style: ShapeStyle | undefined,
	elementId?: string,
): string | undefined {
	if (!style) {
		return undefined;
	}
	const filters: string[] = [];

	if (style.dagGrayscale) {
		filters.push('grayscale(1)');
	}

	if (typeof style.dagBiLevel === 'number') {
		const thresh = Math.max(0, Math.min(100, style.dagBiLevel));
		filters.push(thresh > 50 ? 'contrast(1000)' : 'contrast(0.01)');
	}

	if (typeof style.dagLumBrightness === 'number' || typeof style.dagLumContrast === 'number') {
		const bright = style.dagLumBrightness ?? 0;
		const contrast = style.dagLumContrast ?? 0;
		if (bright !== 0) {
			filters.push(`brightness(${1 + bright / 100})`);
		}
		if (contrast !== 0) {
			filters.push(`contrast(${1 + contrast / 100})`);
		}
	}

	if (typeof style.dagHslHue === 'number' && style.dagHslHue !== 0) {
		filters.push(`hue-rotate(${style.dagHslHue}deg)`);
	}
	if (typeof style.dagHslSaturation === 'number' && style.dagHslSaturation !== 100) {
		filters.push(`saturate(${style.dagHslSaturation / 100})`);
	}
	if (typeof style.dagHslLuminance === 'number' && style.dagHslLuminance !== 0) {
		filters.push(`brightness(${1 + style.dagHslLuminance / 100})`);
	}

	if (typeof style.dagAlphaModFix === 'number') {
		const alpha = clampUnitInterval(style.dagAlphaModFix / 100);
		filters.push(`opacity(${alpha})`);
	}

	if (typeof style.dagTintHue === 'number' || typeof style.dagTintAmount === 'number') {
		const hue = style.dagTintHue ?? 0;
		const amt = Math.max(0, Math.min(100, style.dagTintAmount ?? 50));
		filters.push(`sepia(${amt / 100}) hue-rotate(${hue}deg)`);
	}

	if (style.dagDuotone && elementId) {
		filters.push(`url(#${getDuotoneFilterId(elementId)})`);
	}

	return filters.length > 0 ? filters.join(' ') : undefined;
}

/**
 * Legacy alias of {@link getEffectDagCssFilter}, preserved for the React
 * `effect-dag-filters` shim.
 */
export const getEffectDagFilter = getEffectDagCssFilter;

/**
 * Whether a {@link ShapeStyle} carries any active effect-DAG property. Useful
 * for short-circuiting rendering logic when no DAG effects apply.
 */
export function hasEffectDagProperties(style: ShapeStyle | undefined): boolean {
	if (!style) {
		return false;
	}
	return Boolean(
		style.dagGrayscale ||
		typeof style.dagBiLevel === 'number' ||
		typeof style.dagLumBrightness === 'number' ||
		typeof style.dagLumContrast === 'number' ||
		typeof style.dagHslHue === 'number' ||
		typeof style.dagHslSaturation === 'number' ||
		typeof style.dagHslLuminance === 'number' ||
		typeof style.dagAlphaModFix === 'number' ||
		typeof style.dagTintHue === 'number' ||
		typeof style.dagTintAmount === 'number' ||
		style.dagDuotone ||
		style.dagFillOverlayBlend ||
		style.dagFillOverlayColor,
	);
}

/**
 * Build the CSS `filter` value for the "simple" effect path of a shape/image
 * {@link ShapeStyle}: outer glow (`drop-shadow`), soft edges (`blur`),
 * standalone blur (`blur`), and effect-DAG adjustments.
 *
 * Mirrors the `filterParts` assembly in the React `getShapeVisualStyle`.
 * Returns `undefined` when no filter applies.
 *
 * @param style     - The shape style.
 * @param elementId - Element ID, forwarded to the DAG duotone reference.
 */
export function getEffectFilterCss(
	style: ShapeStyle | undefined,
	elementId?: string,
): string | undefined {
	if (!style) {
		return undefined;
	}
	const parts: string[] = [];

	// Outer glow → drop-shadow
	if (style.glowColor && style.glowColor !== 'transparent' && style.glowRadius) {
		const glowOpacity = typeof style.glowOpacity === 'number' ? style.glowOpacity : 0.75;
		const glowRad = Math.round(Math.max(0, style.glowRadius));
		const glowCol = colorWithOpacity(
			normalizeHexColor(style.glowColor, DEFAULT_GLOW_COLOR),
			glowOpacity,
		);
		parts.push(`drop-shadow(0 0 ${glowRad}px ${glowCol})`);
	}

	// Soft edges → feather only the alpha edge (SVG filter), not the whole
	// element. A full-element `blur()` washes out the interior fill and text;
	// the alpha-feather filter (see getSoftEdgeSvgFilter) keeps the interior
	// crisp and only fades the border inward. This mirrors the duotone path:
	// the referenced `<filter>` markup must be injected once by the integrator.
	// Without an element id (no injectable filter target) we fall back to a
	// minimised whole-element blur so at least the interior stays legible.
	if (typeof style.softEdgeRadius === 'number' && style.softEdgeRadius > 0) {
		if (elementId) {
			parts.push(`url(#${getSoftEdgeFilterId(elementId)})`);
		} else {
			parts.push(`blur(${Math.min(2, Math.round(style.softEdgeRadius))}px)`);
		}
	}

	// Standalone blur effect (a:blur)
	if (typeof style.blurRadius === 'number' && style.blurRadius > 0) {
		parts.push(`blur(${Math.round(style.blurRadius)}px)`);
	}

	// Effect-DAG image adjustments
	const dagFilter = getEffectDagCssFilter(style, elementId);
	if (dagFilter) {
		parts.push(dagFilter);
	}

	return parts.length > 0 ? parts.join(' ') : undefined;
}

// ── Reflection (-webkit-box-reflect) ───────────────────────────────────────

/**
 * Result of {@link getReflectionCss}: the `-webkit-box-reflect` value plus the
 * raw inputs (useful for tests / alternative renderers).
 *
 * Note: `-webkit-box-reflect` is Chromium/WebKit only — Firefox does not
 * support it. The React viewer accepts this limitation; a pseudo-element
 * fallback would be needed for full cross-browser fidelity.
 */
export interface ReflectionCss {
	/** The `-webkit-box-reflect` CSS value. */
	webkitBoxReflect: string;
	distance: number;
	startOpacity: number;
	endOpacity: number;
	fadeLength: number;
	blurRadius: number;
}

/**
 * Build the `-webkit-box-reflect` value for a reflection effect. `fadeLength`
 * is in px (the React caller derives it from `reflectionEndPosition × height`).
 */
export function buildReflectionCssValue(
	distance: number,
	startOpacity: number,
	endOpacity: number,
	fadeLength: number,
	blurRadius = 0,
	startOffset = 0,
): string {
	const effectiveFadeLength = fadeLength + blurRadius * 2;
	const midOpacity = (startOpacity + endOpacity) / 2;
	const midPoint = Math.round(effectiveFadeLength * 0.5);

	// `@stPos` holds full startOpacity until `startOffset` px before the fade
	// begins. Clamp below the fade length so the hold stop stays ordered.
	const holdPx = Math.round(Math.max(0, Math.min(startOffset, effectiveFadeLength - 1)));
	const holdStop = holdPx > 0 ? `rgba(255,255,255,${startOpacity}) ${holdPx}px, ` : '';

	if (blurRadius > 0) {
		return (
			`below ${Math.round(distance)}px linear-gradient(to bottom, ` +
			`rgba(255,255,255,${startOpacity}), ${holdStop}` +
			`rgba(255,255,255,${midOpacity}) ${midPoint}px, ` +
			`rgba(255,255,255,${endOpacity}) ${effectiveFadeLength}px)`
		);
	}

	return `below ${Math.round(distance)}px linear-gradient(to bottom, rgba(255,255,255,${startOpacity}), ${holdStop}rgba(255,255,255,${endOpacity}) ${fadeLength}px)`;
}

/**
 * Compute the reflection CSS for a {@link ShapeStyle} given the element height
 * (needed to convert `reflectionEndPosition` fraction → px fade length).
 * Mirrors the reflection block in the React `getShapeVisualStyle`.
 *
 * @returns A {@link ReflectionCss}, or `undefined` when no reflection applies.
 */
export function getReflectionCss(
	style: ShapeStyle | undefined,
	elementHeight: number,
): ReflectionCss | undefined {
	if (!style) {
		return undefined;
	}
	const hasReflection =
		(typeof style.reflectionStartOpacity === 'number' && style.reflectionStartOpacity > 0) ||
		(typeof style.reflectionDistance === 'number' && style.reflectionDistance > 0) ||
		(typeof style.reflectionBlurRadius === 'number' && style.reflectionBlurRadius > 0);
	if (!hasReflection) {
		return undefined;
	}

	const distance = style.reflectionDistance ?? 0;
	const startOpacity =
		typeof style.reflectionStartOpacity === 'number' ? style.reflectionStartOpacity : 0.5;
	const endOpacity =
		typeof style.reflectionEndOpacity === 'number' ? style.reflectionEndOpacity : 0;
	const fadeLength =
		typeof style.reflectionEndPosition === 'number'
			? Math.round(style.reflectionEndPosition * Math.max(elementHeight, 1))
			: 100;
	const blurRadius =
		typeof style.reflectionBlurRadius === 'number' ? style.reflectionBlurRadius : 0;
	// `@stPos` is a 0-1 fraction of the reflection's fade length: the reflection
	// stays at full startOpacity until this point before fading out. Other
	// reflection params (@sx/@sy scale, @kx/@ky skew, @rot, @fadeDir, @algn)
	// cannot be represented by `-webkit-box-reflect` and are left as-is (see
	// report; note box-reflect is WebKit/Chromium-only, unsupported in Firefox).
	const startOffset =
		typeof style.reflectionStartPosition === 'number' && style.reflectionStartPosition > 0
			? Math.round(clampUnitInterval(style.reflectionStartPosition) * fadeLength)
			: 0;

	return {
		webkitBoxReflect: buildReflectionCssValue(
			distance,
			startOpacity,
			endOpacity,
			fadeLength,
			blurRadius,
			startOffset,
		),
		distance,
		startOpacity,
		endOpacity,
		fadeLength,
		blurRadius,
	};
}

// ── DAG opacity & blend mode ───────────────────────────────────────────────

/** Extract CSS `opacity` (0–1) from `dagAlphaModFix`, or `undefined`. */
export function getEffectDagOpacity(style: ShapeStyle | undefined): number | undefined {
	if (!style || typeof style.dagAlphaModFix !== 'number') {
		return undefined;
	}
	return clampUnitInterval(style.dagAlphaModFix / 100);
}

/** Map `dagFillOverlayBlend` to a CSS `mix-blend-mode`, or `undefined`. */
export function getEffectDagBlendMode(
	blend: ShapeStyle['dagFillOverlayBlend'],
): string | undefined {
	switch (blend) {
		case 'mult':
			return 'multiply';
		case 'screen':
			return 'screen';
		case 'darken':
			return 'darken';
		case 'lighten':
			return 'lighten';
		default:
			return undefined;
	}
}

/**
 * A fill-overlay tint layer: the overlay {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color colour}
 * (an `rgba()` string carrying the overlay's alpha) plus the `mix-blend-mode`
 * used to composite it over the element. Unlike the whole-element
 * {@link getEffectDagBlendMode} proxy, this describes a *separate* coloured
 * layer the integrator should paint on top of the element (e.g. an absolutely
 * positioned pseudo-element / child), so the tint colour is actually rendered.
 */
export interface FillOverlayCss {
	/** Overlay colour as an `rgba()`/hex string (already includes opacity). */
	color: string;
	/** `mix-blend-mode` for the overlay layer (`normal` for the `over` blend). */
	blendMode: string;
}

/**
 * Resolve the DAG fill-overlay tint layer from a {@link ShapeStyle}. Returns
 * `undefined` when no overlay colour was parsed. The `over` blend maps to
 * `normal` (an opaque tint), the others to their `mix-blend-mode` equivalents.
 */
export function getEffectDagFillOverlay(style: ShapeStyle | undefined): FillOverlayCss | undefined {
	if (!style?.dagFillOverlayColor || style.dagFillOverlayColor === 'transparent') {
		return undefined;
	}
	const blendMode = getEffectDagBlendMode(style.dagFillOverlayBlend) ?? 'normal';
	const color = colorWithOpacity(
		normalizeHexColor(style.dagFillOverlayColor, DEFAULT_SHADOW_COLOR),
		style.dagFillOverlayOpacity,
	);
	return { color, blendMode };
}

// ── High-fidelity duotone SVG <filter> markup (secondary path) ─────────────

/** Stable SVG filter id for a DAG duotone effect on a given element. */
export function getDuotoneFilterId(elementId: string): string {
	return `dag-duotone-${elementId}`;
}

/** Parse a hex colour to normalised 0–1 RGB components (invalid → 0). */
function hexToRgbUnit(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace('#', '');
	const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
	const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
	const b = Number.parseInt(clean.substring(4, 6), 16) / 255;
	return {
		r: Number.isFinite(r) ? r : 0,
		g: Number.isFinite(g) ? g : 0,
		b: Number.isFinite(b) ? b : 0,
	};
}

/**
 * A high-fidelity SVG `<filter>` definition: the filter `id`, a `filter:
 * url(#id)` reference for callers, and the `<filter>` markup to inject into a
 * `<defs>` (or a standalone hidden `<svg>`). Optional/secondary to the CSS
 * path.
 */
export interface SvgFilterDefinition {
	/** The `<filter>` element id. */
	id: string;
	/** A ready-to-use `filter: url(#id)` CSS reference. */
	cssReference: string;
	/** The `<filter>…</filter>` markup (no wrapping `<svg>`/`<defs>`). */
	filterMarkup: string;
}

/**
 * Build the duotone `<filter>` markup (BT.709 grayscale → linear ramp between
 * two colours) for the high-fidelity DAG path. Returns `undefined` when the
 * style has no `dagDuotone`.
 *
 * Inject `filterMarkup` once into an SVG `<defs>` and apply `cssReference` as
 * the element's `filter` (or append it to {@link getEffectFilterCss}'s result).
 */
export function getDuotoneSvgFilter(
	style: ShapeStyle | undefined,
	elementId: string,
): SvgFilterDefinition | undefined {
	if (!style?.dagDuotone) {
		return undefined;
	}
	const id = getDuotoneFilterId(elementId);
	const c1 = hexToRgbUnit(style.dagDuotone.color1);
	const c2 = hexToRgbUnit(style.dagDuotone.color2);

	const grayscaleMatrix = [
		0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0,
		0, 1, 0,
	].join(' ');

	const slopeR = c2.r - c1.r;
	const slopeG = c2.g - c1.g;
	const slopeB = c2.b - c1.b;

	const filterMarkup = [
		`<filter id="${escapeSvgAttr(id)}" color-interpolation-filters="sRGB">`,
		`<feColorMatrix type="matrix" values="${grayscaleMatrix}"/>`,
		`<feComponentTransfer>`,
		`<feFuncR type="linear" slope="${slopeR}" intercept="${c1.r}"/>`,
		`<feFuncG type="linear" slope="${slopeG}" intercept="${c1.g}"/>`,
		`<feFuncB type="linear" slope="${slopeB}" intercept="${c1.b}"/>`,
		`</feComponentTransfer>`,
		`</filter>`,
	].join('');

	return { id, cssReference: `url(#${id})`, filterMarkup };
}

// ── Soft edges (SVG alpha-feather <filter>) ────────────────────────────────

/** Stable SVG filter id for a soft-edge feather on a given element. */
export function getSoftEdgeFilterId(elementId: string): string {
	return `soft-edge-${elementId}`;
}

/**
 * Build the soft-edge `<filter>` markup that feathers only the shape's alpha
 * edge, leaving the interior fill/text sharp. It blurs `SourceAlpha` and
 * composites the original `SourceGraphic` back *into* that blurred alpha
 * (`operator="in"`), so the boundary fades inward (matching PowerPoint soft
 * edges) while interior pixels keep full opacity and no blur.
 *
 * Inject `filterMarkup` once into an SVG `<defs>` (or a hidden `<svg>`) and
 * apply `cssReference` (already emitted by {@link getEffectFilterCss} when an
 * element id is supplied). Returns `undefined` when no soft edge is configured.
 */
export function getSoftEdgeSvgFilter(
	style: ShapeStyle | undefined,
	elementId: string,
): SvgFilterDefinition | undefined {
	if (!style || typeof style.softEdgeRadius !== 'number' || style.softEdgeRadius <= 0) {
		return undefined;
	}
	const id = getSoftEdgeFilterId(elementId);
	const radius = Math.round(style.softEdgeRadius);
	const filterMarkup = [
		`<filter id="${escapeSvgAttr(id)}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">`,
		`<feGaussianBlur in="SourceAlpha" stdDeviation="${radius}" result="softEdgeAlpha"/>`,
		`<feComposite in="SourceGraphic" in2="softEdgeAlpha" operator="in"/>`,
		`</filter>`,
	].join('');
	return { id, cssReference: `url(#${id})`, filterMarkup };
}

/**
 * Build a self-contained, hidden `<svg>` wrapper containing a duotone
 * `<filter>` (BT.709 grayscale → linear two-colour ramp), suitable for direct
 * injection into the DOM in non-React contexts (tests, SSR, string templates).
 *
 * Unlike {@link getDuotoneSvgFilter} (which returns just the `<filter>` markup),
 * this wraps the filter in `<svg width="0" height="0" …>` so the returned
 * string can be inserted as-is. Mirrors React's `getDuotoneSvgFilterMarkup`.
 *
 * @param filterId - The `<filter>` element id.
 * @param color1   - Shadow colour (hex).
 * @param color2   - Highlight colour (hex).
 */
export function getDuotoneSvgFilterMarkup(
	filterId: string,
	color1: string,
	color2: string,
): string {
	const c1 = hexToRgbUnit(color1);
	const c2 = hexToRgbUnit(color2);

	const grayscaleMatrix = [
		0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0,
		0, 1, 0,
	].join(' ');

	const slopeR = c2.r - c1.r;
	const slopeG = c2.g - c1.g;
	const slopeB = c2.b - c1.b;

	return [
		`<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">`,
		`<defs>`,
		`<filter id="${escapeSvgAttr(filterId)}" color-interpolation-filters="sRGB">`,
		`<feColorMatrix type="matrix" values="${grayscaleMatrix}"/>`,
		`<feComponentTransfer>`,
		`<feFuncR type="linear" slope="${slopeR}" intercept="${c1.r}"/>`,
		`<feFuncG type="linear" slope="${slopeG}" intercept="${c1.g}"/>`,
		`<feFuncB type="linear" slope="${slopeB}" intercept="${c1.b}"/>`,
		`</feComponentTransfer>`,
		`</filter>`,
		`</defs>`,
		`</svg>`,
	].join('');
}

// ── Aggregate convenience API ──────────────────────────────────────────────

/**
 * The full set of CSS effect properties for a shape/image element, ready to be
 * spread onto a Vue `CSSProperties`-style object by the integrator. Every field
 * is optional and omitted when the corresponding effect is absent.
 */
export interface ComputedEffectStyle {
	/** Combined outer/inner/multi-layer/glow `box-shadow`. */
	boxShadow?: string;
	/** Combined glow/soft-edge/blur/DAG `filter`. */
	filter?: string;
	/** `-webkit-box-reflect` (Chromium/WebKit only). */
	webkitBoxReflect?: string;
	/** Overall `opacity` from `dagAlphaModFix`. */
	opacity?: number;
	/**
	 * `mix-blend-mode` from `dagFillOverlayBlend`. Only emitted for the legacy
	 * blend-only case (no overlay colour parsed); when {@link fillOverlay} is
	 * present the blend rides on that overlay layer instead.
	 */
	mixBlendMode?: string;
	/**
	 * DAG fill-overlay tint layer (colour + blend mode). The integrator should
	 * paint this as a separate blended layer over the element (an absolutely
	 * positioned pseudo-element / child), rather than blending the whole element.
	 */
	fillOverlay?: FillOverlayCss;
	/**
	 * `true` when a blur effect has `@grow` set: the element must render with
	 * `overflow: visible` (and ideally grown bounds) so the blur halo is not
	 * clipped at the element box.
	 */
	overflowVisible?: boolean;
}

/**
 * Compute every CSS effect property for an element in one call. The element is
 * used to read `shapeStyle`, the element id (for DAG filter refs), and the
 * height (for reflection fade length). Image effects (`imageEffects`) are NOT
 * handled here — see {@link hasImageEffects} and the React `image-effects` /
 * `shape-visual-effects` modules (deferred, see return notes).
 *
 * @returns A {@link ComputedEffectStyle}; all-undefined when no effects apply.
 */
export function getComputedEffectStyle(
	element: PptxElement,
	options: { includeGlowBoxShadow?: boolean } = {},
): ComputedEffectStyle {
	const style = 'shapeStyle' in element ? element.shapeStyle : undefined;
	const result: ComputedEffectStyle = {};
	if (!style) {
		return result;
	}

	const boxShadow = getBoxShadowCss(style, { includeGlow: options.includeGlowBoxShadow });
	if (boxShadow) {
		result.boxShadow = boxShadow;
	}

	const filter = getEffectFilterCss(style, element.id);
	if (filter) {
		result.filter = filter;
	}

	const reflection = getReflectionCss(style, element.height);
	if (reflection) {
		result.webkitBoxReflect = reflection.webkitBoxReflect;
	}

	const opacity = getEffectDagOpacity(style);
	if (opacity !== undefined) {
		result.opacity = opacity;
	}

	// Fill overlay: paint the tint layer when a colour was parsed; otherwise
	// fall back to the legacy whole-element blend-mode proxy.
	const overlay = getEffectDagFillOverlay(style);
	if (overlay) {
		result.fillOverlay = overlay;
	} else {
		const blend = getEffectDagBlendMode(style.dagFillOverlayBlend);
		if (blend) {
			result.mixBlendMode = blend;
		}
	}

	// Blur `@grow`: let the halo bleed past the element box instead of clipping.
	if (style.blurGrow && typeof style.blurRadius === 'number' && style.blurRadius > 0) {
		result.overflowVisible = true;
	}

	return result;
}

/** Whether an element carries any (recolour/artistic) image effects. */
export function hasImageEffects(element: PptxElement): boolean {
	return isImageLikeElement(element) && Boolean(element.imageEffects);
}
