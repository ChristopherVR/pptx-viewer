/**
 * Framework-agnostic shape geometry utilities.
 *
 * Maps OpenXML preset geometry names to supported shape types,
 * generates CSS clip-paths, and calculates round-rect radii.
 */
import type { PptxElementWithShapeStyle } from "../types";
import type { SupportedShapeType } from "../constants";
import {
  PRESET_SHAPE_CLIP_PATHS,
  getPresetShapeClipPath,
} from "./preset-shape-paths";

// ---------------------------------------------------------------------------
// Shape type mapping
// ---------------------------------------------------------------------------

export function getShapeType(
  shapeType: string | undefined,
): SupportedShapeType {
  if (!shapeType) return "rect";
  const normalized = shapeType.toLowerCase();
  if (normalized === "rect") return "rect";
  if (normalized === "roundrect") return "roundRect";
  if (normalized === "ellipse" || normalized === "oval") return "ellipse";
  if (normalized === "cylinder" || normalized === "can") return "cylinder";
  if (normalized === "triangle") return "triangle";
  if (normalized === "diamond") return "diamond";
  if (normalized === "line") return "line";
  if (normalized === "rtarrow" || normalized === "rightarrow") return "rtArrow";
  if (normalized === "leftarrow") return "leftArrow";
  if (normalized === "uparrow") return "upArrow";
  if (normalized === "downarrow") return "downArrow";
  if (normalized.includes("connector")) return "connector";
  // If the shape has a known clip-path in the preset library, treat it as a rect
  // (clip-path rendering will handle the visual appearance)
  if (PRESET_SHAPE_CLIP_PATHS[normalized] !== undefined) return "rect";
  return "rect";
}

// ---------------------------------------------------------------------------
// CSS clip-path for shapes — delegates to comprehensive preset library
// ---------------------------------------------------------------------------

export function getShapeClipPath(
  shapeType: string | undefined,
): string | undefined {
  return getPresetShapeClipPath(shapeType);
}

// ---------------------------------------------------------------------------
// Round-rect radius
// ---------------------------------------------------------------------------

export function getRoundRectRadiusPx(
  element: PptxElementWithShapeStyle,
): number {
  const adjustment = element.shapeAdjustments?.adj;
  const normalizedAdjustment =
    typeof adjustment === "number" && Number.isFinite(adjustment)
      ? Math.min(Math.max(adjustment, 0), 50000) / 50000
      : 16667 / 50000;
  return (
    Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) *
    0.5 *
    normalizedAdjustment
  );
}

// ---------------------------------------------------------------------------
// Image mask style (shape-based clipping for images)
// ---------------------------------------------------------------------------

export interface ImageMaskStyle {
  borderRadius?: string | number;
  clipPath?: string;
}

export function getImageMaskStyle(
  element: PptxElementWithShapeStyle,
): ImageMaskStyle | undefined {
  const shapeType = element.shapeType;
  if (!shapeType) return undefined;
  const normalized = shapeType.toLowerCase();

  if (
    normalized === "roundrect" ||
    normalized === "round1rect" ||
    normalized === "round2samerect" ||
    normalized === "round2diagrect" ||
    normalized === "sniproundrect" ||
    normalized === "snip1rect" ||
    normalized === "snip2diagrect"
  ) {
    const radiusPx = getRoundRectRadiusPx(element);
    if (radiusPx <= 0.01) return undefined;
    return { borderRadius: radiusPx };
  }

  if (normalized === "ellipse" || normalized === "oval") {
    return { borderRadius: "9999px" };
  }
  if (normalized === "can" || normalized === "cylinder") {
    return { borderRadius: "48% / 12%" };
  }

  const clipPath = getShapeClipPath(shapeType);
  if (!clipPath) return undefined;
  return { clipPath };
}
