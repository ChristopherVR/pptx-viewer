import type { PptxNativeAnimation } from "../../core";
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

/**
 * Build a dynamic CSS `@keyframes` block for animations that don't map
 * to a static effect preset (motion paths, rotation, scale).
 */
export function buildDynamicKeyframe(
  anim: PptxNativeAnimation,
  uid: number,
): { keyframeName: string; css: string } | undefined {
  if (anim.motionPath) {
    const name = `fuzor-tl-motion-${uid}`;
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
      lines.push(
        `\t${pct}% { transform: translate(${points[i].x.toFixed(2)}%, ${points[i].y.toFixed(2)}%); }`,
      );
    }
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n${lines.join("\n")}\n}`,
    };
  }
  if (anim.rotationBy !== undefined) {
    const name = `fuzor-tl-rotate-${uid}`;
    return {
      keyframeName: name,
      css: `@keyframes ${name} {\n\tfrom { transform: rotate(0deg); }\n\tto { transform: rotate(${anim.rotationBy}deg); }\n}`,
    };
  }
  if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
    const name = `fuzor-tl-scale-${uid}`;
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
