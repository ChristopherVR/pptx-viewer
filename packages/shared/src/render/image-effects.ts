import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { buildImageBiLevelTable, buildImageLuminanceTransfer } from './image-effect-filter-values';

/**
 * Image-effects composable — Vue port of the React `viewer/utils` image-effect
 * layer (`shape-visual-effects.ts`, `duotone-effects.ts`,
 * `shape-visual-filters.tsx`, `artistic-effects.tsx`).
 *
 * It maps the parsed OOXML {@link PptxImageEffects} on a `picture`/`image`
 * element to:
 *   - a CSS `filter:` string (brightness/contrast/saturate/grayscale/blur and
 *     CSS-only artistic approximations), and
 *   - any inline SVG `<filter>` definitions (duotone, advanced alpha primitives,
 *     complex artistic effects) referenced from that CSS string via `url(#id)`.
 *
 * Every function here is pure and unit-testable without mounting a component.
 * The integrator binds the returned CSS `filter` onto the `<img>` and injects
 * the SVG `<filter>` markup once per element (see module docs at bottom).
 *
 * Precedence, unit conversions, and filter IDs intentionally mirror the React
 * implementation so the two bindings render identically.
 */

// ── Public types ────────────────────────────────────────────────────────────

/** An inline SVG `<filter>` definition to inject so a `url(#id)` reference resolves. */
export interface ImageSvgFilterDefinition {
	/** The `id` attribute of the `<filter>` (matches the `url(#id)` reference). */
	id: string;
	/**
	 * Inner markup of the `<filter>` element (the `<fe*>` primitives only).
	 * Wrap it in `<svg width="0" height="0"><defs><filter id=…>…</filter></defs></svg>`.
	 */
	markup: string;
}

