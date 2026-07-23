/**
 * Framework-agnostic fill resolver for the Vue viewer.
 *
 * Ports the rich structured gradient and pattern-fill logic from the React
 * package (`viewer/utils/color-gradient.ts`, `color-patterns.ts`,
 * `color-core.ts`) into a pure, unit-testable TypeScript module. It converts
 * structured OOXML gradient and pattern-fill data on a `ShapeStyle` into CSS
 * background declarations.
 *
 * Three public entry points:
 *  - {@link buildGradientCss}       — structured gradient → CSS gradient string
 *  - {@link buildPatternFill}       — OOXML preset pattern → CSS background image
 *  - {@link getComputedFillStyle}   — aggregate resolver (image → gradient →
 *                                     pattern → solid), mirroring the React
 *                                     `getShapeVisualStyle` fill ordering.
 *
 * Gradient rendering follows ECMA-376 Part 1, §20.1.8.35 (gradFill) and
 * §20.1.8.49 (pathFill). Pattern presets follow §20.1.10.33
 * (ST_PresetPatternVal).
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { DEFAULT_FILL_COLOR, DEFAULT_TEXT_COLOR } from '../constants';

// ---------------------------------------------------------------------------
// Color primitives (inlined from React `color-core.ts`)
// ---------------------------------------------------------------------------

/**
 * Normalizes an arbitrary colour string to a 6-digit hex value (`#RRGGBB`).
 * Returns the fallback when the input is missing, "transparent", or invalid.
 *
 * `fallback` is optional and defaults to {@link DEFAULT_TEXT_COLOR}; this is the
 * single canonical normaliser consumed by every binding. React's `color-core`
 * re-exports this so its historical single-arg call sites (which relied on a
 * `DEFAULT_TEXT_COLOR` default) keep working without a duplicate definition.
 */
export function normalizeHexColor(
	value: string | undefined,
	fallback: string = DEFAULT_TEXT_COLOR,
): string {
	if (!value || value === 'transparent') {
		return fallback;
	}
	const candidate = value.startsWith('#') ? value : `#${value}`;
	return /^#[0-9A-Fa-f]{6}$/u.test(candidate) ? candidate : fallback;
}

/** Clamps a numeric value to the [0, 1] range. */
export function clampUnitInterval(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Parses a 6-digit hex colour into R/G/B channels (0-255), or `null`. */
export function hexToRgbChannels(color: string): { r: number; g: number; b: number } | null {
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
 * Converts a hex colour to an `rgba()` CSS string with the given opacity.
 * If `opacity` is `undefined`, the original hex colour is returned unchanged.
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

/**
 * Clamps an image crop value (fractional 0-1) to a safe range. Returns 0 for
 * non-finite or missing values, and caps at 0.95 to prevent the image from
 * being fully cropped away.
 */
export function clampCropValue(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(0.95, value));
}

/**
 * Creates a detached copy of a `Uint8Array` as an `ArrayBuffer`. Useful for
 * transferring binary data without shared-memory side-effects.
 */
export function createArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

// ---------------------------------------------------------------------------
// Gradient stop sanitization & conversion (from React `color-gradient.ts`)
// ---------------------------------------------------------------------------

type GradientStop = NonNullable<ShapeStyle['fillGradientStops']>[number];
type SanitizedStop = { color: string; position: number; opacity?: number };

/**
 * Validates, normalizes, and sorts an array of gradient stops. Filters out
 * invalid entries (missing color/position), clamps positions to 0-100,
 * normalizes colours, and sorts by ascending position.
 */
export function sanitizeGradientStops(
	stops: ShapeStyle['fillGradientStops'] | undefined,
): SanitizedStop[] {
	if (!stops || stops.length === 0) {
		return [];
	}
	return stops
		.filter(
			(stop: GradientStop) =>
				typeof stop?.color === 'string' &&
				String(stop.color).trim().length > 0 &&
				typeof stop?.position === 'number' &&
				Number.isFinite(stop.position),
		)
		.map((stop: GradientStop) => ({
			color: normalizeHexColor(String(stop.color), DEFAULT_FILL_COLOR),
			position: Math.max(0, Math.min(100, stop.position)),
			opacity:
				typeof stop.opacity === 'number' && Number.isFinite(stop.opacity)
					? clampUnitInterval(stop.opacity)
					: undefined,
		}))
		.sort((left, right) => left.position - right.position);
}

/**
 * Converts an OOXML gradient angle to a normalised CSS angle in degrees.
 * The Vue parser already pre-converts to plain degrees; when `alreadyDegrees`
 * is false the input is treated as 60000ths of a degree.
 */
export function convertOoxmlAngleToCss(ooxmlAngle: number, alreadyDegrees = true): number {
	const deg = alreadyDegrees ? ooxmlAngle : ooxmlAngle / 60000;
	return ((deg % 360) + 360) % 360;
}

/**
 * Converts a single gradient stop to a CSS gradient color-stop string,
 * applying opacity via `rgba()` when present.
 */
export function toCssGradientStop(stop: SanitizedStop): string {
	const color =
		typeof stop.opacity === 'number' ? colorWithOpacity(stop.color, stop.opacity) : stop.color;
	const pos = Math.max(0, Math.min(100, stop.position));
	const posStr = pos === Math.round(pos) ? `${pos}%` : `${pos.toFixed(1)}%`;
	return `${color} ${posStr}`;
}

/**
 * Computes the gradient center (as percentages) from a fillToRect and an
 * optional focalPoint offset.
 *
 * The fillToRect defines an inner rectangle; the gradient center defaults to
 * the center of that rectangle. When a focalPoint is also provided, it offsets
 * the center within the fillToRect bounds (averaged to avoid extreme shifts).
 */
export function computeGradientCenter(
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
): { cx: number; cy: number } {
	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		let cx = ((l + (1 - r)) / 2) * 100;
		let cy = ((t + (1 - b)) / 2) * 100;
		if (focalPoint) {
			const fpX = focalPoint.x * 100;
			const fpY = focalPoint.y * 100;
			cx = (cx + fpX) / 2;
			cy = (cy + fpY) / 2;
		}
		return { cx, cy };
	}
	if (focalPoint) {
		return { cx: focalPoint.x * 100, cy: focalPoint.y * 100 };
	}
	return { cx: 50, cy: 50 };
}

