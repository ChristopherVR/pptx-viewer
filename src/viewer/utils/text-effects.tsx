import type React from "react";

import type { TextStyle } from "../../core";
import { normalizeHexColor, getPatternSvg } from "./color";

// ── Text fill CSS helper ─────────────────────────────────────────────────

/**
 * Build CSS properties for gradient or pattern text fills.
 * Uses the `background-clip: text` technique to clip fill to glyph outlines.
 */
export function buildTextFillCss(
  style: TextStyle,
): React.CSSProperties | undefined {
  // Gradient text fill
  if (style.textFillGradient) {
    return {
      background: style.textFillGradient,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    };
  }

  // Pattern text fill
  if (style.textFillPattern) {
    const fg = normalizeHexColor(style.textFillPatternForeground, "#000000");
    const bg = normalizeHexColor(style.textFillPatternBackground, "#ffffff");
    const svgPattern = getPatternSvg(style.textFillPattern, fg, bg);
    if (svgPattern) {
      const encoded = encodeURIComponent(svgPattern);
      return {
        background: `url("data:image/svg+xml,${encoded}")`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      };
    }
  }

  return undefined;
}

// ── Text effect CSS helpers ───────────────────────────────────────────────

/** EMU per pixel constant for 3D conversions. */
const TEXT_3D_EMU_PER_PX = 9525;
/** Maximum shadow layers for 3D extrusion (capped for performance). */
const MAX_EXTRUSION_LAYERS = 20;

/**
 * Darken a hex colour by a given factor (0–1 where 0 returns black).
 * Used when no explicit extrusion colour is specified.
 */