/** Aggregate result of {@link getComputedImageStyle}. */
export interface ComputedImageStyle {
	/** CSS `filter` value, or `undefined` when the element has no image effects. */
	filter?: string;
	/** Overall opacity (0–1) derived from `alphaModFix`, or `undefined`. */
	opacity?: number;
	/** SVG `<filter>` defs that must be injected for the CSS `url(#…)` refs to resolve. */
	svgFilters: ImageSvgFilterDefinition[];
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Clamp a number to the inclusive `[lo, hi]` range. */
function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/** Normalize a radius value (0–100) to a 0–1 float for proportional scaling. */
function normalizeRadius01(radius: number): number {
	return clamp(radius / 100, 0, 1);
}

/** Parse a hex colour (`#RRGGBB` or `RRGGBB`) to normalised 0–1 RGB components. */
function hexToRgbUnit(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace(/^#/u, '');
	const r = parseInt(clean.substring(0, 2), 16) / 255;
	const g = parseInt(clean.substring(2, 4), 16) / 255;
	const b = parseInt(clean.substring(4, 6), 16) / 255;
	return {
		r: Number.isFinite(r) ? r : 0,
		g: Number.isFinite(g) ? g : 0,
		b: Number.isFinite(b) ? b : 0,
	};
}

/** Get the image effects off an element, or `undefined` for non-image elements. */
function getEffects(element: PptxElement): PptxImageEffects | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	return element.imageEffects;
}

// ── Filter ID generators (mirror the React util IDs) ────────────────────────

/** Stable SVG filter ID for a duotone effect on an element. */
export function getImageDuotoneFilterId(elementId: string): string {
	return `duotone-${elementId}`;
}

/** Stable SVG filter ID for the advanced-alpha / colour primitives filter. */
export function getImageAlphaFilterId(elementId: string): string {
	return `imgalpha-${elementId}`;
}

/** Stable SVG filter ID for a complex artistic effect on an element. */
export function getArtisticFilterId(elementId: string): string {
	return `artistic-fx-${elementId}`;
}

// ── Artistic effects requiring SVG filters ──────────────────────────────────

/**
 * Set of artistic effect names that require an SVG `<filter>` definition.
 * All others are approximated with CSS-only filter functions.
 */
const SVG_FILTER_EFFECTS = new Set<string>([
	'artisticFilmGrain',
	'filmGrain',
	'artisticCutout',
	'cutout',
	'artisticCement',
	'cement',
	'artisticTexturizer',
	'texturizer',
	'artisticCrisscrossEtching',
	'crisscrossEtching',
	'artisticMosaic',
	'artisticMosaicBubbles',
	'mosaicBubbles',
	'mosaic',
	'artisticGlowEdges',
	'glowEdges',
	'glow_edges',
	'artisticChalkSketch',
	'chalkSketch',
	'chalk',
	'artisticPencilSketch',
	'pencilSketch',
	'artisticPencilGrayscale',
	'pencilGrayscale',
	'grayPencil',
]);

/** Whether an artistic effect name needs an inline SVG `<filter>` (vs pure CSS). */
export function needsSvgArtisticFilter(effectName: string | undefined): boolean {
	if (!effectName) {
		return false;
	}
	return SVG_FILTER_EFFECTS.has(effectName);
}

// ── Advanced-alpha detection ────────────────────────────────────────────────

/**
 * Returns true when the element has any blip-side alpha primitive or advanced
 * colour effect that CSS filters can't express (alphaInv, alphaCeiling,
 * alphaFloor, alphaRepl, alphaBiLevel, biLevel, lum, hsl with sat, tint,
 * clrRepl, alphaModFix). Brightness/contrast/saturation/grayscale/duotone are
 * still handled via CSS filters in {@link getImageFilterCss}.
 */
export function hasAdvancedImageAlphaEffects(element: PptxElement): boolean {
	const e = getEffects(element);
	if (!e) {
		return false;
	}
	return Boolean(
		typeof e.alphaModFix === 'number' ||
		e.alphaInv ||
		e.alphaCeiling ||
		e.alphaFloor ||
		typeof e.alphaRepl === 'number' ||
		typeof e.alphaBiLevel === 'number' ||
		typeof e.biLevel === 'number' ||
		(e.lum && (typeof e.lum.bright === 'number' || typeof e.lum.contrast === 'number')) ||
		(e.hsl && (typeof e.hsl.sat === 'number' || typeof e.hsl.lum === 'number')) ||
		(e.tint && typeof e.tint.amt === 'number') ||
		e.clrRepl,
	);
}

// ── CSS filter string ───────────────────────────────────────────────────────

/**
 * Build the CSS `filter:` string for an element's image effects.
 *
 * Mirrors React's `getImageEffectsFilter`: brightness/contrast/saturate are
 * OOXML hundredths-of-percent → CSS multipliers; grayscale → `grayscale(100%)`;
 * duotone / advanced-alpha / complex-artistic effects append a `url(#id)`
 * reference to an SVG `<filter>` that {@link getImageSvgFilters} produces.
 *
 * @param element The slide element (must be `picture`/`image` to yield a value).
 * @param options `excludeDuotone` skips the duotone `url(#…)` ref (e.g. when a
 *                canvas path handles duotone instead).
 * @returns The CSS filter value, or `undefined` when there are no effects.
 */
export function getImageFilterCss(
	element: PptxElement,
	options?: { excludeDuotone?: boolean },
): string | undefined {
	const effects = getEffects(element);
	if (!effects) {
		return undefined;
	}

	const filters: string[] = [];

	// Brightness: OOXML hundredths-of-percent → CSS multiplier
	if (typeof effects.brightness === 'number' && effects.brightness !== 0) {
		filters.push(`brightness(${Math.max(0, 1 + effects.brightness / 100)})`);
	}
	// Contrast: OOXML hundredths-of-percent → CSS multiplier
	if (typeof effects.contrast === 'number' && effects.contrast !== 0) {
		filters.push(`contrast(${Math.max(0, 1 + effects.contrast / 100)})`);
	}
	// Saturation: -100..100 → CSS saturate() multiplier
	if (typeof effects.saturation === 'number' && effects.saturation !== 0) {
		filters.push(`saturate(${Math.max(0, 1 + effects.saturation / 100)})`);
	}
	// Grayscale
	if (effects.grayscale) {
		filters.push('grayscale(100%)');
	}
	// Duotone: reference inline SVG filter (rendered by getImageSvgFilters).
	if (effects.duotone && !options?.excludeDuotone) {
		filters.push(`url(#${getImageDuotoneFilterId(element.id)})`);
	}
	// Advanced alpha primitives + biLevel/lum/hsl(sat,lum)/tint/clrRepl that
	// CSS filters can't express; rendered by getImageSvgFilters().
	if (hasAdvancedImageAlphaEffects(element)) {
		filters.push(`url(#${getImageAlphaFilterId(element.id)})`);
	}
	// Artistic effects: complex ones reference the SVG filter; simple ones use
	// CSS filter functions directly.
	if (effects.artisticEffect) {
		const radius = effects.artisticRadius ?? 5;

		if (needsSvgArtisticFilter(effects.artisticEffect)) {
			filters.push(`url(#${getArtisticFilterId(element.id)})`);
		} else {
			filters.push(buildSimpleArtisticCss(effects.artisticEffect, radius));
		}
	}

	return filters.length > 0 ? filters.join(' ') : undefined;
}

/**
 * Legacy alias of {@link getImageFilterCss}, preserved for the React
 * `shape-visual-effects` shim whose public symbol was `getImageEffectsFilter`.
 */
export const getImageEffectsFilter = getImageFilterCss;

/** CSS-only approximations for the simpler artistic effects. */
function buildSimpleArtisticCss(effect: string, radius: number): string {
	switch (effect) {
		case 'blur':
		case 'glassEffect':
			return `blur(${Math.min(radius, 20)}px)`;
		case 'artisticBlur':
			return `blur(${Math.min(radius, 20)}px)`;
		case 'artisticGaussianBlur':
			return `blur(${Math.min(Math.round(radius * 1.2), 24)}px)`;

		case 'lineDrawing':
			return 'grayscale(100%) contrast(150%)';
		case 'artisticLineDrawing':
			return 'grayscale(100%) contrast(150%)';

		case 'paintStrokes':
		case 'watercolorSponge':
			return `blur(${Math.min(radius, 8)}px) saturate(140%) brightness(105%)`;
		case 'artisticPaintStrokes':
			return `blur(${Math.min(radius, 8)}px) saturate(140%) brightness(105%)`;
		case 'artisticWatercolorSponge':
			return `blur(${Math.min(radius, 8)}px) saturate(150%) brightness(108%)`;
		case 'artisticPaint':
		case 'paint':
			return `blur(${Math.min(radius, 5)}px) saturate(160%) contrast(110%)`;
		case 'artisticPaintBrush':
		case 'paintBrush':
			return `blur(${Math.min(radius, 6)}px) saturate(130%)`;

		case 'photocopy':
			return 'grayscale(100%) contrast(200%) brightness(120%)';
		case 'artisticPhotocopy':
			return 'grayscale(100%) contrast(200%) brightness(120%)';

		case 'pastelsSmooth':
		case 'pastels':
			return `blur(${Math.min(radius, 6)}px) saturate(85%) brightness(105%)`;
		case 'artisticPastelsSmooth':
		case 'artisticPastels':
			return `blur(${Math.min(radius, 6)}px) saturate(85%) brightness(105%)`;

		case 'artisticMarker':
		case 'marker':
			return 'contrast(130%) saturate(150%)';

		case 'artisticPlasticWrap':
		case 'plasticWrap':
			return 'contrast(150%) brightness(115%) saturate(80%)';

		case 'artisticLightScreen':
		case 'lightScreen':
			return `brightness(${1.2 + normalizeRadius01(radius) * 0.3}) saturate(${Math.max(
				0.5,
				0.8 - normalizeRadius01(radius) * 0.3,
			)})`;

		case 'artisticGlowDiffused':
		case 'glowDiffused':
			return `blur(${Math.min(radius, 6)}px) brightness(${1.15 + normalizeRadius01(radius) * 0.15})`;

		case 'artisticSharpenEdges':
		case 'sharpen':
			return 'contrast(160%) brightness(105%)';

		case 'glass':
		case 'artisticGlass':
			return `blur(${Math.min(radius, 6)}px) brightness(110%)`;

		default:
			return 'contrast(105%) saturate(105%)';
	}
}

// ── Opacity ─────────────────────────────────────────────────────────────────

/**
 * Extract overall image opacity from the `alphaModFix` effect.
 * Returns a 0–1 value for CSS `opacity`, or `undefined` if not set.
 */
export function getImageEffectsOpacity(element: PptxElement): number | undefined {
	const effects = getEffects(element);
	if (!effects) {
		return undefined;
	}
	if (typeof effects.alphaModFix === 'number') {
		return clamp(effects.alphaModFix / 100, 0, 1);
	}
	return undefined;
}

// ── Duotone SVG filter ──────────────────────────────────────────────────────

/** BT.601 luminance feColorMatrix values (RGB → grayscale luminance). */
const GRAYSCALE_LUMINANCE_MATRIX = [
	0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0,
	1, 0,
].join(' ');

/**
 * Build the inner `<filter>` markup for a duotone colour mapping: convert to
 * grayscale luminance, then linearly remap 0→color1 (shadows) and 1→color2
 * (highlights) per channel. Mirrors React's `renderDuotoneSvgFilter`.
 */
function buildDuotoneFilterMarkup(color1: string, color2: string): string {
	const c1 = hexToRgbUnit(color1);
	const c2 = hexToRgbUnit(color2);
	return (
		`<feColorMatrix type="matrix" values="${GRAYSCALE_LUMINANCE_MATRIX}"/>` +
		'<feComponentTransfer>' +
		`<feFuncR type="linear" slope="${c2.r - c1.r}" intercept="${c1.r}"/>` +
		`<feFuncG type="linear" slope="${c2.g - c1.g}" intercept="${c1.g}"/>` +
		`<feFuncB type="linear" slope="${c2.b - c1.b}" intercept="${c1.b}"/>` +
		'</feComponentTransfer>'
	);
}

/**
 * High-fidelity duotone SVG filter for an image element.
 *
 * @returns The filter `id`, the matching `cssReference` (`url(#id)`), and the
 *          inner `filterMarkup` to inject — or `undefined` when the element has
 *          no duotone effect.
 */
export function getDuotoneImageFilter(
	element: PptxElement,
	elementId: string = isImageLikeElement(element) ? element.id : '',
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const effects = getEffects(element);
	if (!effects?.duotone) {
		return undefined;
	}
	const id = getImageDuotoneFilterId(elementId);
	return {
		id,
		cssReference: `url(#${id})`,
		filterMarkup: buildDuotoneFilterMarkup(effects.duotone.color1, effects.duotone.color2),
	};
}

// ── Advanced alpha / colour primitives SVG filter ───────────────────────────

/**
 * Build the inner `<filter>` markup covering the blip-side alpha primitives and
 * advanced colour effects that CSS filters can't express. Mirrors React's
 * `renderImageAlphaSvgFilter` (chained `in`/`result` primitives).
 *
 * @returns The markup, or `undefined` when no such primitives are present.
 */
function buildImageAlphaFilterMarkup(effects: PptxImageEffects): string | undefined {
	const parts: string[] = [];
	let resultIdx = 0;
	let inputRef = 'SourceGraphic';
	const next = (build: (input: string, output: string) => string): void => {
		const output = `r${resultIdx++}`;
		parts.push(build(inputRef, output));
		inputRef = output;
	};

	if (typeof effects.alphaModFix === 'number') {
		const mul = clamp(effects.alphaModFix / 100, 0, 1);
		next(
			(inp, out) =>
				`<feColorMatrix in="${inp}" result="${out}" type="matrix" ` +
				`values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${mul} 0"/>`,
		);
	}

	if (effects.alphaInv) {
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				'<feFuncA type="linear" slope="-1" intercept="1"/>' +
				'</feComponentTransfer>',
		);
	}

