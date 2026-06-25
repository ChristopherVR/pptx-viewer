/**
 * Per-run text-effect style composer, shared by every binding's text renderer.
 *
 * Pure, framework-agnostic. Mirrors React's per-run effect composition in
 * `packages/react/src/viewer/utils/text-segment-render.tsx`: it folds the
 * gradient/pattern fill record, the merged `text-shadow` (outer + preset + 3D
 * extrusion/bevel), the merged `filter` chain (glow + inner-shadow + blur +
 * HSL), the alpha `opacity`, and the `-webkit-box-reflect` reflection into ONE
 * neutral CSS record (`Record<string, string | number>`). Each binding casts
 * the record into its own style type at the call site.
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
	buildTextReflectionCss,
	buildTextShadowCss,
	getTextAlphaOpacity,
} from './text-effects';
import { buildTextFillCss } from './text-fill';
import type { TextCssProperties } from './text-fill';

/**
 * Combine all text-run CSS `filter` effects into a single space-joined chain,
 * mirroring React's `buildTextRunFilterChain`: glow, inner-shadow, blur, then
 * HSL (in that order). Returns `undefined` when no filter effect applies.
 */
export function buildTextRunFilterChain(style: TextStyle): string | undefined {
	const parts: string[] = [];
	const glow = buildTextGlowFilter(style);
	if (glow) {
		parts.push(glow);
	}
	const innerShadow = buildTextInnerShadowCss(style);
	if (innerShadow) {
		parts.push(innerShadow);
	}
	const blur = buildTextBlurFilter(style);
	if (blur) {
		parts.push(blur);
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
 *  - `textShadow` from {@link buildTextShadowCss} (outer + preset + 3D layers);
 *  - `filter` from {@link buildTextRunFilterChain} (glow + inner-shadow + blur
 *    + HSL);
 *  - `opacity` from {@link getTextAlphaOpacity} (alpha modulation);
 *  - `WebkitBoxReflect` from {@link buildTextReflectionCss} (reflection).
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

	const filter = buildTextRunFilterChain(style);
	if (filter) {
		css.filter = filter;
	}

	const opacity = getTextAlphaOpacity(style);
	if (opacity !== undefined) {
		css.opacity = opacity;
	}

	const reflection = buildTextReflectionCss(style);
	if (reflection) {
		css.WebkitBoxReflect = reflection;
	}

	return css;
}
