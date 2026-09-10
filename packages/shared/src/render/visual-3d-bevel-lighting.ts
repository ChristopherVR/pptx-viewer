/**
 * Real SVG lighting for `a:sp3d` bevels (framework-agnostic).
 *
 * Closes the first of the three open "3-D shapes and scenes" limitations
 * (`docs/guide/limitations.md`): bevels used to be CSS `box-shadow` layers
 * (`visual-3d.ts`'s `getBevelStyle`/`get3DBevelShadow`), a fixed set of inset
 * shadows per profile with no real lighting model, and material presets a
 * fully independent, non-interacting CSS `filter` (`visual-3d-materials.ts`).
 * This module replaces both with ONE physically-grounded SVG filter chain:
 *
 * 1. A height map is built from the shape's own alpha silhouette
 *    (`feGaussianBlur`/`feMorphology` sized by the bevel's `w`/`h`, shaped
 *    per `a:bevelT/@prst` via `visual-3d-bevel-lighting-tables`'s profile
 *    buckets - ECMA-376 20.1.10.9).
 * 2. `feDiffuseLighting` + `feSpecularLighting` light that height map with a
 *    `feDistantLight` whose azimuth reuses `visual-3d-bevel-light`'s already
 *    COM-measured cardinal-snap direction (not re-derived here) and whose
 *    elevation/sharpness comes from the `a:lightRig/@rig` table.
 * 3. Material (`a:sp3d/@prstMaterial`) sets the SAME light's response
 *    (`diffuseConstant`/`specularConstant`/`specularExponent`/`lighting-
 *    color`) instead of a disconnected `filter`, so a metal bevel's specular
 *    band is now driven by the SAME light as its diffuse shading.
 * 4. The lit diffuse/specular layers are clipped to `SourceAlpha` and blended
 *    back over `SourceGraphic` (multiply for diffuse, screen for specular),
 *    so interior fill/text is untouched and only the edge band relights.
 *
 * ## COM comparison (2026-09, real PowerPoint `Slide.Export`, 192px/in)
 *
 * Profiles `circle`/`angle`/`hardEdge`/`softRound` x directions `t`/`r`/`b`/`l`
 * x materials `matte`/`metal` (32 conditions), a 1.4in mid-grey square, a 24pt
 * `a:bevelT`, `Depth = 0`, `orthographicFront` camera (flat, axis-aligned, so
 * the same pixel offset samples every condition without a per-shape corner
 * fit). Ground truth: COM `Slide.Export` PNG, sampled 0.15in from each edge
 * (the same offset `visual-3d-bevel-light.ts`'s own campaign used) at the
 * `a:lightRig/@dir`-designated highlight edge and its opposite (shadow) edge.
 * "Before"/"after" renders: the ACTUAL `getBevelStyle` (box-shadow) and
 * `getBevelLightingFilterMarkup` (this module) output for the same 32
 * conditions, painted onto same-scale `<div>`s and sampled at the identical
 * offsets via a headless Chromium screenshot. Mean absolute error (0-255
 * brightness, both edges averaged per condition, then averaged per material
 * across all 4 profiles x 4 directions = 16 samples):
 *
 * ```
 *                         matte   metal   (mean abs error, lower is better)
 * box-shadow (before)     56.3    61.2
 * SVG lighting (after)    34.8    59.7
 * ```
 *
 * `matte` improves clearly with the ORIGINAL (uncalibrated) constants. `metal`
 * as originally tuned was roughly a WASH (61.2 -> 59.7) and hid a real
 * regression on `metal`/`circle` specifically (54.9 -> 80.1): the
 * shadow-side sample, which COM measures at a moderate ~178/255, rendered as
 * near-black (~22/255) because `feDiffuseLighting`'s `N.L<=0` clamp-to-black
 * is structural to this primitive chain, independent of `diffuseConstant`'s
 * magnitude (which only scales the LIT side). `metal` was subsequently
 * RE-CALIBRATED (`visual-3d-bevel-lighting-material.ts`'s `metal` entry,
 * verified with the same pipeline across all 4 directions): `angle`,
 * `hardEdge` and `softRound` now land at or below the box-shadow baseline in
 * every direction, but no combination of `diffuseConstant`/
 * `specularConstant`/`specularExponent`/`surfaceScaleMultiplier` could bring
 * `metal`/`circle` below its baseline in any direction (the two targets pull
 * in opposite directions as `surfaceScale` changes - see
 * `visual-3d-bevel-lighting-routing.ts`'s `isRoutedToLegacyBevelShadow` doc
 * comment), so `metal`/`circle` ROUTES to the legacy `box-shadow` model. The
 * "before" numbers are themselves large because this campaign scores
 * absolute brightness match, not just highlight/shadow SIGN agreement (which
 * is all `getBevelShadow`'s box-shadow output was previously verified
 * against). All scripts used are scratch tooling (not committed, not wired
 * into CI, same as `com-acceptance.mjs`); full tables are in the task report.
 *
 * @module render/visual-3d-bevel-lighting
 */