	if (effects.alphaCeiling) {
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				'<feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1"/>' +
				'</feComponentTransfer>',
		);
	}

	if (effects.alphaFloor) {
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				'<feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 1"/>' +
				'</feComponentTransfer>',
		);
	}

	if (typeof effects.alphaRepl === 'number') {
		const a = clamp(effects.alphaRepl / 100, 0, 1);
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncA type="linear" slope="0" intercept="${a}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (typeof effects.alphaBiLevel === 'number') {
		const t = clamp(effects.alphaBiLevel / 100, 0, 1);
		const table = Array.from({ length: 10 }, (_, i) => (i / 10 >= t ? '1' : '0')).join(' ');
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncA type="discrete" tableValues="${table}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (typeof effects.biLevel === 'number') {
		// grayscale, then threshold each channel.
		next((inp, out) => `<feColorMatrix in="${inp}" result="${out}" type="saturate" values="0"/>`);
		const tbl = buildImageBiLevelTable(effects.biLevel);
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncR type="discrete" tableValues="${tbl}"/>` +
				`<feFuncG type="discrete" tableValues="${tbl}"/>` +
				`<feFuncB type="discrete" tableValues="${tbl}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (
		effects.lum &&
		(typeof effects.lum.bright === 'number' || typeof effects.lum.contrast === 'number')
	) {
		const b = (effects.lum.bright ?? 0) / 100;
		const c = 1 + (effects.lum.contrast ?? 0) / 100;
		const slope = c;
		const intercept = b + (1 - c) / 2;
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (effects.hsl && typeof effects.hsl.sat === 'number') {
		const v = clamp(1 + effects.hsl.sat / 100, 0, 2);
		next(
			(inp, out) => `<feColorMatrix in="${inp}" result="${out}" type="saturate" values="${v}"/>`,
		);
	}

	if (effects.hsl && typeof effects.hsl.lum === 'number') {
		const { slope, intercept } = buildImageLuminanceTransfer(effects.hsl.lum);
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (effects.tint && typeof effects.tint.hue === 'number') {
		next(
			(inp, out) =>
				`<feColorMatrix in="${inp}" result="${out}" type="hueRotate" values="${effects.tint!.hue}"/>`,
		);
	}

	if (effects.tint && typeof effects.tint.amt === 'number') {
		const { slope, intercept } = buildImageLuminanceTransfer(effects.tint.amt);
		next(
			(inp, out) =>
				`<feComponentTransfer in="${inp}" result="${out}">` +
				`<feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>` +
				`<feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>` +
				'</feComponentTransfer>',
		);
	}

	if (effects.clrRepl) {
		const c = hexToRgbUnit(effects.clrRepl.color);
		next(
			(inp, out) =>
				`<feColorMatrix in="${inp}" result="${out}" type="matrix" ` +
				`values="0 0 0 0 ${c.r}  0 0 0 0 ${c.g}  0 0 0 0 ${c.b}  0 0 0 1 0"/>`,
		);
	}

	return parts.length > 0 ? parts.join('') : undefined;
}

/**
 * Advanced alpha / colour primitives SVG filter for an image element.
 *
 * @returns The filter `id`, its `cssReference`, and the inner `filterMarkup`,
 *          or `undefined` when no advanced primitives apply.
 */
export function getImageAlphaFilter(
	element: PptxElement,
	elementId: string = isImageLikeElement(element) ? element.id : '',
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const effects = getEffects(element);
	if (!effects || !hasAdvancedImageAlphaEffects(element)) {
		return undefined;
	}
	const markup = buildImageAlphaFilterMarkup(effects);
	if (!markup) {
		return undefined;
	}
	const id = getImageAlphaFilterId(elementId);
	return { id, cssReference: `url(#${id})`, filterMarkup: markup };
}

// ── Artistic SVG filter ─────────────────────────────────────────────────────

/**
 * Build an SVG `tableValues` string for `feFunc*.type=discrete` posterization:
 * `steps` evenly-spaced discrete levels across the 0–1 range, padded to 256.
 */
function buildDiscreteTable(steps: number): string {
	const values: number[] = [];
	for (let i = 0; i < steps; i++) {
		const v = Math.round((i / (steps - 1)) * 100) / 100;
		const count = Math.ceil(256 / steps);
		for (let j = 0; j < count; j++) {
			values.push(v);
		}
	}
	return values.slice(0, 256).join(' ');
}

/**
 * Build the inner `<filter>` markup for a complex artistic effect.
 * Mirrors React's `buildFilterPrimitives`. Returns `undefined` for effects that
 * don't need an SVG filter (handled via CSS instead).
 */
function buildArtisticFilterMarkup(effectName: string, radius: number): string | undefined {
	const normalizedRadius = clamp(radius, 0, 100) / 100;

	switch (effectName) {
		case 'artisticFilmGrain':
		case 'filmGrain': {
			const freq = 0.5 + normalizedRadius * 0.5;
			const opacity = 0.15 + normalizedRadius * 0.25;
			return (
				`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="1" stitchTiles="stitch" result="grain"/>` +
				'<feColorMatrix in="grain" type="saturate" values="0" result="grainGray"/>' +
				'<feBlend in="SourceGraphic" in2="grainGray" mode="overlay"/>' +
				'<feComponentTransfer>' +
				`<feFuncR type="linear" slope="${1 + opacity * 0.3}" intercept="${opacity * 0.02}"/>` +
				`<feFuncG type="linear" slope="${1 + opacity * 0.3}" intercept="${opacity * 0.02}"/>` +
				`<feFuncB type="linear" slope="${1 + opacity * 0.3}" intercept="${opacity * 0.02}"/>` +
				'</feComponentTransfer>'
			);
		}

		case 'artisticCutout':
		case 'cutout': {
			const steps = Math.max(2, Math.round(4 + normalizedRadius * 4));
			const tableValues = buildDiscreteTable(steps);
			return (
				'<feComponentTransfer>' +
				`<feFuncR type="discrete" tableValues="${tableValues}"/>` +
				`<feFuncG type="discrete" tableValues="${tableValues}"/>` +
				`<feFuncB type="discrete" tableValues="${tableValues}"/>` +
				'</feComponentTransfer>'
			);
		}

		case 'artisticCement':
		case 'cement': {
			const freq = 1.5 + normalizedRadius * 2.5;
			const desat = Math.max(0, 0.4 - normalizedRadius * 0.3);
			return (
				`<feColorMatrix type="saturate" values="${desat}" result="desat"/>` +
				`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="5" seed="2" stitchTiles="stitch" result="cementNoise"/>` +
				'<feColorMatrix in="cementNoise" type="saturate" values="0" result="cementGray"/>' +
				'<feBlend in="desat" in2="cementGray" mode="multiply"/>' +
				'<feComponentTransfer>' +
				'<feFuncR type="linear" slope="1.2" intercept="0"/>' +
				'<feFuncG type="linear" slope="1.2" intercept="0"/>' +
				'<feFuncB type="linear" slope="1.2" intercept="0"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticTexturizer':
		case 'texturizer': {
			const freq = 2.0 + normalizedRadius * 3.0;
			return (
				`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="3" stitchTiles="stitch" result="texNoise"/>` +
				'<feColorMatrix in="texNoise" type="saturate" values="0" result="texGray"/>' +
				'<feBlend in="SourceGraphic" in2="texGray" mode="overlay"/>' +
				'<feComponentTransfer>' +
				'<feFuncR type="linear" slope="1.1" intercept="0.02"/>' +
				'<feFuncG type="linear" slope="1.1" intercept="0.02"/>' +
				'<feFuncB type="linear" slope="1.1" intercept="0.02"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticCrisscrossEtching':
		case 'crisscrossEtching': {
			const freq = 0.08 + normalizedRadius * 0.12;
			return (
				'<feColorMatrix type="saturate" values="0" result="gray"/>' +
				`<feTurbulence type="turbulence" baseFrequency="${freq} ${freq * 3}" numOctaves="1" seed="7" result="lines"/>` +
				'<feColorMatrix in="lines" type="saturate" values="0" result="linesGray"/>' +
				'<feBlend in="gray" in2="linesGray" mode="multiply"/>' +
				'<feComponentTransfer>' +
				'<feFuncR type="linear" slope="1.3" intercept="-0.05"/>' +
				'<feFuncG type="linear" slope="1.3" intercept="-0.05"/>' +
				'<feFuncB type="linear" slope="1.3" intercept="-0.05"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticMosaic':
		case 'artisticMosaicBubbles':
		case 'mosaicBubbles':
		case 'mosaic': {
			const blurAmount = Math.max(2, Math.round(radius * 0.8));
			const freq = 0.02 + normalizedRadius * 0.03;
			return (
				`<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blurred"/>` +
				`<feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="1" seed="4" result="cells"/>` +
				`<feDisplacementMap in="blurred" in2="cells" scale="${blurAmount * 0.5}" xChannelSelector="R" yChannelSelector="G" result="mosaic"/>` +
				'<feComponentTransfer in="mosaic">' +
				'<feFuncR type="linear" slope="1.05" intercept="0"/>' +
				'<feFuncG type="linear" slope="1.05" intercept="0"/>' +
				'<feFuncB type="linear" slope="1.05" intercept="0"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticGlowEdges':
		case 'glowEdges':
		case 'glow_edges': {
			const edgeBlur = Math.max(1, Math.round(normalizedRadius * 3));
			return (
				'<feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" result="inverted"/>' +
				`<feGaussianBlur in="inverted" stdDeviation="${edgeBlur}" result="blurredInv"/>` +
				'<feBlend in="SourceGraphic" in2="blurredInv" mode="screen"/>' +
				'<feComponentTransfer>' +
				'<feFuncR type="linear" slope="2" intercept="-0.3"/>' +
				'<feFuncG type="linear" slope="2" intercept="-0.3"/>' +
				'<feFuncB type="linear" slope="2" intercept="-0.3"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticChalkSketch':
		case 'chalkSketch':
		case 'chalk': {
			const freq = 1.0 + normalizedRadius * 2.0;
			const desat = Math.max(0, 0.2 - normalizedRadius * 0.2);
			return (
				`<feColorMatrix type="saturate" values="${desat}" result="gray"/>` +
				`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="5" stitchTiles="stitch" result="chalkTex"/>` +
				'<feColorMatrix in="chalkTex" type="saturate" values="0" result="chalkGray"/>' +
				'<feBlend in="gray" in2="chalkGray" mode="overlay"/>' +
				'<feComponentTransfer>' +
				'<feFuncR type="linear" slope="1.5" intercept="0.05"/>' +
				'<feFuncG type="linear" slope="1.5" intercept="0.05"/>' +
				'<feFuncB type="linear" slope="1.5" intercept="0.05"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticPencilSketch':
		case 'pencilSketch': {
			const blurAmt = Math.max(3, Math.round(4 + normalizedRadius * 8));
			return (
				'<feColorMatrix type="saturate" values="0" result="gray"/>' +
				'<feColorMatrix in="gray" type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" result="invGray"/>' +
				`<feGaussianBlur in="invGray" stdDeviation="${blurAmt}" result="blurInv"/>` +
				'<feBlend in="blurInv" in2="gray" mode="screen" result="sketch"/>' +
				'<feComponentTransfer in="sketch">' +
				'<feFuncR type="linear" slope="1.6" intercept="-0.15"/>' +
				'<feFuncG type="linear" slope="1.6" intercept="-0.15"/>' +
				'<feFuncB type="linear" slope="1.6" intercept="-0.15"/>' +
				'</feComponentTransfer>'
			);
		}

		case 'artisticPencilGrayscale':
		case 'pencilGrayscale':
		case 'grayPencil': {
			const sharpenBlur = Math.max(0.5, 1 + normalizedRadius * 2);
			return (
				'<feColorMatrix type="saturate" values="0" result="gray"/>' +
				`<feGaussianBlur in="gray" stdDeviation="${sharpenBlur}" result="grayBlur"/>` +
				'<feComposite in="gray" in2="grayBlur" operator="arithmetic" k1="0" k2="1.5" k3="-0.5" k4="0"/>'
			);
		}

		default:
			return undefined;
	}
}

/**
 * Complex artistic SVG filter for an image element.
 *
 * @returns The filter `id`, its `cssReference`, and the inner `filterMarkup`,
 *          or `undefined` when the element's artistic effect (if any) is handled
 *          via CSS rather than an SVG filter.
 */
export function getArtisticImageFilter(
	element: PptxElement,
	elementId: string = isImageLikeElement(element) ? element.id : '',
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const effects = getEffects(element);
	if (!effects?.artisticEffect || !needsSvgArtisticFilter(effects.artisticEffect)) {
		return undefined;
	}
	const markup = buildArtisticFilterMarkup(effects.artisticEffect, effects.artisticRadius ?? 5);
	if (!markup) {
		return undefined;
	}
	const id = getArtisticFilterId(elementId);
	return { id, cssReference: `url(#${id})`, filterMarkup: markup };
}

// ── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Collect every SVG `<filter>` definition an element's image effects require
 * (duotone, advanced alpha, complex artistic) in the same order their `url(#…)`
 * references are appended in {@link getImageFilterCss}.
 */
export function getImageSvgFilters(element: PptxElement): ImageSvgFilterDefinition[] {
	const defs: ImageSvgFilterDefinition[] = [];
	const duotone = getDuotoneImageFilter(element);
	if (duotone) {
		defs.push({ id: duotone.id, markup: duotone.filterMarkup });
	}
	const alpha = getImageAlphaFilter(element);
	if (alpha) {
		defs.push({ id: alpha.id, markup: alpha.filterMarkup });
	}
	const artistic = getArtisticImageFilter(element);
	if (artistic) {
		defs.push({ id: artistic.id, markup: artistic.filterMarkup });
	}
	return defs;
}

/**
 * Aggregate computed style for an image element's effects: the CSS `filter`
 * string, an optional `opacity`, and the SVG `<filter>` defs to inject so the
 * `url(#…)` references in `filter` resolve.
 *
 * Returns empty/undefined fields for non-image elements or elements with no
 * effects, so it is always safe to spread onto an `<img>`.
 */
export function getComputedImageStyle(element: PptxElement): ComputedImageStyle {
	return {
		filter: getImageFilterCss(element),
		opacity: getImageEffectsOpacity(element),
		svgFilters: getImageSvgFilters(element),
	};
}