/** Builds a CSS radial-gradient for `path="circle"` gradients. */
export function buildCirclePathGradient(
	stops: SanitizedStop[],
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');
	const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

	const posX =
		Math.round(cx) === 50 && !focalPoint && !fillToRect ? 'center' : `${Math.round(cx)}%`;
	const posY =
		Math.round(cy) === 50 && !focalPoint && !fillToRect ? 'center' : `${Math.round(cy)}%`;

	if (fillToRect) {
		const radius = Math.max(cx, 100 - cx, cy, 100 - cy);
		return `radial-gradient(circle ${Math.round(radius)}% at ${posX} ${posY}, ${stopStr})`;
	}
	return `radial-gradient(circle at ${posX} ${posY}, ${stopStr})`;
}

/** Builds a CSS radial-gradient for `path="rect"` gradients. */
export function buildRectPathGradient(
	stops: SanitizedStop[],
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');

	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

		const semiX = Math.max(cx, 100 - cx);
		const semiY = Math.max(cy, 100 - cy);
		const posX = `${Math.round(cx)}%`;
		const posY = `${Math.round(cy)}%`;

		const innerHalfW = ((1 - l - r) / 2) * 100;
		const innerHalfH = ((1 - t - b) / 2) * 100;

		if (innerHalfW > 0.5 && innerHalfH > 0.5 && Math.abs(semiX - semiY) > 1) {
			const aspect = innerHalfW / innerHalfH;
			const adjustedSemiX = Math.round(semiY * aspect);
			const adjustedSemiY = Math.round(semiY);
			return `radial-gradient(${adjustedSemiX}% ${adjustedSemiY}% at ${posX} ${posY}, ${stopStr})`;
		}
		return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
	}

	const posX = focalPoint ? `${Math.round(focalPoint.x * 100)}%` : 'center';
	const posY = focalPoint ? `${Math.round(focalPoint.y * 100)}%` : 'center';
	return `radial-gradient(ellipse at ${posX} ${posY}, ${stopStr})`;
}

/** Builds a CSS gradient approximation for `path="shape"` gradients. */
export function buildShapePathGradient(
	stops: SanitizedStop[],
	focalPoint?: ShapeStyle['fillGradientFocalPoint'],
	fillToRect?: ShapeStyle['fillGradientFillToRect'],
): string {
	const stopStr = stops.map(toCssGradientStop).join(', ');

	if (fillToRect) {
		const { l, t, r, b } = fillToRect;
		const { cx, cy } = computeGradientCenter(fillToRect, focalPoint);

		const posX = `${Math.round(cx)}%`;
		const posY = `${Math.round(cy)}%`;
		const semiX = Math.max(cx, 100 - cx);
		const semiY = Math.max(cy, 100 - cy);

		const innerHalfW = ((1 - l - r) / 2) * 100;
		const innerHalfH = ((1 - t - b) / 2) * 100;

		if (innerHalfW > 0.5 && innerHalfH > 0.5 && Math.abs(innerHalfW - innerHalfH) > 1) {
			const aspect = innerHalfW / innerHalfH;
			const adjustedSemiX = Math.round(Math.max(semiX, semiY * aspect));
			const adjustedSemiY = Math.round(Math.max(semiY, semiX / aspect));
			return `radial-gradient(${adjustedSemiX}% ${adjustedSemiY}% at ${posX} ${posY}, ${stopStr})`;
		}
		if (semiX > 0.5 || semiY > 0.5) {
			return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
		}
		return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
	}

	const { cx, cy } = computeGradientCenter(undefined, focalPoint);
	const posX = focalPoint ? `${Math.round(cx)}%` : 'center';
	const posY = focalPoint ? `${Math.round(cy)}%` : 'center';
	return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
}

// ---------------------------------------------------------------------------
// Gradient tile/flip mode (from React `color-gradient.ts`)
// ---------------------------------------------------------------------------

/**
 * OOXML gradient tile-flip mode from `a:gradFill/@flip`
 * (`ShapeStyle['fillGradientFlip']`). Controls how the gradient tile is
 * mirrored when tiled:
 *  - `"none"` — clamp: gradient stops at 0% and 100%, no repeat.
 *  - `"x"`    — flip horizontally on each tile.
 *  - `"y"`    — flip vertically on each tile.
 *  - `"xy"`   — flip both axes on each tile.
 */
export type GradientTileFlipMode = NonNullable<ShapeStyle['fillGradientFlip']>;

/**
 * Builds a CSS `background-size` + `background-repeat` pair that approximates
 * gradient tiling with flip. Standard CSS does not natively support gradient
 * flipping, so we approximate it by halving the background-size on the flipped
 * axis and repeating; the gradient itself is built with reflected stops (see
 * {@link buildReflectedGradientStops}).
 *
 * @param mode - The OOXML tile-flip mode.
 * @returns CSS properties to apply, or `undefined` if no tiling is needed.
 */
