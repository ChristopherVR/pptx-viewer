/**
 * Shape visual style computation.
 *
 * Assembles a complete `React.CSSProperties` object for rendering a shape element,
 * combining fill (solid, gradient, pattern, image), stroke (dash, compound line),
 * shadow/glow effects, 3-D transforms, DAG image adjustments, reflection, and
 * clip-path / border-radius for non-rectangular shapes.
 */
import React from "react";

import type { PptxElement } from "pptx-viewer-core";
import { hasShapeProperties } from "pptx-viewer-core";
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
} from "./color";
import {
  normalizeStrokeDashType,
  getCssBorderDashStyle,
  getCompoundLineBoxShadow,
  getCompoundLineBorderWidth,
} from "./style";
import { getShapeType, getShapeClipPath } from "./shape-types";
import {
  buildLineShadowCss,
  buildLineGlowFilter,
} from "./shape-visual-filters";
import {
  getEffectDagFilter,
  getEffectDagOpacity,
  getEffectDagBlendMode,
} from "./effect-dag-filters";
import { apply3dEffects } from "./shape-visual-3d";
import { getRoundRectRadiusPx } from "./shape-round-rect";

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
 * @returns A `React.CSSProperties` object ready to apply to the shape container.
 */
export function getShapeVisualStyle(
  element: PptxElement,
  hasFill: boolean,
  fillColor: string,
  strokeWidth: number,
  strokeColor: string,
): React.CSSProperties {
  if (!hasShapeProperties(element)) return {};
  const normalizedShapeType = getShapeType(element.shapeType);
  const shapeType = element.shapeType || normalizedShapeType;
  const clipPath = getShapeClipPath(shapeType);
  const fillOpacity = element.shapeStyle?.fillOpacity;
  const strokeOpacity = element.shapeStyle?.strokeOpacity;
  const strokeDash = normalizeStrokeDashType(element.shapeStyle?.strokeDash);
  const fillGradient =
    buildCssGradientFromShapeStyle(element.shapeStyle) ||
    element.shapeStyle?.fillGradient;
  const shadowCss = buildShadowCssFromShapeStyle(element.shapeStyle);
  const innerShadowCss = buildInnerShadowCssFromShapeStyle(element.shapeStyle);
  const resolvedFillColor = colorWithOpacity(fillColor, fillOpacity);
  const resolvedStrokeColor = colorWithOpacity(strokeColor, strokeOpacity);

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
  if (innerShadowCss) combinedShadowParts.push(innerShadowCss);
  // High-fidelity glow via layered box-shadows (supplements the filter-based glow)
  const glowBoxShadow = buildGlowBoxShadow(
    ss?.glowColor,
    ss?.glowRadius,
    ss?.glowOpacity,
  );
  if (glowBoxShadow) combinedShadowParts.push(glowBoxShadow);
  // Line-level shadow (from a:ln/a:effectLst/a:outerShdw)
  const lineShadow = buildLineShadowCss(element);
  if (lineShadow) combinedShadowParts.push(lineShadow);
  // Compound line box-shadow (for dbl, thickThin, thinThick, tri)
  const compoundLineShadow = getCompoundLineBoxShadow(
    element.shapeStyle?.compoundLine,
    strokeWidth,
    resolvedStrokeColor,
  );
  if (compoundLineShadow) combinedShadowParts.push(compoundLineShadow);
  const combinedBoxShadow =
    combinedShadowParts.length > 0 ? combinedShadowParts.join(", ") : undefined;

  // Build CSS filter for glow and soft-edge effects
  const filterParts: string[] = [];
  const ss = element.shapeStyle;
  if (ss?.glowColor && ss.glowColor !== "transparent" && ss.glowRadius) {
    const glowOpacity =
      typeof ss.glowOpacity === "number" ? ss.glowOpacity : 0.75;
    const glowRad = Math.round(Math.max(0, ss.glowRadius));
    const glowCol = colorWithOpacity(
      normalizeHexColor(ss.glowColor, "#ffff00"),
      glowOpacity,
    );
    filterParts.push(`drop-shadow(0 0 ${glowRad}px ${glowCol})`);
  }
  if (typeof ss?.softEdgeRadius === "number" && ss.softEdgeRadius > 0) {
    filterParts.push(`blur(${Math.round(ss.softEdgeRadius)}px)`);
  }
  // Blur effect (a:blur)
  if (typeof ss?.blurRadius === "number" && ss.blurRadius > 0) {
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

  // Line join → CSS lineJoin (only relevant for SVG; stored for serialisation)
  const lineJoinCss =
    ss?.lineJoin === "round"
      ? "round"
      : ss?.lineJoin === "bevel"
        ? "bevel"
        : undefined;

  // Pattern fill (SVG-based CSS background)
  const patternFill = buildPatternFillCss(element.shapeStyle);

  // Image fill (fillMode === "image")
  const imageFillUrl =
    ss?.fillMode === "image" && ss.fillImageUrl ? ss.fillImageUrl : undefined;
  const imageFillMode = ss?.fillImageMode || "stretch";

  // ── Reflection effect via -webkit-box-reflect (Chromium/Electron) ──
  let reflectCss: string | undefined;
  if (ss) {
    const hasReflection =
      (typeof ss.reflectionStartOpacity === "number" &&
        ss.reflectionStartOpacity > 0) ||
      (typeof ss.reflectionDistance === "number" &&
        ss.reflectionDistance > 0) ||
      (typeof ss.reflectionBlurRadius === "number" &&
        ss.reflectionBlurRadius > 0);
    if (hasReflection) {
      const distance = ss.reflectionDistance ?? 0;
      const startOpacity =
        typeof ss.reflectionStartOpacity === "number"
          ? ss.reflectionStartOpacity
          : 0.5;
      const endOpacity =
        typeof ss.reflectionEndOpacity === "number"
          ? ss.reflectionEndOpacity
          : 0;
      // Fade length derived from reflectionEndPosition (fraction of shape height).
      // If not set, default to 100px as a reasonable fallback.
      const fadeLength =
        typeof ss.reflectionEndPosition === "number"
          ? Math.round(ss.reflectionEndPosition * Math.max(element.height, 1))
          : 100;
      const blurRadius =
        typeof ss.reflectionBlurRadius === "number"
          ? ss.reflectionBlurRadius
          : 0;
      reflectCss = buildReflectionCss(
        distance,
        startOpacity,
        endOpacity,
        fadeLength,
        blurRadius,
      );
    }
  }

  const base: React.CSSProperties = {
    backgroundColor: imageFillUrl
      ? "transparent"
      : patternFill
        ? patternFill.backgroundColor
        : hasFill
          ? resolvedFillColor
          : "transparent",
    backgroundImage: imageFillUrl
      ? `url(${imageFillUrl})`
      : patternFill
        ? patternFill.backgroundImage
        : hasFill && fillGradient
          ? fillGradient
          : undefined,
    backgroundRepeat: imageFillUrl
      ? imageFillMode === "tile"
        ? "repeat"
        : "no-repeat"
      : patternFill
        ? "repeat"
        : undefined,
    backgroundSize: imageFillUrl
      ? imageFillMode === "tile"
        ? "auto"
        : "100% 100%"
      : patternFill
        ? "auto"
        : undefined,
    backgroundPosition: imageFillUrl ? "center" : undefined,
    boxShadow: combinedBoxShadow,
    WebkitBoxReflect: reflectCss,
    filter: filterParts.length > 0 ? filterParts.join(" ") : undefined,
    opacity:
      typeof ss?.dagAlphaModFix === "number"
        ? Math.max(0, Math.min(1, ss.dagAlphaModFix / 100))
        : undefined,
    mixBlendMode: mapDagBlendModeToCss(ss?.dagFillOverlayBlend),
    borderWidth: strokeWidth > 0
      ? getCompoundLineBorderWidth(ss?.compoundLine, strokeWidth)
      : undefined,
    borderColor: strokeWidth > 0 ? resolvedStrokeColor : undefined,
    borderStyle:
      strokeWidth > 0
        ? getCssBorderDashStyle(strokeDash, ss?.compoundLine)
        : undefined,
    strokeLinejoin: lineJoinCss as React.CSSProperties["strokeLinejoin"],
    strokeLinecap:
      ss?.lineCap === "rnd"
        ? "round"
        : ss?.lineCap === "sq"
          ? "square"
          : undefined,
  };

  // ── 3D effects (perspective + rotation + extrusion/bevel) ──
  apply3dEffects(base, ss?.scene3d, ss?.shape3d);

  if (element.type === "connector" || normalizedShapeType === "connector") {
    return {
      backgroundColor: "transparent",
      borderWidth: 0,
      borderStyle: "none",
    };
  }

  if (normalizedShapeType === "roundRect") {
    const radiusPx = getRoundRectRadiusPx(element);
    if (radiusPx <= 0.01) {
      return base;
    }
    return {
      ...base,
      borderRadius: radiusPx,
    };
  }

  if (normalizedShapeType === "ellipse") {
    return {
      ...base,
      borderRadius: "9999px",
    };
  }

  if (clipPath) {
    return {
      ...base,
      clipPath,
    };
  }

  if (normalizedShapeType === "line") {
    return {
      ...base,
      backgroundColor: "transparent",
      borderWidth: 0,
      borderTopWidth: Math.max(strokeWidth, 2),
      borderTopColor: resolvedStrokeColor,
      borderTopStyle: getCssBorderDashStyle(
        strokeDash,
      ) as React.CSSProperties["borderTopStyle"],
    };
  }

  if (normalizedShapeType === "cylinder") {
    return {
      ...base,
      borderRadius: "48% / 12%",
    };
  }

  return base;
}
