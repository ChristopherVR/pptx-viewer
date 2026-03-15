import type React from "react";

import type { TextStyle, Pptx3DScene } from "pptx-viewer-core";
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
const MAX_EXTRUSION_LAYERS = 15;
/** Minimum shadow layers for 3D extrusion (ensures visible depth). */
const MIN_EXTRUSION_LAYERS = 3;

/**
 * Parse a hex colour string into RGB channels.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHexColor(hex, "#888888");
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

/**
 * Darken a hex colour by a given factor (0–1 where 0 returns black).
 * Used when no explicit extrusion colour is specified.
 */
function darkenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/**
 * Lighten a hex colour by mixing toward white.
 * @param hex - source colour
 * @param factor - 0 = original colour, 1 = white
 */
function lightenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
}

// ── Material preset configuration ────────────────────────────────────────
/**
 * Material configuration determines how extrusion shadow layers darken
 * and whether a specular highlight shadow is added.
 */
interface MaterialConfig {
  /** Base darkening factor for extrusion layers (0–1, lower = darker). */
  darkenBase: number;
  /** How steeply the layers darken toward the back (0–1). */
  darkenFalloff: number;
  /** Whether to add a specular highlight shadow on the face edge. */
  specular: boolean;
  /** Specular highlight opacity (0–1). */
  specularOpacity: number;
  /** Specular highlight sharpness (blur radius in px). */
  specularBlur: number;
}

const MATERIAL_CONFIGS: Record<string, MaterialConfig> = {
  matte:              { darkenBase: 0.55, darkenFalloff: 0.6, specular: false, specularOpacity: 0, specularBlur: 0 },
  warmMatte:          { darkenBase: 0.50, darkenFalloff: 0.5, specular: false, specularOpacity: 0, specularBlur: 0 },
  plastic:            { darkenBase: 0.50, darkenFalloff: 0.5, specular: true, specularOpacity: 0.55, specularBlur: 1 },
  metal:              { darkenBase: 0.35, darkenFalloff: 0.7, specular: true, specularOpacity: 0.70, specularBlur: 0 },
  dkEdge:             { darkenBase: 0.30, darkenFalloff: 0.8, specular: true, specularOpacity: 0.50, specularBlur: 1 },
  softEdge:           { darkenBase: 0.55, darkenFalloff: 0.4, specular: true, specularOpacity: 0.30, specularBlur: 3 },
  flat:               { darkenBase: 0.60, darkenFalloff: 0.3, specular: false, specularOpacity: 0, specularBlur: 0 },
  softmetal:          { darkenBase: 0.40, darkenFalloff: 0.6, specular: true, specularOpacity: 0.55, specularBlur: 2 },
  clear:              { darkenBase: 0.60, darkenFalloff: 0.4, specular: true, specularOpacity: 0.40, specularBlur: 2 },
  powder:             { darkenBase: 0.55, darkenFalloff: 0.5, specular: false, specularOpacity: 0, specularBlur: 0 },
  translucentPowder:  { darkenBase: 0.60, darkenFalloff: 0.4, specular: true, specularOpacity: 0.25, specularBlur: 3 },
};

/** Default material config when the preset is unknown or unset. */
const DEFAULT_MATERIAL: MaterialConfig = MATERIAL_CONFIGS.plastic;

/**
 * Resolve a MaterialConfig from the preset material token.
 */
function getMaterialConfig(preset: string | undefined): MaterialConfig {
  if (!preset) return DEFAULT_MATERIAL;
  return MATERIAL_CONFIGS[preset] ?? DEFAULT_MATERIAL;
}

// ── Bevel type configuration ─────────────────────────────────────────────
/**
 * Bevel configuration affects highlight/shadow opacity and blur for the
 * top and bottom bevel edge simulations.
 */
interface BevelConfig {
  /** Highlight opacity on the lit edge. */
  highlightOpacity: number;
  /** Shadow opacity on the shaded edge. */
  shadowOpacity: number;
  /** Blur radius multiplier for the bevel glow (0 = sharp, 1 = soft). */
  blurMultiplier: number;
  /** Extra highlight layer for pronounced bevels. */
  extraHighlight: boolean;
}

