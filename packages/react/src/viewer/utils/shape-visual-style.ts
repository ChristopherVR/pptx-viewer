import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { getSoftEdgeFilterId } from 'pptx-viewer-shared';
/**
 * Shape visual style computation.
 *
 * Assembles a complete `React.CSSProperties` object for rendering a shape element,
 * combining fill (solid, gradient, pattern, image), stroke (dash, compound line),
 * shadow/glow effects, 3-D transforms, DAG image adjustments, reflection, and
 * clip-path / border-radius for non-rectangular shapes.
 */
import React from 'react';

import {
	normalizeHexColor,
	colorWithOpacity,
	buildCssGradientFromShapeStyle,
	buildShadowCssFromShapeStyle,
	buildInnerShadowCssFromShapeStyle,
	buildMultiLayerShadowCss,
	buildGlowBoxShadow,
	buildReflectionCss,
	buildPatternFillCss,
} from './color';
import { getEffectDagFilter } from './effect-dag-filters';
import { getResolvedShapeClipPath } from './resolved-shape-clip-path';
import { getRoundRectRadiusPx } from './shape-round-rect';
import { getShapeType } from './shape-types';
import { apply3dEffects } from './shape-visual-3d';
import {
	buildLineShadowCss,
	buildLineGlowFilter,
	mapDagBlendModeToCss,
} from './shape-visual-filters';
import {
	normalizeStrokeDashType,
	getCssBorderDashStyle,
	getCompoundLineBoxShadow,
	getCompoundLineBorderWidth,
} from './style';
import { getStrokeOnlyPresetPaths } from './vector-subpath-paint';

/**
 * Computes the full CSS style object for rendering a PPTX shape element.
 *
 * The returned style handles:
 * - **Fill**: solid colour with opacity, CSS gradients, pattern SVG backgrounds, image fills
 * - **Stroke**: border width/colour/dash style, compound line box-shadows
 * - **Shadows**: outer shadow, inner shadow, line-level shadow
 * - **Glow & soft-edge**: CSS filter drop-shadow and blur
 * - **DAG effects**: grayscale, bi-level, brightness/contrast, hue/saturation, tint, duotone
 * - **3-D**: perspective transforms, extrusion depth, bevel highlights
 * - **Reflection**: Chromium `-webkit-box-reflect`
 * - **Shape geometry**: clip-path polygons, border-radius for ellipses and round-rects
 *
 * @param element - The PPTX element to style.
 * @param hasFill - Whether the shape has an active fill.
 * @param fillColor - Resolved fill colour (hex).
 * @param strokeWidth - Stroke width in pixels.
 * @param strokeColor - Resolved stroke colour (hex).
 * @param animatesFill - When an active `p:animClr` targets the shape fill, drop
 *   the static container fill so the wrapper's animated `background-color` /
 *   `fill` keyframes own the paint. Absent/false keeps the static fill.
 * @param animatesStroke - As `animatesFill`, but for the container stroke
 *   (`border-color`).
 * @returns A `React.CSSProperties` object ready to apply to the shape container.
 */