function darkenHex(hex: string, factor: number): string {
  const norm = normalizeHexColor(hex, "#888888");
  const r = Math.round(parseInt(norm.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(norm.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(norm.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

/**
 * Build CSS `text-shadow` layers that simulate 3D text extrusion.
 * Each layer offsets by 1px along the depth axis; a final soft shadow
 * adds perceived depth.
 */
export function buildText3DShadowCss(style: TextStyle): string | undefined {
  const t3d = style.text3d;
  if (!t3d) return undefined;
  const hasExtrusion = t3d.extrusionHeight && t3d.extrusionHeight > 0;
  const hasBevelTop = t3d.bevelTopType && t3d.bevelTopType !== "none";
  const hasBevelBottom = t3d.bevelBottomType && t3d.bevelBottomType !== "none";
  if (!hasExtrusion && !hasBevelTop && !hasBevelBottom) return undefined;

  const layers: string[] = [];

  // Extrusion depth layers
  if (hasExtrusion) {
    const depthPx = Math.min(
      Math.round((t3d.extrusionHeight ?? 0) / TEXT_3D_EMU_PER_PX),
      MAX_EXTRUSION_LAYERS,
    );
    const extColor = t3d.extrusionColor
      ? normalizeHexColor(t3d.extrusionColor, "#888888")
      : darkenHex(style.color || "#000000", 0.55);
    for (let i = 1; i <= depthPx; i++) {
      layers.push(`${i}px ${i}px 0 ${extColor}`);
    }
    // Final soft shadow for depth perception
    if (depthPx > 0) {
      layers.push(
        `${depthPx + 1}px ${depthPx + 1}px ${Math.max(2, Math.round(depthPx / 2))}px rgba(0,0,0,0.3)`,
      );
    }
  }

  // Top bevel: subtle highlight at top-left edge
  if (hasBevelTop) {
    const bW = t3d.bevelTopWidth
      ? Math.max(1, Math.round(t3d.bevelTopWidth / TEXT_3D_EMU_PER_PX))
      : 1;
    const bH = t3d.bevelTopHeight
      ? Math.max(1, Math.round(t3d.bevelTopHeight / TEXT_3D_EMU_PER_PX))
      : 1;
    layers.push(
      `-${bW}px -${bH}px ${Math.max(bW, bH)}px rgba(255,255,255,0.4)`,
    );
    layers.push(`${bW}px ${bH}px ${Math.max(bW, bH)}px rgba(0,0,0,0.25)`);
  }

  // Bottom bevel: subtle shadow at bottom-right edge
  if (t3d.bevelBottomType && t3d.bevelBottomType !== "none") {
    const bW = t3d.bevelBottomWidth
      ? Math.max(1, Math.round(t3d.bevelBottomWidth / TEXT_3D_EMU_PER_PX))
      : 1;
    const bH = t3d.bevelBottomHeight
      ? Math.max(1, Math.round(t3d.bevelBottomHeight / TEXT_3D_EMU_PER_PX))
      : 1;
    layers.push(`${bW}px ${bH}px ${Math.max(bW, bH)}px rgba(0,0,0,0.3)`);
    layers.push(
      `-${bW}px -${bH}px ${Math.max(bW, bH)}px rgba(255,255,255,0.2)`,
    );
  }

  return layers.length > 0 ? layers.join(", ") : undefined;
}

/** Build a CSS `text-shadow` value from text shadow properties. */
export function buildTextShadowCss(style: TextStyle): string | undefined {
  const shadows: string[] = [];

  // Regular text shadow
  const hasShadow =
    style.textShadowColor ||
    (typeof style.textShadowBlur === "number" && style.textShadowBlur > 0);
  if (hasShadow) {
    const ox = style.textShadowOffsetX ?? 0;
    const oy = style.textShadowOffsetY ?? 0;
    const blur = style.textShadowBlur ?? 4;
    const color = normalizeHexColor(style.textShadowColor, "#000000");
    const opacity = style.textShadowOpacity ?? 0.5;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    shadows.push(`${ox}px ${oy}px ${blur}px rgba(${r},${g},${b},${opacity})`);
  }

  // Preset shadow (approximate as outer shadow with preset-derived offsets)
  if (style.textPresetShadowName && style.textPresetShadowColor) {
    const dist = style.textPresetShadowDistance ?? 3;
    const dir = style.textPresetShadowDirection ?? 315;
    const dirRad = (dir * Math.PI) / 180;
    const psOx = Math.round(Math.cos(dirRad) * dist * 100) / 100;
    const psOy = Math.round(Math.sin(dirRad) * dist * 100) / 100;
    const psColor = normalizeHexColor(style.textPresetShadowColor, "#000000");
    const psOpacity = style.textPresetShadowOpacity ?? 0.5;
    const psR = parseInt(psColor.slice(1, 3), 16);
    const psG = parseInt(psColor.slice(3, 5), 16);
    const psB = parseInt(psColor.slice(5, 7), 16);
    shadows.push(`${psOx}px ${psOy}px 4px rgba(${psR},${psG},${psB},${psOpacity})`);
  }

  // 3D extrusion/bevel layers
  const text3dShadow = buildText3DShadowCss(style);
  if (text3dShadow) {
    shadows.push(text3dShadow);
  }

  return shadows.length > 0 ? shadows.join(", ") : undefined;
}

/**
 * Build a CSS `filter` value for text inner shadow effect.
 * Inner shadow on text is approximated using inset drop-shadow.
 * Since CSS text-shadow doesn't support inset, we use a filter chain.
 */
export function buildTextInnerShadowCss(
  style: TextStyle,
): string | undefined {
  const has =
    style.textInnerShadowColor ||
    (typeof style.textInnerShadowBlur === "number" &&
      style.textInnerShadowBlur > 0);
  if (!has) return undefined;
  const ox = style.textInnerShadowOffsetX ?? 0;
  const oy = style.textInnerShadowOffsetY ?? 0;
  const blur = style.textInnerShadowBlur ?? 3;
  const color = normalizeHexColor(style.textInnerShadowColor, "#000000");
  const opacity = style.textInnerShadowOpacity ?? 0.5;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `drop-shadow(${ox}px ${oy}px ${blur}px rgba(${r},${g},${b},${opacity}))`;
}

/** Build a CSS `filter` for text blur effect (`a:blur`). */
export function buildTextBlurFilter(style: TextStyle): string | undefined {
  if (typeof style.textBlurRadius !== "number" || style.textBlurRadius <= 0) {
    return undefined;
  }
  return `blur(${Math.round(style.textBlurRadius)}px)`;
}

/**
 * Build a CSS `filter` for text HSL modifications.
 * Maps OOXML hue/saturation/luminance adjustments to CSS filter functions.
 */
export function buildTextHslFilter(style: TextStyle): string | undefined {
  const parts: string[] = [];
  if (typeof style.textHslHue === "number" && style.textHslHue !== 0) {
    parts.push(`hue-rotate(${style.textHslHue}deg)`);
  }
  if (
    typeof style.textHslSaturation === "number" &&
    style.textHslSaturation !== 100
  ) {
    parts.push(`saturate(${style.textHslSaturation / 100})`);
  }
  if (
    typeof style.textHslLuminance === "number" &&
    style.textHslLuminance !== 0
  ) {
    parts.push(`brightness(${1 + style.textHslLuminance / 100})`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Compute CSS opacity from text alpha modification effects. */
export function getTextAlphaOpacity(style: TextStyle): number | undefined {
  if (typeof style.textAlphaModFix === "number") {
    return Math.max(0, Math.min(1, style.textAlphaModFix / 100));
  }
  if (typeof style.textAlphaMod === "number") {
    return Math.max(0, Math.min(1, style.textAlphaMod / 100));
  }
  return undefined;
}

/** Build a CSS `filter` value for text glow effect. */
export function buildTextGlowFilter(style: TextStyle): string | undefined {
  const hasGlow =
    style.textGlowColor ||
    (typeof style.textGlowRadius === "number" && style.textGlowRadius > 0);
  if (!hasGlow) return undefined;
  const radius = style.textGlowRadius ?? 6;
  const color = normalizeHexColor(style.textGlowColor, "#ffff00");
  const opacity = style.textGlowOpacity ?? 0.6;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `drop-shadow(0 0 ${radius}px rgba(${r},${g},${b},${opacity}))`;
}

/**
 * Build a CSS `-webkit-box-reflect` value for text reflection effect.
 * Uses the WebKit-only property which is supported in Electron (Chromium).
 * The gradient mask fades from startAlpha at the top of the reflection to
 * endAlpha at the bottom.
 */
export function buildTextReflectionCss(style: TextStyle): string | undefined {
  if (!style.textReflection) return undefined;
  const offset = style.textReflectionOffset ?? 0;
  const startAlpha = style.textReflectionStartOpacity ?? 0.5;
  const endAlpha = style.textReflectionEndOpacity ?? 0;
  return `below ${offset}px linear-gradient(rgba(0,0,0,${startAlpha}), rgba(0,0,0,${endAlpha}))`;
}
