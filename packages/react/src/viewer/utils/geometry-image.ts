/**
 * Miscellaneous geometry helpers for the PowerPoint editor.
 *
 * Barrel re-export - implementation split into:
 * - `image-style` (image mask, render style, crop, tiling)
 * - `shape-adjustment` (shape adjustment handle helpers)
 */
import type { PptxElement } from "pptx-viewer-core";
import { GRID_SIZE } from "../constants";

export {
  getImageMaskStyle,
  getImageRenderStyle,
  getCropShapeClipPath,
  isImageTiled,
  getImageTilingStyle,
} from "./image-style";

export {
  clampShapeAdjustmentValue,
  getRoundRectAdjustmentValue,
  getRoundRectRadiusPx,
  getShapeAdjustmentHandleDescriptor,
  getDraggedShapeAdjustmentValue,
} from "./shape-adjustment";

// ---------------------------------------------------------------------------
// Miscellaneous helpers
// ---------------------------------------------------------------------------

export function shouldRenderFallbackLabel(
  element: PptxElement,
  isTextElement: boolean,
): boolean {
  if (isTextElement) return false;
  if (element.type === "shape" || element.type === "connector") return false;
  if (element.type === "picture" || element.type === "image") return false;
  if (element.type === "table") return false;
  if (element.type === "media") return false; // media has dedicated renderer
  if (element.type === "contentPart") return false; // content part has dedicated renderer
  if (element.type === "model3d") return false; // rendered as poster image
  if (element.type === "ole") {
    // OLE elements with a preview image are rendered as images, not fallback labels
    const previewData =
      (element as { previewImageData?: string }).previewImageData ??
      (element as { previewImage?: string }).previewImage;
    return !previewData;
  }
  return (
    element.type === "chart" ||
    element.type === "smartArt" ||
    element.type === "unknown"
  );
}

export function ensureArrayValue<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Snap / grid helpers
// ---------------------------------------------------------------------------

export function snapToGridValue(value: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}