const BEVEL_CONFIGS: Record<string, BevelConfig> = {
  circle:       { highlightOpacity: 0.45, shadowOpacity: 0.30, blurMultiplier: 1.0, extraHighlight: false },
  relaxedInset: { highlightOpacity: 0.35, shadowOpacity: 0.25, blurMultiplier: 1.2, extraHighlight: false },
  cross:        { highlightOpacity: 0.50, shadowOpacity: 0.35, blurMultiplier: 0.8, extraHighlight: true },
  coolSlant:    { highlightOpacity: 0.40, shadowOpacity: 0.30, blurMultiplier: 0.6, extraHighlight: true },
  angle:        { highlightOpacity: 0.55, shadowOpacity: 0.35, blurMultiplier: 0.5, extraHighlight: true },
  softRound:    { highlightOpacity: 0.40, shadowOpacity: 0.25, blurMultiplier: 1.5, extraHighlight: false },
  convex:       { highlightOpacity: 0.50, shadowOpacity: 0.30, blurMultiplier: 1.0, extraHighlight: true },
  slope:        { highlightOpacity: 0.40, shadowOpacity: 0.30, blurMultiplier: 1.0, extraHighlight: false },
  divot:        { highlightOpacity: 0.30, shadowOpacity: 0.35, blurMultiplier: 0.8, extraHighlight: false },
  riblet:       { highlightOpacity: 0.35, shadowOpacity: 0.30, blurMultiplier: 0.6, extraHighlight: true },
  hardEdge:     { highlightOpacity: 0.60, shadowOpacity: 0.40, blurMultiplier: 0.3, extraHighlight: true },
  artDeco:      { highlightOpacity: 0.55, shadowOpacity: 0.35, blurMultiplier: 0.4, extraHighlight: true },
};

const DEFAULT_BEVEL: BevelConfig = BEVEL_CONFIGS.circle;

function getBevelConfig(type: string | undefined): BevelConfig {
  if (!type || type === "none") return DEFAULT_BEVEL;
  return BEVEL_CONFIGS[type] ?? DEFAULT_BEVEL;
}

// ── Text body 3D scene direction helpers ──────────────────────────────────

/**
 * Compute extrusion offset direction from scene3d camera settings.
 * Returns (dx, dy) multipliers for text-shadow offsets.
 * When no scene3d is present, defaults to bottom-right (1, 1).
 */
function getTextExtrusionDirection(scene3d: Pptx3DScene | undefined): { dx: number; dy: number } {
  if (!scene3d) return { dx: 1, dy: 1 };

  let dx = 1;
  let dy = 1;

  // Camera rotation in 1/60000 degrees → degrees
  const rotX = scene3d.cameraRotX ? -(scene3d.cameraRotX / 60000) : 0;
  const rotY = scene3d.cameraRotY ? scene3d.cameraRotY / 60000 : 0;

  // Camera presets influence default direction
  const preset = scene3d.cameraPreset || "";
  if (preset.includes("Left")) {
    dx = -1;
  } else if (preset.includes("Right")) {
    dx = 1;
  }
  if (preset.includes("Above") || preset.includes("Top")) {
    dy = 1;
  } else if (preset.includes("Below") || preset.includes("Bottom")) {
    dy = -1;
  }

  // Explicit rotation overrides preset direction
  if (rotY > 5) dx = -1;
  else if (rotY < -5) dx = 1;
  if (rotX < -5) dy = 1;
  else if (rotX > 5) dy = -1;

  return { dx, dy };
}

/**
 * Map the light rig direction token to a shadow angle in degrees.
 * The shadow falls opposite to the light source direction.
 */
function getLightRigShadowAngle(direction: string | undefined): number {
  switch (direction) {
    case "t": return 180;
    case "b": return 0;
    case "l": return 90;
    case "r": return 270;
    case "tl": return 135;
    case "tr": return 225;
    case "bl": return 45;
    case "br": return 315;
    default: return 135; // default: light from top-left
  }
}