export function getGradientTileFlipCss(
	mode: GradientTileFlipMode | undefined,
): { backgroundSize?: string; backgroundRepeat?: string } | undefined {
	if (!mode || mode === 'none') {
		return undefined;
	}

	switch (mode) {
		case 'x':
			return { backgroundSize: '50% 100%', backgroundRepeat: 'repeat-x' };
		case 'y':
			return { backgroundSize: '100% 50%', backgroundRepeat: 'repeat-y' };
		case 'xy':
			return { backgroundSize: '50% 50%', backgroundRepeat: 'repeat' };
		default:
			return undefined;
	}
}

/**
 * Builds the `background-size` / `background-position` / `background-repeat`
 * that confine a gradient to the rectangle described by `a:gradFill/a:tileRect`.
 *
 * `tileRect` LTRB values are 0..1 insets from each edge, so the tile covers
 * `(1 - l - r)` x `(1 - t - b)` of the shape, offset by `l`/`t`. Returns
 * `undefined` when the rect is missing, degenerate, or effectively full-bleed
 * (no meaningful inset), so callers fall through to the plain gradient.
 */
export function getGradientTileRectCss(
	tileRect: ShapeStyle['fillGradientTileRect'] | undefined,
): { backgroundSize: string; backgroundPosition: string; backgroundRepeat: string } | undefined {
	if (!tileRect) {
		return undefined;
	}
	const { l, t, r, b } = tileRect;
	const sizeW = 1 - l - r;
	const sizeH = 1 - t - b;
	if (sizeW <= 0 || sizeH <= 0) {
		return undefined;
	}
	if (Math.abs(sizeW - 1) < 0.001 && Math.abs(sizeH - 1) < 0.001) {
		return undefined;
	}
	const posX = 1 - sizeW > 0.001 ? (l / (1 - sizeW)) * 100 : 0;
	const posY = 1 - sizeH > 0.001 ? (t / (1 - sizeH)) * 100 : 0;
	return {
		backgroundSize: `${Math.round(sizeW * 100)}% ${Math.round(sizeH * 100)}%`,
		backgroundPosition: `${Math.round(posX)}% ${Math.round(posY)}%`,
		backgroundRepeat: 'no-repeat',
	};
}

/**
 * Creates a reflected (mirrored) copy of gradient stops for tile-flip
 * rendering. The original stops run 0->100; the result packs one full
 * forward-backward cycle into 0-100: a forward pass mapped to 0-50 and a
 * mirrored pass mapped to 50-100. Combined with a halved `background-size`
 * (see {@link getGradientTileFlipCss}) this approximates OOXML tile-flip.
 *
 * @param stops - Original sanitized gradient stops (positions 0-100).
 * @returns A new stop array covering 0-100 with forward + mirrored stops.
 */
export function buildReflectedGradientStops(stops: SanitizedStop[]): SanitizedStop[] {
	if (stops.length === 0) {
		return [];
	}

	// Forward pass: map positions from 0-100 to 0-50.
	const forward = stops.map((s) => ({
		...s,
		position: s.position / 2,
	}));

	// Reverse pass: map positions from 0-100 to 100-50 (mirrored).
	const reversed = [...stops].reverse().map((s) => ({
		...s,
		position: 50 + (100 - s.position) / 2,
	}));

	return [...forward, ...reversed];
}

/**
 * Optional geometry context for {@link buildGradientCss}. Supplying it lets the
 * resolver apply the two OOXML linear-gradient attributes that depend on the
 * owning shape:
 *  - `a:lin/@scaled` (default true): the angle is measured in the shape's unit
 *    square then stretched to the box, so the visual angle depends on the
 *    width/height aspect ratio.
 *  - `a:gradFill/@rotWithShape=false`: the gradient must stay fixed to the page
 *    frame, so it is counter-rotated by the element's own rotation.
 */
export interface GradientRenderContext {
	/** Element rotation in degrees (`PptxElementBase.rotation`). */
	rotation?: number;
	/** Element width in px. */
	width?: number;
	/** Element height in px. */
	height?: number;
}

/** Normalise a degree value into the [0, 360) range. */
function normalizeDegrees(deg: number): number {
	return ((deg % 360) + 360) % 360;
}

/**
 * Apply `a:lin/@scaled` (aspect-ratio) and `a:gradFill/@rotWithShape`
 * corrections to a linear-gradient angle. A no-op when no geometry context is
 * supplied or neither attribute is in force, so callers that pass only a style
 * keep the raw authored angle.
 */
function adjustLinearGradientAngle(
	angle: number,
	gradient: ShapeStyle,
	context: GradientRenderContext | undefined,
): number {
	if (!context) {
		return angle;
	}
	let result = angle;
	const { width, height, rotation } = context;
	if (
		gradient.fillGradientScaled !== false &&
		typeof width === 'number' &&
		typeof height === 'number' &&
		width > 0 &&
		height > 0 &&
		width !== height
	) {
		const rad = (result * Math.PI) / 180;
		result = normalizeDegrees(
			(Math.atan2(height * Math.sin(rad), width * Math.cos(rad)) * 180) / Math.PI,
		);
	}
	if (gradient.fillGradientRotWithShape === false && typeof rotation === 'number') {
		result = normalizeDegrees(result - rotation);
	}
	return result;
}

