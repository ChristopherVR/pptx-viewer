/**
 * Image mask, render style, crop shape, and tiling helpers
 * for the PowerPoint editor.
 */
import type React from "react";

import type { PptxElement } from "pptx-viewer-core";
import {
  isImageLikeElement,
  hasShapeProperties,
} from "pptx-viewer-core";

import { clampCropValue } from "./color";
import { getShapeClipPath } from "./shape";
import { getRoundRectRadiusPx } from "./shape-adjustment";

// ---------------------------------------------------------------------------
// Image mask / render style helpers
// ---------------------------------------------------------------------------

export function getImageMaskStyle(
  element: PptxElement,
): React.CSSProperties | undefined {
  if (!hasShapeProperties(element)) return undefined;
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

export function getImageRenderStyle(element: PptxElement): React.CSSProperties {
  const maskStyle = getImageMaskStyle(element) || {};
  if (!isImageLikeElement(element)) {
    return {
      ...maskStyle,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
  }

  const cropLeft = clampCropValue(element.cropLeft);
  const cropTop = clampCropValue(element.cropTop);
  const cropRight = clampCropValue(element.cropRight);
  const cropBottom = clampCropValue(element.cropBottom);
  const hasCrop =
    cropLeft + cropRight > 0.0001 || cropTop + cropBottom > 0.0001;

  if (!hasCrop) {
    return {
      ...maskStyle,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
  }

  const safeHorizontalScale =
    cropLeft + cropRight >= 0.99 ? 0.99 / (cropLeft + cropRight) : 1;
  const safeVerticalScale =
    cropTop + cropBottom >= 0.99 ? 0.99 / (cropTop + cropBottom) : 1;
  const normalizedLeft = clampCropValue(cropLeft * safeHorizontalScale);
  const normalizedRight = clampCropValue(cropRight * safeHorizontalScale);
  const normalizedTop = clampCropValue(cropTop * safeVerticalScale);
  const normalizedBottom = clampCropValue(cropBottom * safeVerticalScale);
  const remainingWidth = Math.max(0.01, 1 - normalizedLeft - normalizedRight);
  const remainingHeight = Math.max(0.01, 1 - normalizedTop - normalizedBottom);

  const tx = Math.round((-normalizedLeft / remainingWidth) * 10000) / 100;
  const ty = Math.round((-normalizedTop / remainingHeight) * 10000) / 100;
  const sx = Math.round((1 / remainingWidth) * 1e6) / 1e6;
  const sy = Math.round((1 / remainingHeight) * 1e6) / 1e6;

  return {
    ...maskStyle,
    position: "absolute",
    width: "100%",
    height: "100%",
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
    transformOrigin: "top left",
    transform: `translate(${tx}%, ${ty}%) scale(${sx}, ${sy})`,
  };
}

/** Map cropShape to a CSS clip-path value. */
const CROP_SHAPE_CLIP_PATHS: Record<string, string> = {
  ellipse: "ellipse(50% 50% at 50% 50%)",
  roundedRect: "inset(0 round 12%)",
  triangle: "polygon(50% 0%, 0% 100%, 100% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
};

export function getCropShapeClipPath(element: PptxElement): string | undefined {
  if (!isImageLikeElement(element)) return undefined;
  const shape = element.cropShape;
  if (!shape || shape === "none") return undefined;
  return CROP_SHAPE_CLIP_PATHS[shape];
}

export function isImageTiled(element: PptxElement): boolean {
  if (!isImageLikeElement(element)) return false;
  return (
    typeof element.tileScaleX === "number" ||
    typeof element.tileScaleY === "number"
  );
}

/**
 * Map OOXML tile alignment (`a:tile/@algn`) to a CSS background-position anchor.
 * This determines the origin from which tiles are repeated.
 */
function tileAlignmentToCssPosition(
  alignment: string | undefined,
): string | undefined {
  switch (alignment) {
    case "tl":
      return "top left";
    case "t":
      return "top center";
    case "tr":
      return "top right";
    case "l":
      return "center left";
    case "ctr":
      return "center center";
    case "r":
      return "center right";
    case "bl":
      return "bottom left";
    case "b":
      return "bottom center";
    case "br":
      return "bottom right";
    default:
      return undefined;
  }
}

export function getImageTilingStyle(
  element: PptxElement,
): React.CSSProperties | undefined {
  if (!isImageLikeElement(element) || !isImageTiled(element)) return undefined;
  const scaleX =
    typeof element.tileScaleX === "number" ? element.tileScaleX * 100 : 100;
  const scaleY =
    typeof element.tileScaleY === "number" ? element.tileScaleY * 100 : 100;
  const offsetX =
    typeof element.tileOffsetX === "number" ? element.tileOffsetX : 0;
  const offsetY =
    typeof element.tileOffsetY === "number" ? element.tileOffsetY : 0;

  // Tile alignment determines the starting anchor for the tile grid.
  // If explicit offsets are provided, they override the alignment anchor.
  const alignmentPosition = tileAlignmentToCssPosition(element.tileAlignment);
  const hasExplicitOffset = offsetX !== 0 || offsetY !== 0;
  const bgPosition = hasExplicitOffset
    ? `${offsetX}px ${offsetY}px`
    : alignmentPosition || `${offsetX}px ${offsetY}px`;

  return {
    backgroundImage:
      element.svgData || element.imageData
        ? `url(${element.svgData || element.imageData})`
        : undefined,
    backgroundRepeat: "repeat",
    backgroundSize: `${scaleX}% ${scaleY}%`,
    backgroundPosition: bgPosition,
    width: "100%",
    height: "100%",
  };
}
