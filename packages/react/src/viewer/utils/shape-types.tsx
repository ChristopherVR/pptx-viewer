/**
 * Shape type resolution and CSS clip-path generation utilities.
 *
 * Maps raw OOXML shape type strings to the viewer's internal `SupportedShapeType`
 * enum, and generates CSS `clip-path` polygon/inset strings for non-rectangular shapes.
 */
import { SupportedShapeType } from "../types";

/**
 * Maps a raw OOXML shape type string to the viewer's `SupportedShapeType`.
 * Performs case-insensitive matching. Defaults to `"rect"` for unknown/empty types.
 * @param shapeType - The OOXML shape type string (e.g. "roundRect", "ellipse").
 * @returns The canonical `SupportedShapeType` value.
 */
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
  if (normalized === "rttriangle") return "rtTriangle";
  if (normalized === "diamond") return "diamond";
  if (normalized === "line") return "line";
  if (normalized === "parallelogram") return "parallelogram";
  if (normalized === "trapezoid") return "trapezoid";
  if (normalized === "pentagon") return "pentagon";
  if (normalized === "hexagon") return "hexagon";
  if (normalized === "octagon") return "octagon";
  if (normalized === "chevron") return "chevron";
  if (normalized === "star5") return "star5";
  if (normalized === "star6") return "star6";
  if (normalized === "star8") return "star8";
  if (normalized === "plus") return "plus";
  if (normalized === "heart") return "heart";
  if (normalized === "cloud") return "cloud";
  if (normalized === "sun") return "sun";
  if (normalized === "moon") return "moon";
  if (normalized === "pie") return "pie";
  if (normalized === "plaque") return "plaque";
  if (normalized === "teardrop") return "teardrop";
  if (normalized === "rtarrow" || normalized === "rightarrow") return "rtArrow";
  if (normalized === "leftarrow") return "leftArrow";
  if (normalized === "uparrow") return "upArrow";
  if (normalized === "downarrow") return "downArrow";
  if (normalized.includes("connector")) return "connector";
  if (normalized === "connector") return "connector";
  return "rect";
}

/**
 * Generates a CSS `clip-path` value for a given OOXML shape type.
 * Uses polygon coordinates for complex shapes (arrows, stars, hearts, etc.)
 * and `inset()` with rounded corners for rounded-rect variants.
 * Returns `undefined` for shapes that do not need clipping (rect, cylinder).
 * @param shapeType - The OOXML shape type string.
 * @param adjustments - Optional shape adjustment values (e.g. corner radius for rounded rects).
 * @param width - Element width in pixels (used for adjustment ratio calculations).
 * @param height - Element height in pixels (used for adjustment ratio calculations).
 * @returns A CSS clip-path string, or `undefined`.
 */