/**
 * Build CSS `text-shadow` layers that simulate 3D text extrusion.
 *
 * The shadow stack is built from three independent components:
 *
 * 1. **Extrusion depth** — N shadow layers (capped between {@link MIN_EXTRUSION_LAYERS}
 *    and {@link MAX_EXTRUSION_LAYERS}) stacked in the extrusion direction. The colour
 *    of each layer darkens progressively from the base toward the back, with the
 *    gradient curve controlled by the active {@link MaterialConfig}.
 *
 * 2. **Bevel edges** — Highlight and shadow layers that simulate a bevelled edge on
 *    the face of the text. The bevel preset type determines the highlight/shadow
 *    intensities and blur, and optionally adds extra sharp edge highlights for
 *    pronounced bevel types like `hardEdge` or `angle`.
 *
 * 3. **Specular highlight** (material-dependent) — Materials like `plastic` and
 *    `metal` add a bright specular highlight shadow opposite the extrusion
 *    direction to simulate a shiny surface.
 *
 * When `textBodyScene3d` is available, the extrusion direction and light rig
 * shadow are adjusted based on camera and light rig settings.
 */
export function buildText3DShadowCss(style: TextStyle): string | undefined {
  const t3d = style.text3d;
  if (!t3d) return undefined;
  const hasExtrusion = t3d.extrusionHeight && t3d.extrusionHeight > 0;
  const hasBevelTop = t3d.bevelTopType && t3d.bevelTopType !== "none";
  const hasBevelBottom = t3d.bevelBottomType && t3d.bevelBottomType !== "none";
  if (!hasExtrusion && !hasBevelTop && !hasBevelBottom) return undefined;

  const scene3d = style.textBodyScene3d;
  const { dx, dy } = getTextExtrusionDirection(scene3d);
  const material = getMaterialConfig(t3d.presetMaterial);
  const baseColor = style.color || "#000000";

  const layers: string[] = [];

  // ── Extrusion depth layers ──────────────────────────────────────────
  if (hasExtrusion) {
    const rawDepthPx = Math.round((t3d.extrusionHeight ?? 0) / TEXT_3D_EMU_PER_PX);
    const depthPx = Math.max(MIN_EXTRUSION_LAYERS, Math.min(rawDepthPx, MAX_EXTRUSION_LAYERS));

    // Determine the base shadow colour for each layer.
    // If an explicit extrusion colour is set, use it; otherwise darken the
    // text fill colour using the material's base darkening factor.
    const hasExplicitColor = !!t3d.extrusionColor;
    const extBaseHex = hasExplicitColor
      ? normalizeHexColor(t3d.extrusionColor, "#888888")
      : baseColor;

    for (let i = 1; i <= depthPx; i++) {
      // Progress 0→1 from front to back of extrusion
      const t = i / depthPx;
      // Material-driven darkening curve: each successive layer is darker
      const darkenFactor = hasExplicitColor
        ? 1 - t * material.darkenFalloff * 0.3 // subtle darkening when colour is explicit
        : material.darkenBase * (1 - t * material.darkenFalloff);
      const color = darkenHex(extBaseHex, Math.max(0.1, darkenFactor));
      layers.push(`${dx * i}px ${dy * i}px 0 ${color}`);
    }

    // Final soft shadow for depth perception
    if (depthPx > 0) {
      layers.push(
        `${dx * (depthPx + 1)}px ${dy * (depthPx + 1)}px ${Math.max(2, Math.round(depthPx / 2))}px rgba(0,0,0,0.3)`,
      );
    }

    // Material specular highlight — bright spot on the lit edge
    if (material.specular && depthPx > 0) {
      const highlightColor = lightenHex(baseColor, material.specularOpacity);
      layers.push(
        `${-dx}px ${-dy}px ${material.specularBlur}px ${highlightColor}`,
      );
    }
  }

  // ── Top bevel: highlight and shadow adjusted by scene direction ─────
  if (hasBevelTop) {
    const bevelCfg = getBevelConfig(t3d.bevelTopType);
    const bW = t3d.bevelTopWidth
      ? Math.max(1, Math.round(t3d.bevelTopWidth / TEXT_3D_EMU_PER_PX))
      : 1;
    const bH = t3d.bevelTopHeight
      ? Math.max(1, Math.round(t3d.bevelTopHeight / TEXT_3D_EMU_PER_PX))
      : 1;
    const blurPx = Math.max(1, Math.round(Math.max(bW, bH) * bevelCfg.blurMultiplier));
    layers.push(
      `${-dx * bW}px ${-dy * bH}px ${blurPx}px rgba(255,255,255,${bevelCfg.highlightOpacity})`,
    );
    layers.push(
      `${dx * bW}px ${dy * bH}px ${blurPx}px rgba(0,0,0,${bevelCfg.shadowOpacity})`,
    );
    // Extra sharp highlight for pronounced bevel types
    if (bevelCfg.extraHighlight) {
      layers.push(
        `${-dx}px ${-dy}px 0 rgba(255,255,255,${Math.round(bevelCfg.highlightOpacity * 0.5 * 100) / 100})`,
      );
    }
  }

  // ── Bottom bevel: shadow at the opposite edge ──────────────────────
  if (hasBevelBottom) {
    const bevelCfg = getBevelConfig(t3d.bevelBottomType);
    const bW = t3d.bevelBottomWidth
      ? Math.max(1, Math.round(t3d.bevelBottomWidth / TEXT_3D_EMU_PER_PX))
      : 1;
    const bH = t3d.bevelBottomHeight
      ? Math.max(1, Math.round(t3d.bevelBottomHeight / TEXT_3D_EMU_PER_PX))
      : 1;
    const blurPx = Math.max(1, Math.round(Math.max(bW, bH) * bevelCfg.blurMultiplier));
    layers.push(
      `${dx * bW}px ${dy * bH}px ${blurPx}px rgba(0,0,0,${bevelCfg.shadowOpacity})`,
    );
    layers.push(
      `${-dx * bW}px ${-dy * bH}px ${blurPx}px rgba(255,255,255,${Math.round(bevelCfg.highlightOpacity * 0.6 * 100) / 100})`,
    );
  }

  // ── Light rig shadow ───────────────────────────────────────────────
  if (scene3d?.lightRigType && scene3d.lightRigType !== "flat") {
    const angle = getLightRigShadowAngle(scene3d.lightRigDirection);
    const rad = (angle * Math.PI) / 180;
    const lx = Math.round(Math.cos(rad) * 2 * 100) / 100;
    const ly = Math.round(Math.sin(rad) * 2 * 100) / 100;
    layers.push(`${lx}px ${ly}px 3px rgba(0,0,0,0.15)`);
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

// ── Text body 3D scene style ─────────────────────────────────────────────

/**
 * Camera preset configuration: CSS perspective distance and base rotation
 * angles (in degrees). Mirrors the shape-level CAMERA_PRESET_MAP but
 * with reduced rotation values for text (text 3D is typically subtler).
 */
interface TextCameraPresetConfig {
  perspective?: string;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

const TEXT_CAMERA_PRESET_MAP: Record<string, TextCameraPresetConfig> = {
  orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },
  perspectiveFront: { perspective: "800px", rotateX: 0, rotateY: 0, rotateZ: 0 },
  perspectiveAbove: { perspective: "800px", rotateX: -12, rotateY: 0, rotateZ: 0 },
  perspectiveBelow: { perspective: "800px", rotateX: 12, rotateY: 0, rotateZ: 0 },
  perspectiveLeft: { perspective: "800px", rotateX: 0, rotateY: 12, rotateZ: 0 },
  perspectiveRight: { perspective: "800px", rotateX: 0, rotateY: -12, rotateZ: 0 },
  perspectiveAboveLeftFacing: { perspective: "800px", rotateX: -12, rotateY: 15, rotateZ: 0 },
  perspectiveAboveRightFacing: { perspective: "800px", rotateX: -12, rotateY: -15, rotateZ: 0 },
  perspectiveContrastingLeftFacing: { perspective: "700px", rotateX: -10, rotateY: 20, rotateZ: 0 },
  perspectiveContrastingRightFacing: { perspective: "700px", rotateX: -10, rotateY: -20, rotateZ: 0 },
  perspectiveHeroicLeftFacing: { perspective: "600px", rotateX: -8, rotateY: 25, rotateZ: 0 },
  perspectiveHeroicRightFacing: { perspective: "600px", rotateX: -8, rotateY: -25, rotateZ: 0 },
  perspectiveHeroicExtremeLeftFacing: { perspective: "500px", rotateX: -6, rotateY: 30, rotateZ: 0 },
  perspectiveHeroicExtremeRightFacing: { perspective: "500px", rotateX: -6, rotateY: -30, rotateZ: 0 },
  perspectiveRelaxed: { perspective: "1000px", rotateX: -6, rotateY: 0, rotateZ: 0 },
  perspectiveRelaxedModerately: { perspective: "1200px", rotateX: -3, rotateY: 0, rotateZ: 0 },
  isometricLeftDown: { perspective: "1000px", rotateX: -20, rotateY: 25, rotateZ: 0 },
  isometricRightUp: { perspective: "1000px", rotateX: -20, rotateY: -25, rotateZ: 0 },
  isometricTopUp: { perspective: "1000px", rotateX: -30, rotateY: 0, rotateZ: 25 },
  isometricTopDown: { perspective: "1000px", rotateX: -30, rotateY: 0, rotateZ: -25 },
  isometricBottomUp: { perspective: "1000px", rotateX: 30, rotateY: 0, rotateZ: 25 },
  isometricBottomDown: { perspective: "1000px", rotateX: 30, rotateY: 0, rotateZ: -25 },
  obliqueTopLeft: { perspective: "800px", rotateX: -12, rotateY: 12, rotateZ: 0 },
  obliqueTop: { perspective: "800px", rotateX: -15, rotateY: 0, rotateZ: 0 },
  obliqueTopRight: { perspective: "800px", rotateX: -12, rotateY: -12, rotateZ: 0 },
  obliqueLeft: { perspective: "800px", rotateX: 0, rotateY: 15, rotateZ: 0 },
  obliqueRight: { perspective: "800px", rotateX: 0, rotateY: -15, rotateZ: 0 },
  obliqueBottomLeft: { perspective: "800px", rotateX: 12, rotateY: 12, rotateZ: 0 },
  obliqueBottom: { perspective: "800px", rotateX: 15, rotateY: 0, rotateZ: 0 },
  obliqueBottomRight: { perspective: "800px", rotateX: 12, rotateY: -12, rotateZ: 0 },
};

/**
 * Build CSS properties for 3D scene rendering on text body.
 *
 * Maps `a:bodyPr/a:scene3d` camera presets and light rig settings to
 * CSS `perspective`, `transform` (rotateX/Y/Z), and light-direction text-shadow.
 * This is applied as a wrapper style on the text body container div.
 *
 * @param textStyle - The parsed text style containing `textBodyScene3d`.
 * @returns CSS properties object, or undefined when no scene3d is present.
 */
export function buildTextBody3DSceneStyle(
  textStyle: TextStyle | undefined,
): React.CSSProperties | undefined {
  const scene3d = textStyle?.textBodyScene3d;
  if (!scene3d) return undefined;

  // Resolve camera preset configuration
  const preset = scene3d.cameraPreset
    ? TEXT_CAMERA_PRESET_MAP[scene3d.cameraPreset]
    : undefined;

  let perspective = preset?.perspective;
  let rotateX = preset?.rotateX ?? 0;
  let rotateY = preset?.rotateY ?? 0;
  let rotateZ = preset?.rotateZ ?? 0;

  // Explicit rotation angles override preset defaults (values in 1/60000 degrees)
  if (scene3d.cameraRotX) {
    rotateX = -(scene3d.cameraRotX / 60000);
  }
  if (scene3d.cameraRotY) {
    rotateY = scene3d.cameraRotY / 60000;
  }
  if (scene3d.cameraRotZ) {
    rotateZ = scene3d.cameraRotZ / 60000;
  }

  // If we have explicit rotations but no preset, apply a default perspective
  if (!perspective && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0)) {
    perspective = "800px";
  }

  const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
  const hasScene = hasRotation || !!perspective;

  if (!hasScene) return undefined;

  const style: React.CSSProperties = {};

  if (perspective) {
    style.perspective = perspective;
  }

  if (hasRotation) {
    const transforms: string[] = [];
    if (rotateX !== 0) transforms.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) transforms.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) transforms.push(`rotateZ(${rotateZ}deg)`);
    style.transform = transforms.join(" ");
  }

  // Preserve 3D space for child elements
  style.transformStyle = "preserve-3d";

  return style;
}