/**
 * Converts a structured OOXML gradient on a `ShapeStyle` to a CSS
 * `linear-gradient(...)` / `radial-gradient(...)` string.
 *
 * Falls back to the prebuilt `style.fillGradient` string when no structured
 * stops are present, and returns `undefined` when there is no gradient fill.
 *
 * When `fillGradientFlip` is `x`/`y`/`xy` the linear gradient is built from
 * reflected stops so that, tiled via the matching {@link getGradientTileFlipCss}
 * `background-size`/`background-repeat`, it mirrors per tile the way OOXML
 * tile-flip does. Radial gradients are left unflipped (CSS cannot tile-mirror
 * a radial), matching the React port.
 *
 * @param gradient - The shape style carrying gradient configuration.
 * @param context  - Optional element geometry enabling `@scaled` /
 *                   `@rotWithShape` angle corrections (linear only).
 * @returns A CSS gradient string, or `undefined`.
 */
export function buildGradientCss(
	gradient: ShapeStyle | undefined,
	context?: GradientRenderContext,
): string | undefined {
	if (!gradient || gradient.fillMode !== 'gradient') {
		return undefined;
	}

	const stops = sanitizeGradientStops(gradient.fillGradientStops);
	if (stops.length === 0) {
		return gradient.fillGradient;
	}

	const gradientType = gradient.fillGradientType || 'linear';
	if (gradientType === 'radial') {
		const pathType = gradient.fillGradientPathType || 'circle';
		const fp = gradient.fillGradientFocalPoint;
		const ftr = gradient.fillGradientFillToRect;

		if (pathType === 'rect') {
			return buildRectPathGradient(stops, fp, ftr);
		}
		if (pathType === 'shape') {
			return buildShapePathGradient(stops, fp, ftr);
		}
		return buildCirclePathGradient(stops, fp, ftr);
	}

	const normalizedAngle =
		typeof gradient.fillGradientAngle === 'number' && Number.isFinite(gradient.fillGradientAngle)
			? gradient.fillGradientAngle
			: 90;
	const effectiveAngle = adjustLinearGradientAngle(normalizedAngle, gradient, context);

	// Tile-flip: reflect the stops so a single tile contains one mirrored
	// forward-backward cycle. The repeating/halved tiling is applied by the
	// caller via getGradientTileFlipCss (wired into getComputedFillStyle).
	const flip = gradient.fillGradientFlip;
	const linearStops = flip && flip !== 'none' ? buildReflectedGradientStops(stops) : stops;

	return `linear-gradient(${Math.round(effectiveAngle)}deg, ${linearStops
		.map(toCssGradientStop)
		.join(', ')})`;
}

/**
 * Alias of {@link buildGradientCss} preserved for the per-binding gradient
 * modules (React/Angular `color-gradient.ts`) whose public symbol was named
 * `buildCssGradientFromShapeStyle`. Both bindings shim onto this name so their
 * existing consumers and colocated tests keep importing the same symbol.
 *
 * Note: unlike the original per-binding `buildCssGradientFromShapeStyle`, this
 * resolver also applies gradient tile-flip stop reflection for structured
 * linear gradients (see {@link buildGradientCss}); the matching halved/repeating
 * `background-size`/`background-repeat` is applied by {@link getComputedFillStyle}.
 */
export const buildCssGradientFromShapeStyle = buildGradientCss;

// ---------------------------------------------------------------------------
// Pattern fills (from React `color-patterns.ts`)
// ---------------------------------------------------------------------------

/**
 * Generates a tiled inline SVG markup string approximating an OOXML preset
 * pattern (ST_PresetPatternVal). Patterns paint a foreground (`fg`) on a
 * background (`bg`) fill. Returns `null` for unknown presets.
 *
 * Reference: ECMA-376 Part 1, §20.1.10.33.
 */
