/**
 * Duotone SVG `<filter>` descriptor for Angular templates.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/effect-dag-filters.ts  (getDuotoneSvgFilterMarkup, hexToRgbUnit)
 *   packages/angular/src/viewer/visual-effects.ts           (getDuotoneFilterId, getDuotoneSvgFilter)
 *
 * The React package serialises the SVG filter as a raw HTML string.  The Angular
 * package instead returns a **structured descriptor** (`DuotoneFilterDef`) that
 * the template can render declaratively with `@for` / `@switch`, matching the
 * `SvgPrimitive` pattern used by `chart-renderer-helpers.ts`.
 *
 * @module viewer/duotone-filter
 */

import type { PptxElement } from 'pptx-viewer-core';

// ── Colour helper ─────────────────────────────────────────────────────────────

/**
 * Normalised 0–1 RGB components parsed from a 6-digit hex colour string.
 * Invalid or missing channels default to `0`.
 */
interface RgbUnit {
	r: number;
	g: number;
	b: number;
}

/**
 * Parse a 6-digit hex colour (`#RRGGBB` or `RRGGBB`) to normalised 0–1 RGB.
 * Any channel that fails to parse produces `0`.
 */
function hexToRgbUnit(hex: string): RgbUnit {
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

// ── Filter primitive descriptors ──────────────────────────────────────────────

/**
 * Descriptor for an SVG `<feColorMatrix type="matrix">` primitive.
 * The `values` string is a space-separated 4×5 colour-transformation matrix.
 */
export interface FeColorMatrixPrimitive {
	kind: 'feColorMatrix';
	/** Space-separated 4×5 matrix values (`type="matrix"`). */
	values: string;
	/** `color-interpolation-filters` attribute (always `"sRGB"`). */
	colorInterpolationFilters: 'sRGB';
}

/**
 * One channel entry for an `<feComponentTransfer>` child function element.
 * Maps to `<feFuncR>`, `<feFuncG>`, or `<feFuncB>` with `type="linear"`.
 */
export interface FeComponentTransferChannel {
	/** Which SVG component-transfer channel this entry corresponds to. */
	channel: 'R' | 'G' | 'B';
	/** The `slope` attribute value (highlight − shadow for that channel). */
	slope: number;
	/** The `intercept` attribute value (shadow colour for that channel, 0–1). */
	intercept: number;
}

/**
 * Descriptor for an SVG `<feComponentTransfer>` primitive, containing one
 * linear ramp per RGB channel.
 *
 * The template should render:
 * ```html
 * <feComponentTransfer>
 *   <feFuncR type="linear" [attr.slope]="ch.slope" [attr.intercept]="ch.intercept" />
 *   …
 * </feComponentTransfer>
 * ```
 */
export interface FeComponentTransferPrimitive {
	kind: 'feComponentTransfer';
	/** Exactly three entries — R, G, B in that order. */
	channels: [FeComponentTransferChannel, FeComponentTransferChannel, FeComponentTransferChannel];
}

/**
 * Discriminated union of every SVG filter primitive this module can produce.
 * Add further variants (`feFlood`, `feBlend`, …) as needed in future ports.
 */
export type DuotoneFilterPrimitive = FeColorMatrixPrimitive | FeComponentTransferPrimitive;

// ── Top-level descriptor ──────────────────────────────────────────────────────

/**
 * A fully structured descriptor for a duotone SVG `<filter>` definition.
 *
 * ### Integration guide (for the orchestrator)
 *
 * **Step 1 – Render the `<defs>` block.**
 * Inside the element's host component (or a shared slide-level `<svg>`), emit
 * a hidden `<svg>` containing one `<filter>` per element that has a duotone:
 *
 * ```html
 * @if (duotone) {
 *   <svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">
 *     <defs>
 *       <filter [id]="duotone.id" color-interpolation-filters="sRGB">
 *         @for (p of duotone.primitives; track p.kind) {
 *           @switch (p.kind) {
 *             @case ('feColorMatrix') {
 *               <feColorMatrix type="matrix" [attr.values]="p.values" />
 *             }
 *             @case ('feComponentTransfer') {
 *               <feComponentTransfer>
 *                 @for (ch of p.channels; track ch.channel) {
 *                   @switch (ch.channel) {
 *                     @case ('R') { <feFuncR type="linear" [attr.slope]="ch.slope" [attr.intercept]="ch.intercept" /> }
 *                     @case ('G') { <feFuncG type="linear" [attr.slope]="ch.slope" [attr.intercept]="ch.intercept" /> }
 *                     @case ('B') { <feFuncB type="linear" [attr.slope]="ch.slope" [attr.intercept]="ch.intercept" /> }
 *                   }
 *                 }
 *               </feComponentTransfer>
 *             }
 *           }
 *         }
 *       </filter>
 *     </defs>
 *   </svg>
 * }
 * ```
 *
 * **Step 2 – Apply the CSS `filter` reference.**
 * In `element-style.ts` (or the image host component), when `duotone` is
 * defined, append `duotone.cssFilter` to the element's `filter` CSS property
 * *instead of* stripping the `url(#…)` reference as `getShapeFillStrokeStyle`
 * currently does.  Example integration in `getShapeFillStrokeStyle`:
 *
 * ```ts
 * const duotone = buildDuotoneFilter(el);
 * const dagFilter = getEffectFilterCss(el.shapeStyle, el.id);
 * if (dagFilter) {
 *   // duotone url(#…) is now meaningful — keep it
 *   style['filter'] = dagFilter;
 * } else if (duotone) {
 *   style['filter'] = duotone.cssFilter;
 * }
 * // Expose duotone so the template can render the <defs> block:
 * return { style, duotone };
 * ```
 */
export interface DuotoneFilterDef {
	/**
	 * Stable SVG `filter` element `id`, derived deterministically from the
	 * element id.  Format: `dag-duotone-<elementId>`.
	 */
	id: string;

	/**
	 * Ordered list of SVG filter primitives that make up the `<filter>` body.
	 * Always contains exactly two entries:
	 *   0. `feColorMatrix`        — BT.709 luminance-to-grayscale matrix
	 *   1. `feComponentTransfer`  — per-channel linear ramp (shadow → highlight)
	 */
	primitives: [FeColorMatrixPrimitive, FeComponentTransferPrimitive];

	/**
	 * Ready-to-use CSS `filter` function string.
	 * Example: `"url(#dag-duotone-shape1)"`.
	 * Append this to the element's existing `filter` CSS value.
	 */
	cssFilter: string;

	/**
	 * The raw shadow colour (`color1`) in 6-digit hex, preserved for tests and
	 * debugging without re-parsing the matrix.
	 */
	shadowHex: string;

	/**
	 * The raw highlight colour (`color2`) in 6-digit hex, preserved for tests and
	 * debugging without re-parsing the matrix.
	 */
	highlightHex: string;
}

// ── BT.709 grayscale matrix (matches React implementation) ────────────────────

/**
 * BT.709 luminance weights as a 4×5 SVG `feColorMatrix` values string.
 *
 * The same weights are used by both `effect-dag-filters.ts` (React) and
 * `visual-effects.ts` (Angular `getDuotoneSvgFilter`).  The fourth row
 * (alpha) passes through unchanged.
 *
 * ```
 * R' = 0.2126·R + 0.7152·G + 0.0722·B
 * G' = 0.2126·R + 0.7152·G + 0.0722·B
 * B' = 0.2126·R + 0.7152·G + 0.0722·B
 * A' = A  (unchanged)
 * ```
 */
const GRAYSCALE_MATRIX_VALUES: string = [
	0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0,
	1, 0,
].join(' ');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a stable SVG filter `id` for a duotone effect on the given element.
 *
 * Matches the format used by `getDuotoneFilterId` in `visual-effects.ts` so
 * that the `url(#…)` reference emitted by `getEffectDagCssFilter` points to
 * the correct `<filter>` definition.
 *
 * @param elementId - The element's `id` from `PptxElement.id`.
 * @returns A CSS-identifier-safe string (no spaces, starts with a letter).
 */
export function buildDuotoneFilterId(elementId: string): string {
	return `dag-duotone-${elementId}`;
}

/**
 * Derive a fully structured duotone `<filter>` descriptor from a
 * `PptxElement`.
 *
 * The function reads `element.shapeStyle.dagDuotone` — the parsed
 * `<a:duotone>` colour pair populated by the core parser.  Returns
 * `undefined` when the element carries no duotone effect.
 *
 * ### Colour math
 * 1. Convert to grayscale using BT.709 luminance weights (feColorMatrix).
 * 2. Map grayscale 0 → `color1` (shadow) and 1 → `color2` (highlight) via
 *    per-channel linear ramps (feComponentTransfer / feFuncR|G|B):
 *    ```
 *    slope     = highlight_channel − shadow_channel
 *    intercept = shadow_channel
 *    ```
 *    At luminance 0: `output = intercept = shadow`.
 *    At luminance 1: `output = slope + intercept = highlight`.
 *
 * @param element - Any `PptxElement`; elements without `shapeStyle` or
 *   `dagDuotone` return `undefined`.
 * @returns A {@link DuotoneFilterDef} or `undefined`.
 */
export function buildDuotoneFilter(element: PptxElement): DuotoneFilterDef | undefined {
	const shapeStyle = 'shapeStyle' in element ? element.shapeStyle : undefined;
	const duotone = shapeStyle?.dagDuotone;
	if (!duotone) {
		return undefined;
	}

	const id = buildDuotoneFilterId(element.id);
	const shadow = hexToRgbUnit(duotone.color1);
	const highlight = hexToRgbUnit(duotone.color2);

	const grayscalePrimitive: FeColorMatrixPrimitive = {
		kind: 'feColorMatrix',
		values: GRAYSCALE_MATRIX_VALUES,
		colorInterpolationFilters: 'sRGB',
	};

	const transferPrimitive: FeComponentTransferPrimitive = {
		kind: 'feComponentTransfer',
		channels: [
			{ channel: 'R', slope: highlight.r - shadow.r, intercept: shadow.r },
			{ channel: 'G', slope: highlight.g - shadow.g, intercept: shadow.g },
			{ channel: 'B', slope: highlight.b - shadow.b, intercept: shadow.b },
		],
	};

	return {
		id,
		primitives: [grayscalePrimitive, transferPrimitive],
		cssFilter: `url(#${id})`,
		shadowHex: duotone.color1,
		highlightHex: duotone.color2,
	};
}
