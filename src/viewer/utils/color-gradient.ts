/**
 * Gradient, pattern fill, and OOXML pattern preset utilities.
 */
import type { ShapeStyle } from "../../core";
import { DEFAULT_FILL_COLOR } from "../constants";
import {
  normalizeHexColor,
  clampUnitInterval,
  colorWithOpacity,
} from "./color-core";
import { getPatternSvg } from "./color-patterns";

export function sanitizeGradientStops(
  stops: ShapeStyle["fillGradientStops"] | undefined,
): NonNullable<ShapeStyle["fillGradientStops"]> {
  if (!stops || stops.length === 0) return [];
  return stops
    .filter(
      (stop) =>
        typeof stop?.color === "string" &&
        String(stop.color).trim().length > 0 &&
        typeof stop?.position === "number" &&
        Number.isFinite(stop.position),
    )
    .map((stop) => ({
      color: normalizeHexColor(String(stop.color), DEFAULT_FILL_COLOR),
      position: Math.max(0, Math.min(100, stop.position)),
      opacity:
        typeof stop.opacity === "number" && Number.isFinite(stop.opacity)
          ? clampUnitInterval(stop.opacity)
          : undefined,
    }))
    .sort((left, right) => left.position - right.position);
}

export function toCssGradientStop(stop: {
  color: string;
  position: number;
  opacity?: number;
}): string {
  const color =
    typeof stop.opacity === "number"
      ? colorWithOpacity(stop.color, stop.opacity)
      : stop.color;
  return `${color} ${Math.round(Math.max(0, Math.min(100, stop.position)))}%`;
}

export function buildCssGradientFromShapeStyle(
  style: ShapeStyle | undefined,
): string | undefined {
  if (!style || style.fillMode !== "gradient") {
    return undefined;
  }

  const stops = sanitizeGradientStops(style.fillGradientStops);
  if (stops.length === 0) {
    return style.fillGradient;
  }

  const gradientType = style.fillGradientType || "linear";
  if (gradientType === "radial") {
    const fp = style.fillGradientFocalPoint;
    const posX = fp ? `${Math.round(fp.x * 100)}%` : "center";
    const posY = fp ? `${Math.round(fp.y * 100)}%` : "center";
    return `radial-gradient(circle at ${posX} ${posY}, ${stops.map(toCssGradientStop).join(", ")})`;
  }

  const normalizedAngle =
    typeof style.fillGradientAngle === "number" &&
    Number.isFinite(style.fillGradientAngle)
      ? style.fillGradientAngle
      : 90;
  return `linear-gradient(${Math.round(normalizedAngle)}deg, ${stops
    .map(toCssGradientStop)
    .join(", ")})`;
}

/**
 * Build a CSS background-image for OOXML pattern fills (a:pattFill).
 * Uses inline SVG data URIs to approximate the preset patterns.
 */
export function buildPatternFillCss(
  style: ShapeStyle | undefined,
): { backgroundImage: string; backgroundColor: string } | undefined {
  if (!style || style.fillMode !== "pattern" || !style.fillPatternPreset) {
    return undefined;
  }

  const fg = normalizeHexColor(style.fillColor, "#000000");
  const bg = normalizeHexColor(style.fillPatternBackgroundColor, "#ffffff");
  const preset = style.fillPatternPreset;

  // Generate SVG pattern based on preset
  const svgPattern = getPatternSvg(preset, fg, bg);
  if (!svgPattern) return undefined;

  const encoded = encodeURIComponent(svgPattern);
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundColor: bg,
  };
}

/**
 * All 52 OOXML pattern fill presets.
 * Reference: ECMA-376 §20.1.10.33 (ST_PresetPatternVal)
 */
export const OOXML_PATTERN_PRESETS = [
  "pct5",
  "pct10",
  "pct20",
  "pct25",
  "pct30",
  "pct40",
  "pct50",
  "pct60",
  "pct70",
  "pct75",
  "pct80",
  "pct90",
  "horz",
  "vert",
  "ltHorz",
  "ltVert",
  "dkHorz",
  "dkVert",
  "narHorz",
  "narVert",
  "wdHorz",
  "wdVert",
  "dashHorz",
  "dashVert",
  "cross",
  "dnDiag",
  "upDiag",
  "ltDnDiag",
  "ltUpDiag",
  "dkDnDiag",
  "dkUpDiag",
  "wdDnDiag",
  "wdUpDiag",
  "dashDnDiag",
  "dashUpDiag",
  "diagCross",
  "smCheck",
  "lgCheck",
  "smGrid",
  "lgGrid",
  "dotGrid",
  "smConfetti",
  "lgConfetti",
  "horzBrick",
  "diagBrick",
  "solidDmnd",
  "openDmnd",
  "dotDmnd",
  "plaid",
  "sphere",
  "weave",
  "divot",
  "shingle",
  "wave",
  "trellis",
  "zigZag",
] as const;

export type OoxmlPatternPreset = (typeof OOXML_PATTERN_PRESETS)[number];