export function getPatternSvg(preset: string, fg: string, bg: string): string | null {
	const s = 8;
	const xmlns = 'http://www.w3.org/2000/svg';
	const svg = (w: number, h: number, inner: string) =>
		`<svg xmlns="${xmlns}" width="${w}" height="${h}">${inner}</svg>`;
	const rect = (x: number, y: number, w: number, h: number, fill: string) =>
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
	const bgRect = (w: number, h: number) => rect(0, 0, w, h, bg);
	const line = (
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		stroke: string,
		sw: number,
		extra = '',
	) =>
		`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;
	const circle = (cx: number, cy: number, r: number, fill: string) =>
		`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

	switch (preset) {
		// ── Percentage fills ──────────────────────────────────────────────
		case 'pct5':
			return svg(s, s, bgRect(s, s) + rect(0, 0, 1, 1, fg));
		case 'pct10':
			return svg(s, s, bgRect(s, s) + rect(0, 0, 1, 1, fg) + rect(4, 4, 1, 1, fg));
		case 'pct20':
			return svg(4, 4, bgRect(4, 4) + rect(0, 0, 1, 1, fg) + rect(2, 2, 1, 1, fg));
		case 'pct25':
			return svg(
				4,
				4,
				bgRect(4, 4) +
					rect(0, 0, 1, 1, fg) +
					rect(2, 0, 1, 1, fg) +
					rect(1, 2, 1, 1, fg) +
					rect(3, 2, 1, 1, fg),
			);
		case 'pct30':
			return svg(
				4,
				4,
				bgRect(4, 4) +
					rect(0, 0, 1, 1, fg) +
					rect(2, 0, 1, 1, fg) +
					rect(1, 1, 1, 1, fg) +
					rect(3, 1, 1, 1, fg) +
					rect(0, 2, 1, 1, fg) +
					rect(2, 2, 1, 1, fg),
			);
		case 'pct40':
			return svg(
				4,
				4,
				bgRect(4, 4) +
					rect(0, 0, 2, 1, fg) +
					rect(1, 1, 1, 1, fg) +
					rect(3, 1, 1, 1, fg) +
					rect(0, 2, 2, 1, fg) +
					rect(1, 3, 1, 1, fg) +
					rect(3, 3, 1, 1, fg),
			);
		case 'pct50':
			return svg(2, 2, bgRect(2, 2) + rect(0, 0, 1, 1, fg) + rect(1, 1, 1, 1, fg));
		case 'pct60':
			return svg(4, 4, rect(0, 0, 4, 4, fg) + rect(0, 0, 2, 1, bg) + rect(1, 2, 2, 1, bg));
		case 'pct70':
			return svg(
				4,
				4,
				rect(0, 0, 4, 4, fg) +
					rect(0, 0, 1, 1, bg) +
					rect(2, 0, 1, 1, bg) +
					rect(1, 2, 1, 1, bg) +
					rect(3, 2, 1, 1, bg),
			);
		case 'pct75':
			return svg(4, 4, rect(0, 0, 4, 4, fg) + rect(0, 0, 1, 1, bg) + rect(2, 2, 1, 1, bg));
		case 'pct80':
			return svg(4, 4, rect(0, 0, 4, 4, fg) + rect(0, 0, 1, 1, bg));
		case 'pct90':
			return svg(s, s, rect(0, 0, s, s, fg) + rect(0, 0, 1, 1, bg));

		// ── Horizontal lines ─────────────────────────────────────────────
		case 'horz':
			return svg(s, s, bgRect(s, s) + rect(0, 3, s, 2, fg));
		case 'ltHorz':
			return svg(s, s, bgRect(s, s) + rect(0, 0, s, 1, fg));
		case 'dkHorz':
			return svg(s, s, bgRect(s, s) + rect(0, 0, s, 4, fg));
		case 'narHorz':
			return svg(s, 4, bgRect(s, 4) + rect(0, 0, s, 1, fg) + rect(0, 2, s, 1, fg));
		case 'wdHorz':
			return svg(s, 12, bgRect(s, 12) + rect(0, 0, s, 2, fg));

		// ── Vertical lines ───────────────────────────────────────────────
		case 'vert':
			return svg(s, s, bgRect(s, s) + rect(3, 0, 2, s, fg));
		case 'ltVert':
			return svg(s, s, bgRect(s, s) + rect(0, 0, 1, s, fg));
		case 'dkVert':
			return svg(s, s, bgRect(s, s) + rect(0, 0, 4, s, fg));
		case 'narVert':
			return svg(4, s, bgRect(4, s) + rect(0, 0, 1, s, fg) + rect(2, 0, 1, s, fg));
		case 'wdVert':
			return svg(12, s, bgRect(12, s) + rect(0, 0, 2, s, fg));

		// ── Dash lines ───────────────────────────────────────────────────
		case 'dashHorz':
			return svg(s, 4, bgRect(s, 4) + rect(0, 0, 4, 1, fg));
		case 'dashVert':
			return svg(4, s, bgRect(4, s) + rect(0, 0, 1, 4, fg));

		// ── Cross / grid ─────────────────────────────────────────────────
		case 'cross':
			return svg(s, s, bgRect(s, s) + rect(3, 0, 2, s, fg) + rect(0, 3, s, 2, fg));

		// ── Diagonal lines (down) ────────────────────────────────────────
		case 'dnDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, 0, s, s, fg, 2) +
					line(-s, 0, 0, s, fg, 2) +
					line(s, 0, s * 2, s, fg, 2),
			);
		case 'ltDnDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, 0, s, s, fg, 1) +
					line(-s, 0, 0, s, fg, 1) +
					line(s, 0, s * 2, s, fg, 1),
			);
		case 'dkDnDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, 0, s, s, fg, 3) +
					line(-s, 0, 0, s, fg, 3) +
					line(s, 0, s * 2, s, fg, 3),
			);
		case 'wdDnDiag':
			return svg(
				12,
				12,
				bgRect(12, 12) +
					line(0, 0, 12, 12, fg, 4) +
					line(-12, 0, 0, 12, fg, 4) +
					line(12, 0, 24, 12, fg, 4),
			);
		case 'dashDnDiag':
			return svg(s, s, bgRect(s, s) + line(0, 0, s, s, fg, 1, ' stroke-dasharray="4,4"'));

		// ── Diagonal lines (up) ──────────────────────────────────────────
		case 'upDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, s, s, 0, fg, 2) +
					line(-s, s, 0, 0, fg, 2) +
					line(s, s, s * 2, 0, fg, 2),
			);
		case 'ltUpDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, s, s, 0, fg, 1) +
					line(-s, s, 0, 0, fg, 1) +
					line(s, s, s * 2, 0, fg, 1),
			);
		case 'dkUpDiag':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, s, s, 0, fg, 3) +
					line(-s, s, 0, 0, fg, 3) +
					line(s, s, s * 2, 0, fg, 3),
			);
		case 'wdUpDiag':
			return svg(
				12,
				12,
				bgRect(12, 12) +
					line(0, 12, 12, 0, fg, 4) +
					line(-12, 12, 0, 0, fg, 4) +
					line(12, 12, 24, 0, fg, 4),
			);
		case 'dashUpDiag':
			return svg(s, s, bgRect(s, s) + line(0, s, s, 0, fg, 1, ' stroke-dasharray="4,4"'));

		// ── Diagonal cross ───────────────────────────────────────────────
		case 'diagCross':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, 0, s, s, fg, 1) +
					line(-s, 0, 0, s, fg, 1) +
					line(s, 0, s * 2, s, fg, 1) +
					line(0, s, s, 0, fg, 1) +
					line(-s, s, 0, 0, fg, 1) +
					line(s, s, s * 2, 0, fg, 1),
			);

		// ── Checkerboard ─────────────────────────────────────────────────
		case 'smCheck':
			return svg(4, 4, bgRect(4, 4) + rect(0, 0, 2, 2, fg) + rect(2, 2, 2, 2, fg));
		case 'lgCheck':
			return svg(s, s, bgRect(s, s) + rect(0, 0, 4, 4, fg) + rect(4, 4, 4, 4, fg));

		// ── Grids ────────────────────────────────────────────────────────
		case 'smGrid':
			return svg(s, s, bgRect(s, s) + rect(0, 0, s, 1, fg) + rect(0, 0, 1, s, fg));
		case 'lgGrid':
			return svg(16, 16, bgRect(16, 16) + rect(0, 0, 16, 1, fg) + rect(0, 0, 1, 16, fg));
		case 'dotGrid':
			return svg(
				s,
				s,
				bgRect(s, s) +
					circle(0, 0, 0.5, fg) +
					circle(4, 0, 0.5, fg) +
					circle(0, 4, 0.5, fg) +
					circle(4, 4, 0.5, fg) +
					rect(0, 0, s, 0.5, fg) +
					rect(0, 0, 0.5, s, fg),
			);

		// ── Confetti ─────────────────────────────────────────────────────
		case 'smConfetti':
			return svg(
				s,
				s,
				bgRect(s, s) +
					rect(1, 0, 1, 1, fg) +
					rect(5, 1, 1, 1, fg) +
					rect(3, 3, 1, 1, fg) +
					rect(7, 2, 1, 1, fg) +
					rect(0, 5, 1, 1, fg) +
					rect(4, 6, 1, 1, fg) +
					rect(2, 7, 1, 1, fg) +
					rect(6, 5, 1, 1, fg),
			);
		case 'lgConfetti':
			return svg(
				s,
				s,
				bgRect(s, s) +
					rect(0, 0, 2, 2, fg) +
					rect(5, 1, 2, 2, fg) +
					rect(2, 4, 2, 2, fg) +
					rect(6, 5, 2, 2, fg),
			);

		// ── Brick ────────────────────────────────────────────────────────
		case 'horzBrick':
			return svg(
				s,
				s,
				bgRect(s, s) +
					rect(0, 0, s, 1, fg) +
					rect(0, 0, 1, 4, fg) +
					rect(0, 4, s, 1, fg) +
					rect(4, 4, 1, 4, fg),
			);
		case 'diagBrick':
			return svg(
				s,
				s,
				bgRect(s, s) + line(0, 4, 4, 0, fg, 1) + line(4, s, s, 4, fg, 1) + line(0, s, s, 0, fg, 1),
			);

		// ── Diamond ──────────────────────────────────────────────────────
		case 'solidDmnd':
			return svg(s, s, `${bgRect(s, s)}<polygon points="4,0 8,4 4,8 0,4" fill="${fg}"/>`);
		case 'openDmnd':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(4, 0, s, 4, fg, 1) +
					line(s, 4, 4, s, fg, 1) +
					line(4, s, 0, 4, fg, 1) +
					line(0, 4, 4, 0, fg, 1),
			);
		case 'dotDmnd':
			return svg(
				s,
				s,
				bgRect(s, s) +
					circle(4, 0, 0.75, fg) +
					circle(s, 4, 0.75, fg) +
					circle(4, s, 0.75, fg) +
					circle(0, 4, 0.75, fg) +
					circle(4, 4, 0.75, fg),
			);

		// ── Plaid ────────────────────────────────────────────────────────
		case 'plaid':
			return svg(
				s,
				s,
				bgRect(s, s) +
					rect(0, 0, 4, 4, fg) +
					rect(0, 0, s, 1, fg) +
					rect(0, 2, s, 1, fg) +
					rect(0, 0, 1, s, fg) +
					rect(2, 0, 1, s, fg),
			);

		// ── Sphere ───────────────────────────────────────────────────────
		case 'sphere': {
			const defs = `<defs><radialGradient id="sph" cx="35%" cy="35%" r="60%"><stop offset="0%" stop-color="${bg}" stop-opacity="0.8"/><stop offset="100%" stop-color="${fg}" stop-opacity="1"/></radialGradient></defs>`;
			return svg(s, s, `${bgRect(s, s)}${defs}<circle cx="4" cy="4" r="3.5" fill="url(#sph)"/>`);
		}

		// ── Weave ────────────────────────────────────────────────────────
		case 'weave':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(0, 0, 4, 4, fg, 1.5) +
					line(4, 4, 0, s, fg, 1.5) +
					line(s, 0, 4, 4, fg, 1.5) +
					line(4, 4, s, s, fg, 1.5) +
					line(4, 0, s, 4, fg, 1.5) +
					line(0, 4, 4, s, fg, 1.5),
			);

		// ── Divot ────────────────────────────────────────────────────────
		case 'divot':
			return svg(
				s,
				s,
				bgRect(s, s) +
					line(2, 1, 2, 3, fg, 1) +
					line(1, 2, 3, 2, fg, 1) +
					line(6, 5, 6, 7, fg, 1) +
					line(5, 6, 7, 6, fg, 1),
			);

		// ── Shingle ──────────────────────────────────────────────────────
		case 'shingle':
			return svg(
				s,
				s,
				bgRect(s, s) + line(0, 0, s, s, fg, 1) + line(0, s, 4, 4, fg, 1) + rect(0, 7, s, 1, fg),
			);

		// ── Wave ─────────────────────────────────────────────────────────
		case 'wave':
			return svg(
				s,
				s,
				`${bgRect(s, s)}<path d="M0,2 Q2,0 4,2 Q6,4 8,2" stroke="${fg}" stroke-width="1" fill="none"/><path d="M0,6 Q2,4 4,6 Q6,8 8,6" stroke="${fg}" stroke-width="1" fill="none"/>`,
			);

		// ── Trellis ──────────────────────────────────────────────────────
		case 'trellis':
			return svg(
				4,
				4,
				bgRect(4, 4) +
					rect(0, 0, 4, 1, fg) +
					rect(0, 2, 4, 1, fg) +
					rect(0, 0, 1, 4, fg) +
					rect(2, 0, 1, 4, fg),
			);

		// ── ZigZag ───────────────────────────────────────────────────────
		case 'zigZag':
			return svg(
				s,
				s,
				`${bgRect(s, s)}<path d="M0,4 L2,0 L4,4 L6,0 L8,4" stroke="${fg}" stroke-width="1" fill="none"/><path d="M0,8 L2,4 L4,8 L6,4 L8,8" stroke="${fg}" stroke-width="1" fill="none"/>`,
			);

		default:
			return null;
	}
}