export function getShapeVisualStyle(
	element: PptxElement,
	hasFill: boolean,
	fillColor: string,
	strokeWidth: number,
	strokeColor: string,
	animatesFill?: boolean,
	animatesStroke?: boolean,
): React.CSSProperties {
	if (!hasShapeProperties(element)) {
		return {};
	}
	const normalizedShapeType = getShapeType(element.shapeType);
	const clipPath = getResolvedShapeClipPath(element);
	// Custom-geometry shapes (freeforms) are painted by `renderVectorShape` as an
	// SVG `<path>` that already carries the fill and stroke. Painting the fill a
	// second time as a `backgroundColor`/`backgroundImage` on this rectangular
	// container floods the shape's whole bounding box, so a thin balloon crescent
	// reads as a solid rectangle. Suppress the container-level fill and border for
	// these shapes and let the SVG path be the only paint. (Presets keep their
	// container fill because a `clipPath` constrains it to the shape outline.)
	const rendersCustomVectorPath =
		(element.type === 'shape' || element.type === 'image' || element.type === 'picture') &&
		Boolean(element.pathData) &&
		typeof element.pathWidth === 'number' &&
		element.pathWidth > 0 &&
		typeof element.pathHeight === 'number' &&
		element.pathHeight > 0;
	// Open, stroke-only presets (e.g. `arc`) are painted by `renderVectorShape`
	// as a stroked SVG outline. Suppress the container fill/border (and the
	// wedge clip-path) so the shape reads as an outline, not a filled region.
	const rendersStrokeOnlyPreset = Boolean(getStrokeOnlyPresetPaths(element));
	const fillOpacity = element.shapeStyle?.fillOpacity;
	const strokeOpacity = element.shapeStyle?.strokeOpacity;
	const strokeDash = normalizeStrokeDashType(element.shapeStyle?.strokeDash);
	const fillGradient =
		buildCssGradientFromShapeStyle(element.shapeStyle) || element.shapeStyle?.fillGradient;
	const shadowCss = buildShadowCssFromShapeStyle(element.shapeStyle);
	const innerShadowCss = buildInnerShadowCssFromShapeStyle(element.shapeStyle);
	const resolvedFillColor = colorWithOpacity(fillColor, fillOpacity);
	const resolvedStrokeColor = colorWithOpacity(strokeColor, strokeOpacity);
	const ss = element.shapeStyle;
	// A DAG fill-overlay tint layer is painted separately by `ShapeEffectOverlay`
	// when a colour is parsed; in that case the whole-element blend proxy below is
	// suppressed so the overlay layer owns the blend (mirrors shared
	// `getComputedEffectStyle`).
	const hasFillOverlayColor = Boolean(
		ss?.dagFillOverlayColor && ss.dagFillOverlayColor !== 'transparent',
	);

	// Combine outer, inner, and line shadow into a single boxShadow value.
	// Multi-layer shadows (from `shadows` array) take precedence over the
	// single-shadow properties for outer shadows when present.
	const combinedShadowParts: string[] = [];
	const multiLayerShadow = buildMultiLayerShadowCss(element.shapeStyle);
	if (multiLayerShadow) {
		combinedShadowParts.push(multiLayerShadow);
	} else if (shadowCss) {
		combinedShadowParts.push(shadowCss);
	}
	if (innerShadowCss) {
		combinedShadowParts.push(innerShadowCss);
	}
	// High-fidelity glow via layered box-shadows (supplements the filter-based glow)
	const glowBoxShadow = buildGlowBoxShadow(ss?.glowColor, ss?.glowRadius, ss?.glowOpacity);
	if (glowBoxShadow) {
		combinedShadowParts.push(glowBoxShadow);
	}
	// Line-level shadow (from a:ln/a:effectLst/a:outerShdw)
	const lineShadow = buildLineShadowCss(element);
	if (lineShadow) {
		combinedShadowParts.push(lineShadow);
	}
	// Compound line box-shadow (for dbl, thickThin, thinThick, tri)
	const compoundLineShadow = getCompoundLineBoxShadow(
		element.shapeStyle?.compoundLine,
		strokeWidth,
		resolvedStrokeColor,
	);
	if (compoundLineShadow) {
		combinedShadowParts.push(compoundLineShadow);
	}
	const combinedBoxShadow =
		combinedShadowParts.length > 0 ? combinedShadowParts.join(', ') : undefined;

	// Build CSS filter for glow and soft-edge effects
	const filterParts: string[] = [];
	if (ss?.glowColor && ss.glowColor !== 'transparent' && ss.glowRadius) {
		const glowOpacity = typeof ss.glowOpacity === 'number' ? ss.glowOpacity : 0.75;
		const glowRad = Math.round(Math.max(0, ss.glowRadius));
		const glowCol = colorWithOpacity(normalizeHexColor(ss.glowColor, '#ffff00'), glowOpacity);
		filterParts.push(`drop-shadow(0 0 ${glowRad}px ${glowCol})`);
	}
	// Soft edges: feather only the alpha edge via an SVG `<filter>` (injected by
	// `ShapeEffectOverlay`) rather than a whole-element `blur()` that would wash
	// out the interior fill/text. `getSoftEdgeSvgFilter` builds the matching
	// `soft-edge-<id>` filter; here we only reference it.
	if (typeof ss?.softEdgeRadius === 'number' && ss.softEdgeRadius > 0) {
		filterParts.push(`url(#${getSoftEdgeFilterId(element.id)})`);
	}
	// Blur effect (a:blur)
	if (typeof ss?.blurRadius === 'number' && ss.blurRadius > 0) {
		filterParts.push(`blur(${Math.round(ss.blurRadius)}px)`);
	}
	// Line-level glow (from a:ln/a:effectLst/a:glow)
	const lineGlowCss = buildLineGlowFilter(element);
	if (lineGlowCss) {
		filterParts.push(lineGlowCss);
	}

	// ── DAG-specific CSS filters (centralised in effect-dag-filters.ts) ──
	const dagFilter = getEffectDagFilter(ss, element.id);
	if (dagFilter) {
		filterParts.push(dagFilter);
	}

	// Line join → SVG lineJoin (applied by the SVG path renderer; also carried
	// here for shapes that stroke via SVG). `miter` (with a:miter/@lim) is mapped
	// alongside round/bevel instead of being dropped to the default.
	const lineJoinCss: React.CSSProperties['strokeLinejoin'] =
		ss?.lineJoin === 'round'
			? 'round'
			: ss?.lineJoin === 'bevel'
				? 'bevel'
				: ss?.lineJoin === 'miter'
					? 'miter'
					: undefined;
	// a:miter/@lim is stored in 1000ths of a percent (800000 = 8.0); SVG's
	// stroke-miterlimit is a plain ratio >= 1.
	const miterLimitCss =
		ss?.lineJoin === 'miter' && typeof ss?.miterLimit === 'number'
			? Math.max(ss.miterLimit / 100000, 1)
			: undefined;

	// Pattern fill (SVG-based CSS background)
	const patternFill = buildPatternFillCss(element.shapeStyle);

	// Image fill (fillMode === "image")
	const imageFillUrl = ss?.fillMode === 'image' && ss.fillImageUrl ? ss.fillImageUrl : undefined;
	const imageFillMode = ss?.fillImageMode || 'stretch';

	// ── Reflection effect via -webkit-box-reflect (Chromium) ──
	let reflectCss: string | undefined;
	if (ss) {
		const hasReflection =
			(typeof ss.reflectionStartOpacity === 'number' && ss.reflectionStartOpacity > 0) ||
			(typeof ss.reflectionDistance === 'number' && ss.reflectionDistance > 0) ||
			(typeof ss.reflectionBlurRadius === 'number' && ss.reflectionBlurRadius > 0);
		if (hasReflection) {
			const distance = ss.reflectionDistance ?? 0;
			const startOpacity =
				typeof ss.reflectionStartOpacity === 'number' ? ss.reflectionStartOpacity : 0.5;
			const endOpacity = typeof ss.reflectionEndOpacity === 'number' ? ss.reflectionEndOpacity : 0;
			// Fade length derived from reflectionEndPosition (fraction of shape height).
			// If not set, default to 100px as a reasonable fallback.
			const fadeLength =
				typeof ss.reflectionEndPosition === 'number'
					? Math.round(ss.reflectionEndPosition * Math.max(element.height, 1))
					: 100;
			const blurRadius = typeof ss.reflectionBlurRadius === 'number' ? ss.reflectionBlurRadius : 0;
			reflectCss = buildReflectionCss(distance, startOpacity, endOpacity, fadeLength, blurRadius);
		}
	}

	const base: React.CSSProperties = {
		backgroundColor: imageFillUrl
			? 'transparent'
			: patternFill
				? patternFill.backgroundColor
				: hasFill
					? resolvedFillColor
					: 'transparent',
		backgroundImage: imageFillUrl
			? `url(${imageFillUrl})`
			: patternFill
				? patternFill.backgroundImage
				: hasFill && fillGradient
					? fillGradient
					: undefined,
		backgroundRepeat: imageFillUrl
			? imageFillMode === 'tile'
				? 'repeat'
				: 'no-repeat'
			: patternFill
				? 'repeat'
				: undefined,
		backgroundSize: imageFillUrl
			? imageFillMode === 'tile'
				? 'auto'
				: '100% 100%'
			: patternFill
				? 'auto'
				: undefined,
		backgroundPosition: imageFillUrl ? 'center' : undefined,
		boxShadow: combinedBoxShadow,
		WebkitBoxReflect: reflectCss,
		filter: filterParts.length > 0 ? filterParts.join(' ') : undefined,
		opacity:
			typeof ss?.dagAlphaModFix === 'number'
				? Math.max(0, Math.min(1, ss.dagAlphaModFix / 100))
				: undefined,
		// Only proxy the DAG blend onto the whole element for the legacy
		// blend-only case (no overlay colour parsed). When a fill-overlay colour
		// is present, `ShapeEffectOverlay` paints a separate blended tint layer so
		// the colour is actually rendered (and text/children are not tinted).
		mixBlendMode: hasFillOverlayColor ? undefined : mapDagBlendModeToCss(ss?.dagFillOverlayBlend),
		borderWidth:
			strokeWidth > 0 ? getCompoundLineBorderWidth(ss?.compoundLine, strokeWidth) : undefined,
		borderColor: strokeWidth > 0 ? resolvedStrokeColor : undefined,
		borderStyle: strokeWidth > 0 ? getCssBorderDashStyle(strokeDash, ss?.compoundLine) : undefined,
		strokeLinejoin: lineJoinCss,
		strokeMiterlimit: miterLimitCss,
		strokeLinecap:
			ss?.lineCap === 'rnd'
				? 'round'
				: ss?.lineCap === 'sq'
					? 'square'
					: ss?.lineCap === 'flat'
						? 'butt'
						: undefined,
	};

	// ── 3D effects (perspective + rotation + extrusion/bevel) ──
	// Pass the resolved fill colour so extrusion/contour default to it when no
	// explicit extrusion colour is set.
	apply3dEffects(base, ss?.scene3d, ss?.shape3d, ss?.fillColor ?? fillColor);

	// The SVG `<path>` owns the fill/stroke for freeform geometry; keep effects
	// (shadow, glow, opacity, blend) on the container but drop the rectangular
	// fill and border that would otherwise flood the bounding box.
	if (rendersCustomVectorPath || rendersStrokeOnlyPreset) {
		base.backgroundColor = 'transparent';
		base.backgroundImage = undefined;
		base.borderWidth = undefined;
		base.borderColor = undefined;
		base.borderStyle = undefined;
	}

	// A `p:animClr` colour animation drives the wrapper's `fill` / `stroke` (which
	// cascade into the SVG vector via `fill: inherit`) plus `background-color` /
	// `border-color` (for HTML-box shapes). Drop the conflicting static container
	// paint so those keyframes own it cleanly. Guarded by the flag, so a shape
	// without an active fill/stroke animation keeps its exact static paint.
	if (animatesFill) {
		base.backgroundColor = undefined;
		base.backgroundImage = undefined;
	}
	if (animatesStroke) {
		base.borderColor = undefined;
	}

	if (element.type === 'connector' || normalizedShapeType === 'connector') {
		return {
			backgroundColor: 'transparent',
			borderWidth: 0,
			borderStyle: 'none',
		};
	}

	if (normalizedShapeType === 'roundRect') {
		const radiusPx = getRoundRectRadiusPx(element);
		if (radiusPx <= 0.01) {
			return base;
		}
		return {
			...base,
			borderRadius: radiusPx,
		};
	}

	if (normalizedShapeType === 'ellipse') {
		return {
			...base,
			borderRadius: '9999px',
		};
	}

	if (clipPath && !rendersStrokeOnlyPreset) {
		return {
			...base,
			clipPath,
		};
	}

	if (normalizedShapeType === 'line') {
		return {
			...base,
			backgroundColor: 'transparent',
			borderWidth: 0,
			borderTopWidth: Math.max(strokeWidth, 2),
			borderTopColor: resolvedStrokeColor,
			borderTopStyle: getCssBorderDashStyle(strokeDash) as React.CSSProperties['borderTopStyle'],
		};
	}

	if (normalizedShapeType === 'cylinder') {
		return {
			...base,
			borderRadius: '48% / 12%',
		};
	}

	return base;
}
