/**
 * Framework-agnostic stroke/dash utilities for PPTX shapes and connectors.
 */
import type { StrokeDashType } from "../types";

/**
 * Normalize a raw dash-type string (possibly from OpenXML) into a typed `StrokeDashType`.
 */
export function normalizeStrokeDashType(
  value: StrokeDashType | string | undefined,
): StrokeDashType | undefined {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;

  const dashMap: Record<string, StrokeDashType> = {
    solid: "solid",
    dot: "dot",
    dash: "dash",
    lgdash: "lgDash",
    dashdot: "dashDot",
    lgdashdot: "lgDashDot",
    lgdashdotdot: "lgDashDotDot",
    sysdot: "sysDot",
    sysdash: "sysDash",
    sysdashdot: "sysDashDot",
    sysdashdotdot: "sysDashDotDot",
    custom: "custom",
  };
  return dashMap[normalized];
}

/**
 * Map a `StrokeDashType` to the equivalent CSS `borderStyle`.
 */
export function getCssBorderDashStyle(
  dashType: StrokeDashType | undefined,
): string | undefined {
  if (!dashType || dashType === "solid") return "solid";
  if (dashType === "dot" || dashType === "sysDot") return "dotted";
  return "dashed";
}

/**
 * Map a `StrokeDashType` to an SVG `stroke-dasharray` value.
 * When `dashType` is `"custom"` and `customDashSegments` are provided,
 * the dash-array is built from the actual segment data rather than
 * using a hardcoded fallback.
 */
export function getSvgStrokeDasharray(
  dashType: StrokeDashType | undefined,
  strokeWidth: number,
  customDashSegments?: Array<{ dash: number; space: number }>,
): string | undefined {
  if (!dashType || dashType === "solid") return undefined;
  const stroke = Math.max(strokeWidth, 1);

  // If custom dash with parsed segments, build dasharray from actual data.
  // Segment values are in 1/1000 of the line width, so divide by 1000
  // to get multiples of stroke-width.
  if (
    dashType === "custom" &&
    customDashSegments &&
    customDashSegments.length > 0
  ) {
    return customDashSegments
      .flatMap((seg) => [
        (seg.dash / 1000) * stroke,
        (seg.space / 1000) * stroke,
      ])
      .join(" ");
  }

  switch (dashType) {
    case "dot":
    case "sysDot":
      return `${stroke} ${stroke * 2}`;
    case "dash":
    case "sysDash":
      return `${stroke * 4} ${stroke * 2}`;
    case "lgDash":
      return `${stroke * 7} ${stroke * 2.5}`;
    case "dashDot":
    case "sysDashDot":
      return `${stroke * 4} ${stroke * 2} ${stroke} ${stroke * 2}`;
    case "lgDashDot":
      return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2.5}`;
    case "lgDashDotDot":
    case "sysDashDotDot":
      return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2} ${stroke} ${stroke * 2}`;
    case "custom":
      return `${stroke * 3} ${stroke * 2}`;
    default:
      return undefined;
  }
}