/** Result of {@link buildPatternFill}. */
export interface PatternFillResult {
	/** CSS `background-image` value (inline SVG data-URI). */
	backgroundImage?: string;
	/** Resolved pattern background colour (hex), used as the CSS `backgroundColor`. */
	backgroundColor?: string;
	/**
	 * Optional SVG `<defs>`/filter markup that a renderer can inject into a
	 * shared `<svg>` element. Self-contained data-URI patterns do not need
	 * this, so it is `undefined` for every current preset; it exists as the
	 * extension hook for presets that cannot be expressed as a tiled data-URI.
	 */
	svgFilter?: { id: string; markup: string };
}

/**
 * Converts an OOXML preset pattern fill (`a:pattFill` — foreground/background
 * colour plus a preset such as `pct50`, `ltHorz`, `cross`, …) to a CSS
 * background built from an inline SVG data-URI.
 *
 * Mirrors React `buildPatternFillCss`, but accepts a `ShapeStyle` plus the
 * owning element id so future filter-based presets can emit a uniquely-named
 * `svgFilter`. Returns `undefined` when the style is not a pattern fill or the
 * preset is unknown.
 *
 * @param pattern   - The shape style carrying pattern configuration.
 * @param elementId - The owning element id (namespaces any emitted filter id).
 */
