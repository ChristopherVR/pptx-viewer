import type { PptxNativeAnimation } from "../../core";
import type { EffectName, AnimationStep } from "./animation-types";
import { PRESET_ID_TO_EFFECT } from "./animation-presets";

// ==========================================================================
// Internal helpers shared by animation-effects and animation-sequencer
// ==========================================================================

export function resolveEffect(
  anim: PptxNativeAnimation,
): EffectName | undefined {
  const cls = anim.presetClass;
  const id = anim.presetId;
  if (cls === undefined || id === undefined) {
    return undefined;
  }
  if (cls === "entr") {
    return PRESET_ID_TO_EFFECT.entr[id];
  }
  if (cls === "exit") {
    return PRESET_ID_TO_EFFECT.exit[id];
  }
  if (cls === "emph") {
    return PRESET_ID_TO_EFFECT.emph[id];
  }
  // For path/motion/rotation/scale, return undefined — handled dynamically
  return undefined;
}

/**
 * Build a dynamic CSS `@keyframes` block for motion path, rotation, or
 * scale animations that don't map to a static effect preset.
 */
export function buildDynamicKeyframes(
  anim: PptxNativeAnimation,
  uid: number,
): { keyframeName: string; css: string } | undefined {
  // Motion path animation
  if (anim.motionPath) {
    // OOXML motion paths use coordinates where 1.0 = slide/element width.
    // Convert to percentage-based translate offsets via 100% multiplier.
    const name = `fuzor-motionPath-${uid}`;
    // Parse simple M→L SVG paths into translate waypoints.
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
    const kfLines: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const pct = Math.round((i / (points.length - 1)) * 100);
      kfLines.push(
        `\t${pct}% { transform: translate(${points[i].x.toFixed(2)}%, ${points[i].y.toFixed(2)}%); }`,
      );
    }
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n${kfLines.join("\n")}\n}`,
    };
  }

  // Rotation animation
  if (anim.rotationBy !== undefined) {
    const name = `fuzor-rotateBy-${uid}`;
    const deg = anim.rotationBy;
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n\tfrom { transform: rotate(0deg); }\n\tto { transform: rotate(${deg}deg); }\n}`,
    };
  }

  // Scale animation
  if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
    const name = `fuzor-scaleBy-${uid}`;
    const sx = anim.scaleByX ?? 1;
    const sy = anim.scaleByY ?? 1;
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n\tfrom { transform: scale(1); }\n\tto { transform: scale(${sx}, ${sy}); }\n}`,
    };
  }

  return undefined;
}

export function cssKeyframeName(effect: EffectName): string {
  return `fuzor-${effect}`;
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
): AnimationStep["fillMode"] {
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

// ==========================================================================
// File reading utility
// ==========================================================================

export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read image file."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };
    reader.readAsDataURL(file);
  });
}
