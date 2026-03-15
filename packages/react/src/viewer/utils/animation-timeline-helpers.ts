import type { PptxNativeAnimation, PptxColorAnimation } from "pptx-viewer-core";
import { PRESET_ID_TO_EFFECT } from "./animation";
import type {
  TimelineStep,
  TimelineClickGroup,
} from "./animation-timeline-types";

// ==========================================================================
// Effect name resolution
// ==========================================================================

export type EffectName = string;

export function resolveEffect(
  anim: PptxNativeAnimation,
): EffectName | undefined {
  const cls = anim.presetClass;
  const id = anim.presetId;
  if (cls === undefined || id === undefined) return undefined;

  const map =
    cls === "entr"
      ? PRESET_ID_TO_EFFECT.entr
      : cls === "exit"
        ? PRESET_ID_TO_EFFECT.exit
        : cls === "emph"
          ? PRESET_ID_TO_EFFECT.emph
          : undefined;
  if (!map) return undefined;
  return map[id] as EffectName | undefined;
}

// ==========================================================================
// Color interpolation utilities for p:animClr
// ==========================================================================

/** Parse a hex color string (#RRGGBB or RRGGBB) into RGB components (0-255). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, "");
  const val = parseInt(cleaned, 16);
  return {
    r: (val >> 16) & 0xff,
    g: (val >> 8) & 0xff,
    b: val & 0xff,
  };
}

/** Convert RGB components (0-255) to a CSS hex color string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/** Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100). */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) * 60;
  } else {
    h = ((rn - gn) / d + 4) * 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255). */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sn = s / 100;
  const ln = l / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hn = h / 360;

  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  };
}

/**
 * Interpolate between two hex colors in the specified color space.
 *
 * @param from - Starting hex color
 * @param to - Ending hex color
 * @param t - Interpolation factor (0 = from, 1 = to)
 * @param colorSpace - "rgb" for linear RGB, "hsl" for HSL hue interpolation
 * @param direction - For HSL: "cw" (clockwise) or "ccw" (counter-clockwise) hue rotation
 * @returns Interpolated hex color string
 */
export function interpolateColor(
  from: string,
  to: string,
  t: number,
  colorSpace: "rgb" | "hsl",
  direction?: "cw" | "ccw",
): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);

  if (colorSpace === "rgb") {
    return rgbToHex(
      fromRgb.r + (toRgb.r - fromRgb.r) * t,
      fromRgb.g + (toRgb.g - fromRgb.g) * t,
      fromRgb.b + (toRgb.b - fromRgb.b) * t,
    );
  }

  // HSL interpolation
  const fromHsl = rgbToHsl(fromRgb.r, fromRgb.g, fromRgb.b);
  const toHsl = rgbToHsl(toRgb.r, toRgb.g, toRgb.b);

  // Compute hue delta respecting direction
  let hDelta = toHsl.h - fromHsl.h;
  const dir = direction ?? "cw";

  if (dir === "cw") {
    // Clockwise: hue increases (wrapping around 360)
    if (hDelta < 0) hDelta += 360;
  } else {
    // Counter-clockwise: hue decreases (wrapping around 360)
    if (hDelta > 0) hDelta -= 360;
  }

  const h = (((fromHsl.h + hDelta * t) % 360) + 360) % 360;
  const s = fromHsl.s + (toHsl.s - fromHsl.s) * t;
  const l = fromHsl.l + (toHsl.l - fromHsl.l) * t;

  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// ==========================================================================
// OOXML attribute name → CSS property mapping for p:animClr
// ==========================================================================

/** Map OOXML `p:attrName` values to the corresponding CSS property. */
const ATTR_NAME_TO_CSS_PROPERTY: Record<string, string> = {
  "fillcolor": "backgroundColor",
  "fill.color": "backgroundColor",
  "style.color": "color",
  "stroke.color": "borderColor",
  "stroke.dashstyle": "borderColor",
  "style.visibility": "color",
  "ppt_c": "color",
  "ppt_x": "color",
  "ppt_y": "color",
};

/**
 * Resolve the CSS property to animate from the OOXML attribute name.
 * Falls back to `color` if the attribute is unknown or not provided.
 */
function resolveCssProperty(attrName?: string): string {
  if (!attrName) return "color";
  return ATTR_NAME_TO_CSS_PROPERTY[attrName] ?? "color";
}

/**
 * Build CSS `@keyframes` for a color animation (`p:animClr`).
 *
 * Generates keyframe stops at regular intervals with interpolated colors.
 * The CSS property is determined from the `targetAttribute` field which is
 * parsed from `p:attrNameLst` (e.g. "fillcolor" → `backgroundColor`).
 *
 * @param colorAnim - Parsed color animation data
 * @param keyframeName - Name for the generated `@keyframes` rule
 * @param steps - Number of keyframe stops (default 10 for smooth interpolation)
 * @returns CSS `@keyframes` string, or undefined if colors are missing
 */