export function buildPatternFill(
	pattern: ShapeStyle | undefined,
	elementId: string,
): PatternFillResult | undefined {
	if (!pattern || pattern.fillMode !== 'pattern' || !pattern.fillPatternPreset) {
		return undefined;
	}

	const fg = normalizeHexColor(pattern.fillColor, '#000000');
	const bg = normalizeHexColor(pattern.fillPatternBackgroundColor, '#ffffff');
	const preset = pattern.fillPatternPreset;

	const svgPattern = getPatternSvg(preset, fg, bg);
	if (!svgPattern) {
		return undefined;
	}

	const encoded = encodeURIComponent(svgPattern);
	// `elementId` is reserved for namespacing future filter-based presets; the
	// current presets are fully self-contained data-URIs so no defs are emitted.
	void elementId;
	return {
		backgroundImage: `url("data:image/svg+xml,${encoded}")`,
		backgroundColor: bg,
	};
}

/**
 * Builds a CSS `background-image` + `background-color` pair for an OOXML pattern
 * fill (`a:pattFill`) directly from a `ShapeStyle`. This is the
 * binding-friendly variant (no `elementId`, no `svgFilter`) that the React and
 * Angular `color-*` modules historically exposed as `buildPatternFillCss`.
 *
 * Returns `undefined` when the style is not a pattern fill or the preset is
 * unknown. Mirrors {@link buildPatternFill} minus the filter-id namespacing.
 *
 * @param style - Resolved shape style.
 */
export function buildPatternFillCss(
	style: ShapeStyle | undefined,
): { backgroundImage: string; backgroundColor: string } | undefined {
	if (!style || style.fillMode !== 'pattern' || !style.fillPatternPreset) {
		return undefined;
	}

	const fg = normalizeHexColor(style.fillColor, '#000000');
	const bg = normalizeHexColor(style.fillPatternBackgroundColor, '#ffffff');

	const svgPattern = getPatternSvg(style.fillPatternPreset, fg, bg);
	if (!svgPattern) {
		return undefined;
	}

	const encoded = encodeURIComponent(svgPattern);
	return {
		backgroundImage: `url("data:image/svg+xml,${encoded}")`,
		backgroundColor: bg,
	};
}

/**
 * All 52 OOXML pattern fill presets.
 * Reference: ECMA-376 §20.1.10.33 (ST_PresetPatternVal).
 */
export const OOXML_PATTERN_PRESETS = [
	'pct5',
	'pct10',
	'pct20',
	'pct25',
	'pct30',
	'pct40',
	'pct50',
	'pct60',
	'pct70',
	'pct75',
	'pct80',
	'pct90',
	'horz',
	'vert',
	'ltHorz',
	'ltVert',
	'dkHorz',
	'dkVert',
	'narHorz',
	'narVert',
	'wdHorz',
	'wdVert',
	'dashHorz',
	'dashVert',
	'cross',
	'dnDiag',
	'upDiag',
	'ltDnDiag',
	'ltUpDiag',
	'dkDnDiag',
	'dkUpDiag',
	'wdDnDiag',
	'wdUpDiag',
	'dashDnDiag',
	'dashUpDiag',
	'diagCross',
	'smCheck',
	'lgCheck',
	'smGrid',
	'lgGrid',
	'dotGrid',
	'smConfetti',
	'lgConfetti',
	'horzBrick',
	'diagBrick',
	'solidDmnd',
	'openDmnd',
	'dotDmnd',
	'plaid',
	'sphere',
	'weave',
	'divot',
	'shingle',
	'wave',
	'trellis',
	'zigZag',
] as const;