export function getShapeClipPath(
  shapeType: string | undefined,
  adjustments?: Record<string, number>,
  width?: number,
  height?: number,
): string | undefined {
  if (!shapeType) return undefined;
  const normalized = shapeType.toLowerCase();
  if (
    normalized === "round1rect" ||
    normalized === "round2samerect" ||
    normalized === "round2diagrect" ||
    normalized === "sniproundrect" ||
    normalized === "snip1rect" ||
    normalized === "snip2diagrect"
  ) {
    if (adjustments?.adj !== undefined && width && height) {
      const ratio = Math.min(Math.max(adjustments.adj / 100000, 0), 0.5);
      const radiusPx = Math.round(Math.min(width, height) * ratio);
      return `inset(0 round ${radiusPx}px)`;
    }
    return "inset(0 round 18px)";
  }
  if (normalized === "can" || normalized === "cylinder") {
    return undefined;
  }
  if (normalized === "donut") {
    return "circle(50% at 50% 50%)";
  }
  if (normalized === "triangle") {
    return "polygon(50% 0%, 0% 100%, 100% 100%)";
  }
  if (normalized === "rttriangle") {
    return "polygon(0% 0%, 100% 100%, 0% 100%)";
  }
  if (normalized === "diamond") {
    return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
  }
  if (normalized === "parallelogram") {
    return "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)";
  }
  if (normalized === "trapezoid") {
    return "polygon(18% 0%, 82% 0%, 100% 100%, 0% 100%)";
  }
  if (normalized === "pentagon") {
    return "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
  }
  if (normalized === "hexagon") {
    return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
  }
  if (normalized === "octagon") {
    return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
  }
  if (normalized === "chevron") {
    return "polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%)";
  }
  if (normalized === "rtarrow" || normalized === "rightarrow") {
    return "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";
  }
  if (normalized === "leftarrow") {
    return "polygon(40% 0%, 40% 20%, 100% 20%, 100% 80%, 40% 80%, 40% 100%, 0% 50%)";
  }
  if (normalized === "uparrow") {
    return "polygon(50% 0%, 100% 40%, 80% 40%, 80% 100%, 20% 100%, 20% 40%, 0% 40%)";
  }
  if (normalized === "downarrow") {
    return "polygon(20% 0%, 80% 0%, 80% 60%, 100% 60%, 50% 100%, 0% 60%, 20% 60%)";
  }
  if (normalized === "star5") {
    return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
  }
  if (normalized === "star6") {
    return "polygon(50% 0%, 61% 20%, 84% 20%, 68% 38%, 76% 60%, 50% 48%, 24% 60%, 32% 38%, 16% 20%, 39% 20%)";
  }
  if (normalized === "star8") {
    return "polygon(50% 0%, 58% 20%, 78% 12%, 70% 32%, 92% 40%, 72% 50%, 92% 60%, 70% 68%, 78% 88%, 58% 80%, 50% 100%, 42% 80%, 22% 88%, 30% 68%, 8% 60%, 28% 50%, 8% 40%, 30% 32%, 22% 12%, 42% 20%)";
  }
  if (normalized === "plus") {
    return "polygon(36% 0%, 64% 0%, 64% 36%, 100% 36%, 100% 64%, 64% 64%, 64% 100%, 36% 100%, 36% 64%, 0% 64%, 0% 36%, 36% 36%)";
  }
  if (normalized === "heart") {
    return "polygon(50% 92%, 18% 60%, 8% 36%, 20% 16%, 38% 16%, 50% 30%, 62% 16%, 80% 16%, 92% 36%, 82% 60%)";
  }
  if (normalized === "cloud") {
    return "polygon(16% 62%, 10% 52%, 12% 42%, 20% 36%, 30% 36%, 38% 28%, 50% 24%, 62% 28%, 70% 36%, 82% 36%, 90% 44%, 90% 56%, 84% 64%, 74% 68%, 24% 68%)";
  }
  if (normalized === "sun") {
    return "polygon(50% 0%, 58% 14%, 74% 8%, 72% 24%, 88% 24%, 80% 38%, 94% 50%, 80% 62%, 88% 76%, 72% 76%, 74% 92%, 58% 86%, 50% 100%, 42% 86%, 26% 92%, 28% 76%, 12% 76%, 20% 62%, 6% 50%, 20% 38%, 12% 24%, 28% 24%, 26% 8%, 42% 14%)";
  }
  if (normalized === "moon") {
    return "polygon(62% 2%, 44% 6%, 30% 18%, 24% 34%, 24% 50%, 30% 66%, 44% 78%, 62% 82%, 48% 70%, 42% 56%, 42% 44%, 48% 30%)";
  }
  if (normalized === "pie") {
    return "polygon(50% 50%, 50% 0%, 88% 16%, 100% 50%, 84% 84%, 50% 100%, 16% 84%, 0% 50%, 16% 16%)";
  }
  if (normalized === "plaque") {
    return "polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)";
  }
  if (normalized === "teardrop") {
    return "polygon(50% 0%, 66% 18%, 78% 36%, 84% 54%, 78% 72%, 64% 86%, 50% 100%, 36% 86%, 22% 72%, 16% 54%, 22% 36%, 34% 18%)";
  }
  return undefined;
}