export function buildColorAnimationKeyframes(
  colorAnim: PptxColorAnimation,
  keyframeName: string,
  steps: number = 10,
): string | undefined {
  const { colorSpace, direction, fromColor, toColor, byColor, targetAttribute } = colorAnim;

  // Determine effective start and end colors
  let effectiveFrom: string;
  let effectiveTo: string;

  if (fromColor && toColor) {
    effectiveFrom = fromColor;
    effectiveTo = toColor;
  } else if (fromColor && byColor) {
    // "by" animation: add the delta to the from color
    const fromRgb = hexToRgb(fromColor);
    const byRgb = hexToRgb(byColor);
    effectiveFrom = fromColor;
    effectiveTo = rgbToHex(
      fromRgb.r + byRgb.r,
      fromRgb.g + byRgb.g,
      fromRgb.b + byRgb.b,
    );
  } else if (toColor) {
    // No from specified — use a neutral starting point
    effectiveFrom = "#000000";
    effectiveTo = toColor;
  } else {
    return undefined;
  }

  const cssProperty = resolveCssProperty(targetAttribute);
  const lines: string[] = [];
  const actualSteps = Math.max(2, steps);

  for (let i = 0; i <= actualSteps; i++) {
    const t = i / actualSteps;
    const pct = Math.round(t * 100);
    const color = interpolateColor(
      effectiveFrom,
      effectiveTo,
      t,
      colorSpace,
      direction,
    );
    lines.push(`\t${pct}% { ${cssProperty}: ${color}; }`);
  }

  return `@keyframes ${keyframeName} {\n${lines.join("\n")}\n}`;
}

/**
 * Build a dynamic CSS `@keyframes` block for animations that don't map
 * to a static effect preset (motion paths, rotation, scale, color).
 */
export function buildDynamicKeyframe(
  anim: PptxNativeAnimation,
  uid: number,
): { keyframeName: string; css: string } | undefined {
  if (anim.motionPath) {
    const name = `pptx-tl-motion-${uid}`;
    const cmds = anim.motionPath
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?=[MLCZ])/i)
      .filter(Boolean);
    const points: Array<{ x: number; y: number }> = [];
    for (const cmd of cmds) {
      const type = cmd.charAt(0).toUpperCase();
      if (type === "Z") continue;
      const nums = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push({ x: nums[i] * 100, y: nums[i + 1] * 100 });
      }
    }
    if (points.length < 2) return undefined;
    const lines: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const pct = Math.round((i / (points.length - 1)) * 100);
      const tx = points[i].x.toFixed(2);
      const ty = points[i].y.toFixed(2);

      if (anim.motionPathRotateAuto) {
        // Compute the tangent angle at this point using the direction
        // to the next point (or from the previous point for the last one).
        const next = i < points.length - 1 ? points[i + 1] : points[i];
        const prev = i > 0 ? points[i - 1] : points[i];
        const dx = i < points.length - 1 ? next.x - points[i].x : points[i].x - prev.x;
        const dy = i < points.length - 1 ? next.y - points[i].y : points[i].y - prev.y;
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        lines.push(
          `\t${pct}% { transform: translate(${tx}%, ${ty}%) rotate(${angleDeg.toFixed(2)}deg); }`,
        );
      } else {
        lines.push(
          `\t${pct}% { transform: translate(${tx}%, ${ty}%); }`,
        );
      }
    }
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n${lines.join("\n")}\n}`,
    };
  }
  if (anim.rotationBy !== undefined) {
    const name = `pptx-tl-rotate-${uid}`;
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n\tfrom { transform: rotate(0deg); }\n\tto { transform: rotate(${anim.rotationBy}deg); }\n}`,
    };
  }
  if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
    const name = `pptx-tl-scale-${uid}`;
    const sx = anim.scaleByX ?? 1;
    const sy = anim.scaleByY ?? 1;
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n\tfrom { transform: scale(1); }\n\tto { transform: scale(${sx}, ${sy}); }\n}`,
    };
  }
  // Color animation (p:animClr)
  if (anim.colorAnimation) {
    const name = `pptx-tl-color-${uid}`;
    const css = buildColorAnimationKeyframes(anim.colorAnimation, name);
    if (css) {
      return { keyframeName: name, css };
    }
  }
  return undefined;
}

export function cssKeyframeName(effect: EffectName): string {
  return `pptx-${effect}`;
}

export function defaultDuration(
  presetClass: PptxNativeAnimation["presetClass"],
): number {
  switch (presetClass) {
    case "entr":
      return 500;
    case "exit":
      return 500;
    case "emph":
      return 800;
    case "path":
      return 1000;
    default:
      return 500;
  }
}

export function fillModeForClass(
  presetClass: PptxNativeAnimation["presetClass"],
): TimelineStep["fillMode"] {
  switch (presetClass) {
    case "entr":
      return "both";
    case "exit":
      return "forwards";
    case "emph":
      return "both";
    default:
      return "both";
  }
}

export function finalizeClickGroup(steps: TimelineStep[]): TimelineClickGroup {
  let maxEnd = 0;
  for (const step of steps) {
    const end = step.delayMs + step.durationMs;
    if (end > maxEnd) maxEnd = end;
  }
  return { steps, totalDurationMs: maxEnd };
}