export type OoxmlPatternPreset = (typeof OOXML_PATTERN_PRESETS)[number];

// ---------------------------------------------------------------------------
// Aggregate fill resolver
// ---------------------------------------------------------------------------

/** Result of {@link getComputedFillStyle}. */
export interface ComputedFillStyle {
	backgroundColor?: string;
	backgroundImage?: string;
	backgroundSize?: string;
	backgroundPosition?: string;
	backgroundRepeat?: string;
	/** Carried through for renderers that need to inject pattern defs. */
	svgFilter?: { id: string; markup: string };
}

/**
 * Aggregate fill resolver. Resolves the element's fill in the exact order the
 * React `getShapeVisualStyle` uses:
 *
 *   1. image fill  (`fillMode === "image"` + `fillImageUrl`)
 *   2. gradient    (structured `fillGradientStops`, falling back to the
 *                   prebuilt `fillGradient` string)
 *   3. pattern     (`fillMode === "pattern"` + preset)
 *   4. solid       (`fillColor`, unless `fillMode === "none"`)
 *
 * Returns `undefined` when the element carries no shape styling, and an
 * empty-ish object when no fill applies (so callers can spread the result
 * safely).
 *
 * A child of a group whose fill is `a:grpFill` (`fillMode === "group"`)
 * inherits the group's resolved fill: pass the parent group's `ShapeStyle`
 * (`GroupPptxElement.groupFill`) as {@link parentGroupFill} and it is resolved
 * in the child's own box.
 *
 * @param element         - The PPTX element to resolve a fill for.
 * @param parentGroupFill - The enclosing group's fill style, used only when the
 *                          element's own fill is `a:grpFill`.
 */
export function getComputedFillStyle(
	element: PptxElement,
	parentGroupFill?: ShapeStyle,
): ComputedFillStyle | undefined {
	if (!hasShapeProperties(element)) {
		return undefined;
	}
	const ss = element.shapeStyle;
	if (!ss) {
		return {};
	}

	// grpFill inheritance: paint the parent group's resolved fill in this
	// child's box. Without a parent fill there is nothing to inherit.
	if (ss.fillMode === 'group') {
		return parentGroupFill ? resolveComputedFill(parentGroupFill, element) : {};
	}

	return resolveComputedFill(ss, element);
}

/**
 * Resolves a concrete {@link ComputedFillStyle} from a {@link ShapeStyle} in the
 * context of `element` (id namespaces pattern filters; geometry drives gradient
 * `@scaled`/`@rotWithShape` corrections). Split out so grpFill children can
 * resolve the parent group's style through the identical pipeline.
 */
function resolveComputedFill(ss: ShapeStyle, element: PptxElement): ComputedFillStyle {
	// 1. Image fill — highest priority.
	const imageFillUrl = ss.fillMode === 'image' && ss.fillImageUrl ? ss.fillImageUrl : undefined;
	if (imageFillUrl) {
		const tile = ss.fillImageMode === 'tile';
		return {
			backgroundColor: 'transparent',
			backgroundImage: `url(${imageFillUrl})`,
			backgroundRepeat: tile ? 'repeat' : 'no-repeat',
			backgroundSize: tile ? 'auto' : '100% 100%',
		};
	}

	// 2. Gradient (structured, with prebuilt-string fallback).
	const geometry: GradientRenderContext = {
		rotation: element.rotation,
		width: element.width,
		height: element.height,
	};
	const gradient =
		buildGradientCss(ss, geometry) ?? (ss.fillMode === 'gradient' ? ss.fillGradient : undefined);
	if (gradient) {
		// Tile-flip applies only to structured linear gradients: buildGradientCss
		// reflects the stops, and the matching halved/repeating background-size +
		// background-repeat completes the per-tile mirror (CSS has no native
		// gradient flip). Radial paths and prebuilt-string fallbacks are excluded.
		const isStructuredLinear =
			ss.fillMode === 'gradient' &&
			(ss.fillGradientType || 'linear') === 'linear' &&
			sanitizeGradientStops(ss.fillGradientStops).length > 0;
		const tileFlip = isStructuredLinear ? getGradientTileFlipCss(ss.fillGradientFlip) : undefined;
		if (tileFlip) {
			return {
				backgroundImage: gradient,
				backgroundSize: tileFlip.backgroundSize,
				backgroundRepeat: tileFlip.backgroundRepeat,
			};
		}
		// tileRect confines the gradient to a sub-rectangle of the shape.
		const tileRect =
			ss.fillMode === 'gradient' ? getGradientTileRectCss(ss.fillGradientTileRect) : undefined;
		if (tileRect) {
			return {
				backgroundImage: gradient,
				backgroundSize: tileRect.backgroundSize,
				backgroundPosition: tileRect.backgroundPosition,
				backgroundRepeat: tileRect.backgroundRepeat,
			};
		}
		return { backgroundImage: gradient };
	}

	// 3. Pattern fill.
	const pattern = buildPatternFill(ss, element.id);
	if (pattern) {
		return {
			backgroundColor: pattern.backgroundColor,
			backgroundImage: pattern.backgroundImage,
			backgroundRepeat: 'repeat',
			backgroundSize: 'auto',
			svgFilter: pattern.svgFilter,
		};
	}

	// 4. Solid fill.
	if (ss.fillColor && ss.fillColor !== 'transparent' && ss.fillMode !== 'none') {
		return { backgroundColor: colorWithOpacity(ss.fillColor, ss.fillOpacity) };
	}

	return {};
}
