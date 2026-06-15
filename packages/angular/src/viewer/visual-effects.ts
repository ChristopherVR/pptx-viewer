/**
 * Visual effects helper — pure CSS computation for OOXML shape/image effects.
 *
 * Ported verbatim from the Vue package's `viewer/composables/visual-effects.ts`
 * (origin/main). No Angular, Vue, or React runtime dependency — everything here
 * is a pure function so it can be unit-tested without a DI context and wired
 * into `element-style.ts` by the integrator.
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
 * alpha is 0–1.
 *
 * @module viewer/visual-effects
 */

import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

// ── Low-level colour helpers ───────────────────────────────────────────────

const DEFAULT_SHADOW_COLOR = '#000000';
const DEFAULT_GLOW_COLOR = '#ffff00';

/** Clamp a numeric value to the [0, 1] range. */
function clampUnitInterval(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Normalize an arbitrary colour string to a 6-digit hex value (`#RRGGBB`).
 * Returns `fallback` when the input is missing, "transparent", or invalid.
 */
export function normalizeHexColor(value: string | undefined, fallback: string): string {
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
export function colorWithOpacity(color: string, opacity: number | undefined): string {
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

	return `${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px ${colorWithOpacity(
		normalizeHexColor(style.shadowColor, DEFAULT_SHADOW_COLOR),
		opacity,
	)}`;
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

	// Soft edges → blur
	if (typeof style.softEdgeRadius === 'number' && style.softEdgeRadius > 0) {
		parts.push(`blur(${Math.round(style.softEdgeRadius)}px)`);
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
): string {
	const effectiveFadeLength = fadeLength + blurRadius * 2;
	const midOpacity = (startOpacity + endOpacity) / 2;
	const midPoint = Math.round(effectiveFadeLength * 0.5);

	if (blurRadius > 0) {
		return (
			`below ${Math.round(distance)}px linear-gradient(to bottom, ` +
			`rgba(255,255,255,${startOpacity}), ` +
			`rgba(255,255,255,${midOpacity}) ${midPoint}px, ` +
			`rgba(255,255,255,${endOpacity}) ${effectiveFadeLength}px)`
		);
	}

	return `below ${Math.round(distance)}px linear-gradient(to bottom, rgba(255,255,255,${startOpacity}), rgba(255,255,255,${endOpacity}) ${fadeLength}px)`;
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

	return {
		webkitBoxReflect: buildReflectionCssValue(
			distance,
			startOpacity,
			endOpacity,
			fadeLength,
			blurRadius,
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
		`<filter id="${id}" color-interpolation-filters="sRGB">`,
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

// ── Aggregate convenience API ──────────────────────────────────────────────

/**
 * The full set of CSS effect properties for a shape/image element. Every field
 * is optional and omitted when the corresponding effect is absent. Values are
 * plain CSS strings/numbers — framework-neutral; callers set them on
 * `[ngStyle]` maps (Angular) or equivalent.
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
	/** `mix-blend-mode` from `dagFillOverlayBlend`. */
	mixBlendMode?: string;
}

/**
 * Compute every CSS effect property for an element in one call. The element is
 * used to read `shapeStyle`, the element id (for DAG filter refs), and the
 * height (for reflection fade length). Image effects (`imageEffects`) are NOT
 * handled here — see {@link hasImageEffects}.
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

	const blend = getEffectDagBlendMode(style.dagFillOverlayBlend);
	if (blend) {
		result.mixBlendMode = blend;
	}

	return result;
}

/** Whether an element carries any (recolour/artistic) image effects. */
export function hasImageEffects(element: PptxElement): boolean {
	return isImageLikeElement(element) && Boolean(element.imageEffects);
}