import type { Pptx3DScene, Pptx3DShape, PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import type { BevelFilterLayer } from './visual-3d-bevel-lighting-layer';
import { resolveLayer } from './visual-3d-bevel-lighting-layer';
import { isRoutedToLegacyBevelShadow } from './visual-3d-bevel-lighting-routing';
import type { SvgFilterDefinition } from './visual-effects';
import { escapeSvgAttr } from './visual-effects';

/** Structural subset of the bevel-relevant `Pptx3DShape` fields. */
export interface BevelLightingShapeParams {
	bevelTopType?: string;
	bevelTopWidth?: number;
	bevelTopHeight?: number;
	bevelBottomType?: string;
	bevelBottomWidth?: number;
	bevelBottomHeight?: number;
	presetMaterial?: string;
}

/** Structural subset of the bevel-relevant `Pptx3DScene` fields. */
export interface BevelLightingSceneParams {
	lightRigType?: string;
	lightRigDirection?: string;
}

/**
 * Per-side filter-parameter resolution (azimuth/elevation/blur/material)
 * lives in `visual-3d-bevel-lighting-layer.ts`; this module turns a resolved
 * `BevelFilterLayer` into `<fe*>` markup and exposes the public API.
 */

/** Emit the `<fe*>` primitive chain for one bevel side. `graphicIn` is the accumulated input so far. */
function renderLayerPrimitives(
	layer: BevelFilterLayer,
	graphicIn: string,
	isLast: boolean,
): string {
	const i = layer.index;
	const heightIn = `bevelBlur${i}`;
	const parts: string[] = [
		`<feGaussianBlur in="SourceAlpha" stdDeviation="${layer.blurStdDev.toFixed(2)}" result="${heightIn}"/>`,
	];
	let heightResult = heightIn;
	if (layer.morphologyRadius !== undefined) {
		heightResult = `bevelHeight${i}`;
		parts.push(
			`<feMorphology in="${heightIn}" operator="erode" radius="${layer.morphologyRadius.toFixed(2)}" result="${heightResult}"/>`,
		);
	}
	const light = `<feDistantLight azimuth="${layer.azimuthDeg.toFixed(1)}" elevation="${layer.elevationDeg.toFixed(1)}"/>`;
	parts.push(
		`<feDiffuseLighting in="${heightResult}" surfaceScale="${layer.surfaceScale.toFixed(2)}" diffuseConstant="${layer.diffuseConstant}" lighting-color="${layer.lightingColor}" result="diffuse${i}">${light}</feDiffuseLighting>`,
		`<feComposite in="diffuse${i}" in2="SourceAlpha" operator="in" result="diffuseClip${i}"/>`,
		`<feBlend in="${graphicIn}" in2="diffuseClip${i}" mode="multiply" result="afterDiffuse${i}"/>`,
		`<feSpecularLighting in="${heightResult}" surfaceScale="${layer.surfaceScale.toFixed(2)}" specularConstant="${layer.specularConstant.toFixed(3)}" specularExponent="${layer.specularExponent}" lighting-color="${layer.lightingColor}" result="specular${i}">${light}</feSpecularLighting>`,
		`<feComposite in="specular${i}" in2="SourceAlpha" operator="in" result="specularClip${i}"/>`,
	);
	const outAttr = isLast ? '' : ` result="afterSpecular${i}"`;
	parts.push(`<feBlend in="afterDiffuse${i}" in2="specularClip${i}" mode="screen"${outAttr}/>`);
	return parts.join('');
}

/** Stable SVG filter id for a bevel lighting filter on a given element. */
export function getBevelLightingFilterId(elementId: string): string {
	return `bevel-light-${elementId}`;
}

/**
 * Build the bevel lighting `<filter>` for a shape's `a:sp3d` bevel(s).
 * Returns `undefined` when the shape has no top/bottom bevel, OR when the
 * shape's material/profile combination is routed to the legacy `box-shadow`
 * model (see `visual-3d-bevel-lighting-routing.ts`'s `isRoutedToLegacyBevel
 * Shadow` doc comment) - the caller (`visual-3d.ts`) already falls back to
 * `getBevelStyle`/`get3DBevelShadow` whenever this returns `undefined`, so
 * routing is a no-op change to that call site: it reuses the SAME fallback
 * path a bevel-less shape takes.
 */
export function getBevelLightingFilterMarkup(
	elementId: string,
	shape3d: BevelLightingShapeParams | undefined,
	scene3d: BevelLightingSceneParams | undefined,
): SvgFilterDefinition | undefined {
	if (!shape3d) {
		return undefined;
	}
	const hasTop = Boolean(shape3d.bevelTopType && shape3d.bevelTopType !== 'none');
	const hasBottom = Boolean(shape3d.bevelBottomType && shape3d.bevelBottomType !== 'none');
	if (!hasTop && !hasBottom) {
		return undefined;
	}
	const topRouted =
		hasTop && isRoutedToLegacyBevelShadow(shape3d.presetMaterial, shape3d.bevelTopType!);
	const bottomRouted =
		hasBottom && isRoutedToLegacyBevelShadow(shape3d.presetMaterial, shape3d.bevelBottomType!);
	if (topRouted || bottomRouted) {
		// A conservative, whole-shape fallback rather than a partial mix of
		// filter + box-shadow layers on the same shape: if EITHER configured
		// bevel side is routed, the whole shape uses the legacy box-shadow
		// model for both sides, matching the simplicity of every other
		// routing decision in this codebase (one shape, one rendering model).
		return undefined;
	}

	const layers: BevelFilterLayer[] = [];
	if (hasTop && shape3d.bevelTopType) {
		layers.push(
			resolveLayer(
				layers.length,
				shape3d.bevelTopType,
				shape3d.bevelTopWidth,
				shape3d.bevelTopHeight,
				false,
				scene3d,
				shape3d.presetMaterial,
			),
		);
	}
	if (hasBottom && shape3d.bevelBottomType) {
		layers.push(
			resolveLayer(
				layers.length,
				shape3d.bevelBottomType,
				shape3d.bevelBottomWidth,
				shape3d.bevelBottomHeight,
				true,
				scene3d,
				shape3d.presetMaterial,
			),
		);
	}

	let graphicIn = 'SourceGraphic';
	const primitives = layers
		.map((layer, idx) => {
			const isLast = idx === layers.length - 1;
			const markup = renderLayerPrimitives(layer, graphicIn, isLast);
			graphicIn = `afterSpecular${layer.index}`;
			return markup;
		})
		.join('');

	const id = getBevelLightingFilterId(elementId);
	const filterMarkup = `<filter id="${escapeSvgAttr(id)}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">${primitives}</filter>`;
	return { id, cssReference: `url(#${id})`, filterMarkup };
}

/**
 * Convenience wrapper: resolve a bevel lighting filter straight from a
 * `PptxElement`, mirroring `getSoftEdgeSvgFilter`'s call shape. Returns
 * `undefined` for a non-shape element or one with no bevel.
 */
export function getBevelLightingSvgFilter(el: PptxElement): SvgFilterDefinition | undefined {
	if (!hasShapeProperties(el)) {
		return undefined;
	}
	const ss = el.shapeStyle;
	const shape3d: Pptx3DShape | undefined = ss?.shape3d;
	const scene3d: Pptx3DScene | undefined = ss?.scene3d;
	return getBevelLightingFilterMarkup(el.id, shape3d, scene3d);
}
