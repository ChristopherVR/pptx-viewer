/**
 * Per-run text-effect style composer, shared by every binding's text renderer.
 *
 * Pure, framework-agnostic. Mirrors React's per-run effect composition in
 * `packages/react/src/viewer/utils/text-segment-render.tsx`: it folds the
 * gradient/pattern fill record, the merged `text-shadow` (outer + preset), an
 * `inset box-shadow` (inner shadow), the merged `filter` chain (glow + blur +
 * soft-edge + HSL), and the alpha `opacity` into ONE neutral CSS record
 * (`Record<string, string | number>`). Each binding casts the record into its
 * own style type at the call site.
 *
 * Reflection (`a:reflection`) is NOT part of this record: unlike the other
 * effects, it cannot be expressed as CSS properties on the run's own span (a
 * mirrored copy needs its own DOM node), so it renders as a separate
 * mirrored-sibling wrapper - see `./reflection`'s `getTextReflectionWrapperStyle`,
 * called by `paragraph-run-build.ts` and carried on `BuiltRun.reflection`, the
 * same shape a shape/picture's reflection takes (`ComputedEffectStyle.reflection`).
 *
 * Returns an EMPTY record (`{}`) for a plain run that carries none of these
 * effects, so wiring it into an existing run-style builder is a strict no-op
 * for ordinary text.
 *
 * The block/body-level 3D scene wrapper (`buildTextBody3DSceneStyle`) stays in
 * {@link ./text-effects-3d}; it is applied to the text body container, not the
 * individual run.
 */
import type { TextStyle } from 'pptx-viewer-core';

import {
	buildTextBlurFilter,
	buildTextGlowFilter,
	buildTextHslFilter,
	buildTextInnerShadowCss,
	buildTextShadowCss,
	buildTextSoftEdgeFilter,
	getTextAlphaOpacity,
} from './text-effects';
import { buildTextFillCss } from './text-fill';
import type { TextCssProperties } from './text-fill';

/**
 * Combine all text-run CSS `filter` effects into a single space-joined chain:
 * glow, blur, soft edge, then HSL (in that order). Returns `undefined` when
 * no filter effect applies.
 *
 * Inner shadow (`a:innerShdw`) is NOT part of this chain: `filter:
 * drop-shadow(...)` can only ever paint OUTSIDE an element's silhouette, so
 * it is composed as a `box-shadow: inset` in {@link buildRunEffectStyle}
 * instead - see {@link buildTextInnerShadowCss}'s doc comment.
 */
export function buildTextRunFilterChain(style: TextStyle): string | undefined {
	const parts: string[] = [];
	const glow = buildTextGlowFilter(style);
	if (glow) {
		parts.push(glow);
	}
	const blur = buildTextBlurFilter(style);
	if (blur) {
		parts.push(blur);
	}
	const softEdge = buildTextSoftEdgeFilter(style);
	if (softEdge) {
		parts.push(softEdge);
	}
	const hsl = buildTextHslFilter(style);
	if (hsl) {
		parts.push(hsl);
	}
	return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Compose the per-run text-effect CSS for a run's `TextStyle` into a single
 * neutral CSS record.
 *
 * Composition (matching React's `renderSingleSegment` span style):
 *  - gradient / pattern fill via the `background-clip: text` technique
 *    (spreads the fill record's `background` / `backgroundClip` /
 *    `WebkitBackgroundClip` / `WebkitTextFillColor` keys);
 *  - `textShadow` from {@link buildTextShadowCss} (outer + preset);
 *  - `boxShadow` from {@link buildTextInnerShadowCss} (`inset`, so it renders
 *    inside the run's own line-fragment box rather than around the outside);
 *  - `filter` from {@link buildTextRunFilterChain} (glow + blur + soft-edge +
 *    HSL);
 *  - `opacity` from {@link getTextAlphaOpacity} (alpha modulation).
 *
 * Reflection is deliberately absent: see the module doc.
 *
 * Only keys for the effects that are actually present are set, so the result is
 * `{}` for a plain run.
 */
export function buildRunEffectStyle(style: TextStyle): TextCssProperties {
	const css: TextCssProperties = {};

	const fill = buildTextFillCss(style);
	if (fill) {
		Object.assign(css, fill);
	}

	const textShadow = buildTextShadowCss(style);
	if (textShadow) {
		css.textShadow = textShadow;
	}

	const innerShadow = buildTextInnerShadowCss(style);
	if (innerShadow) {
		css.boxShadow = innerShadow;
	}

	const filter = buildTextRunFilterChain(style);
	if (filter) {
		css.filter = filter;
	}

	const opacity = getTextAlphaOpacity(style);
	if (opacity !== undefined) {
		css.opacity = opacity;
	}

	return css;
}
