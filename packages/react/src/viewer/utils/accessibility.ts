/**
 * Accessibility utilities for the PowerPoint viewer.
 *
 * Provides functions for computing reading order, generating ARIA labels,
 * determining ARIA roles, and detecting reduced-motion preferences.
 *
 * @module utils/accessibility
 */

import type { PptxElement } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Reading order
// ---------------------------------------------------------------------------

/**
 * Computes a reading-order index for each element on a slide.
 *
 * Elements are sorted top-to-bottom first, then left-to-right for elements
 * at roughly the same vertical position (within a tolerance band).
 * Returns a `Map<elementId, tabIndex>` with 1-based indices.
 *
 * @param elements - The flat list of elements on the current slide.
 * @param tolerancePx - Vertical tolerance for grouping elements into the
 *   same "row" (default 20px).
 * @returns Map from element ID to 1-based reading order index.
 */
export function computeReadingOrder(
  elements: readonly PptxElement[],
  tolerancePx = 20,
): Map<string, number> {
  if (elements.length === 0) return new Map();

  const sorted = [...elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => {
      const dy = a.y - b.y;
      if (Math.abs(dy) > tolerancePx) return dy;
      return a.x - b.x;
    });

  const result = new Map<string, number>();
  sorted.forEach((el, idx) => {
    result.set(el.id, idx + 1);
  });
  return result;
}

// ---------------------------------------------------------------------------
// ARIA roles
// ---------------------------------------------------------------------------

/**
 * Maps a PptxElement to its appropriate ARIA role.
 *
 * - image / picture => "img"
 * - table => "table"
 * - group => "group"
 * - chart => "img" (complex visualisation treated as image)
 * - text / shape with text => "text" is not valid; use undefined and rely on
 *   aria-label alone. However, shapes without text act as decorative images.
 * - connector => "img"
 * - media => "application"
 *
 * @param element - The element to determine a role for.
 * @returns The ARIA role string, or undefined when none is needed.
 */
export function getAriaRole(element: PptxElement): string | undefined {
  switch (element.type) {
    case "image":
    case "picture":
      return "img";
    case "table":
      return "table";
    case "group":
      return "group";
    case "chart":
      return "img";
    case "smartArt":
      return "img";
    case "connector":
      return "img";
    case "media":
      return "application";
    case "ink":
      return "img";
    case "model3d":
      return "img";
    case "text":
      return undefined;
    case "shape": {
      // Shapes with text act as text containers; shapes without text are decorative
      if (hasTextProperties(element) && element.text) {
        return undefined;
      }
      return "img";
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// ARIA labels
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable ARIA label for an element.
 *
 * Priority:
 * 1. Image altText (for image/picture elements)
 * 2. Text content (for text-bearing elements)
 * 3. Chart title (from chartData)
 * 4. Element type fallback label
 *
 * @param element - The element to generate a label for.
 * @returns A descriptive string for the `aria-label` attribute.
 */
export function getAriaLabel(element: PptxElement): string {
  // Image alt text
  if (
    (element.type === "image" || element.type === "picture") &&
    "altText" in element &&
    typeof element.altText === "string" &&
    element.altText.trim()
  ) {
    return element.altText.trim();
  }

  // Text content
  if (hasTextProperties(element) && element.text) {
    const text = element.text.trim();
    if (text) {
      // Truncate long text for the label
      return text.length > 120 ? text.slice(0, 117) + "..." : text;
    }
  }

  // Chart title
  if (element.type === "chart" && "chartData" in element && element.chartData) {
    const cd = element.chartData as { title?: string };
    if (cd.title) return `Chart: ${cd.title}`;
    return "Chart";
  }

  // SmartArt
  if (element.type === "smartArt") return "SmartArt diagram";

  // Table
  if (element.type === "table") return "Table";

  // Media
  if (element.type === "media") return "Media element";

  // Group
  if (element.type === "group") return "Group of elements";

  // Connector
  if (element.type === "connector") return "Connector line";

  // Ink
  if (element.type === "ink") return "Ink drawing";

  // 3D Model
  if (element.type === "model3d") return "3D Model";

  // Shape fallback
  if (element.type === "shape") {
    if ("shapeType" in element && element.shapeType) {
      return `Shape: ${element.shapeType}`;
    }
    return "Shape";
  }

  // Generic fallback
  return getTypeFallbackLabel(element.type);
}

/**
 * Returns a user-friendly fallback label based on element type.
 */
function getTypeFallbackLabel(type: string): string {
  switch (type) {
    case "text":
      return "Text box";
    case "shape":
      return "Shape";
    case "image":
    case "picture":
      return "Image";
    case "table":
      return "Table";
    case "chart":
      return "Chart";
    case "connector":
      return "Connector";
    case "group":
      return "Group";
    case "smartArt":
      return "SmartArt";
    case "media":
      return "Media";
    case "ink":
      return "Drawing";
    case "ole":
      return "Embedded object";
    case "contentPart":
      return "Content part";
    case "model3d":
      return "3D Model";
    default:
      return "Element";
  }
}

// ---------------------------------------------------------------------------
// Reduced motion detection
// ---------------------------------------------------------------------------

/**
 * Queries the `prefers-reduced-motion: reduce` media query.
 *
 * @returns `true` if the user prefers reduced motion, `false` otherwise.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
