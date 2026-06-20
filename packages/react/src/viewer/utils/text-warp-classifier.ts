/**
 * Thin adapter over `pptx-viewer-shared`'s `text-warp` module.
 *
 * The OOXML text-warp preset classifier and its envelope/simple CSS-transform
 * generators already live in `pptx-viewer-shared` (`render/text-warp`, exported
 * as `classifyTextWarp` / `getEnvelopeCssTransform` / `getSimpleCssTransform` /
 * `ALL_CLASSIFIED_PRESETS`). This module re-exports them under the historical
 * React names. The shared generators return `undefined` for a preset outside
 * their family; the React surface has always returned an empty object, so the
 * generators are wrapped to preserve that `{}`-for-unknown contract (the warp
 * renderers spread the result into a React `CSSProperties`).
 */
import {
	classifyTextWarp,
	getEnvelopeCssTransform as sharedGetEnvelopeCssTransform,
	getSimpleCssTransform as sharedGetSimpleCssTransform,
} from 'pptx-viewer-shared';
import type { WarpCategory, WarpCssTransform } from 'pptx-viewer-shared';

export type { WarpCategory };
export { ALL_CLASSIFIED_PRESETS } from 'pptx-viewer-shared';

/** Classify a warp preset into a rendering strategy category. */
export function getWarpCategory(preset: string | undefined): WarpCategory {
	return classifyTextWarp(preset);
}

/** Envelope-family CSS transform, or `{}` for a non-envelope preset. */
export function getEnvelopeCssTransform(
	preset: string,
	adj1?: number,
	adj2?: number,
): WarpCssTransform | Record<string, never> {
	return sharedGetEnvelopeCssTransform(preset, adj1, adj2) ?? {};
}

/** Simple-family CSS transform, or `{}` for a non-simple preset. */
export function getSimpleCssTransform(
	preset: string,
	adj1?: number,
): WarpCssTransform | Record<string, never> {
	return sharedGetSimpleCssTransform(preset, adj1) ?? {};
}
