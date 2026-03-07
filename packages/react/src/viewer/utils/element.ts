/**
 * Element utility functions for the PowerPoint viewer/editor.
 *
 * Provides helpers for identifying element types (template, connector, text),
 * generating labels, computing comment marker positions, and resolving
 * connection-site coordinates.
 */
import type {
  PptxComment,
  PptxElement,
  PptxElementWithText,
  GroupPptxElement,
  OlePptxElement,
} from "pptx-viewer-core";
import { hasShapeProperties } from "pptx-viewer-core";
import { getShapeType } from "./shape-types";

/**
 * Checks whether an element originates from a slide layout or slide master.
 * Template elements have IDs prefixed with "layout-" or "master-".
 * @param element - The element to test.
 * @returns `true` if the element belongs to a layout or master.
 */
export function isTemplateElement(element: PptxElement): boolean {
  return element.id.startsWith("layout-") || element.id.startsWith("master-");
}

/**
 * Checks whether an element ID indicates a template (layout or master) element.
 * @param elementId - The element ID string to test.
 * @returns `true` if the ID starts with "layout-" or "master-".
 */
export function isTemplateElementId(elementId: string): boolean {
  return elementId.startsWith("layout-") || elementId.startsWith("master-");
}

/**
 * Returns true if the element is a connector or line — i.e. it renders
 * as an SVG path rather than a filled rectangular box.  These elements
 * need special hit-testing and selection treatment.
 */
export function isConnectorOrLineElement(element: PptxElement): boolean {
  if (element.type === "connector") return true;
  if (!hasShapeProperties(element)) return false;
  const st = getShapeType(element.shapeType);
  return st === "connector" || st === "line" || element.shapeType === "line";
}

/**
 * Type-guard that returns `true` if the element can have its text edited inline.
 * An element is considered editable if it is a "text" or "shape" element that
 * contains text content (plain string or text segments).
 * @param element - The element to test.
 * @returns `true` if the element is a text-bearing element.
 */
export function isEditableTextElement(
  element: PptxElement,
): element is PptxElementWithText {
  if (element.type !== "text" && element.type !== "shape") {
    return false;
  }
  return (
    element.type === "text" ||
    typeof element.text === "string" ||
    (element.textSegments?.length ?? 0) > 0
  );
}

/**
 * Returns a human-readable label for a given element, suitable for display
 * in the selection pane, accessibility tree, or tooltip.
 * @param element - The element to label.
 * @returns A descriptive string such as "Text", "Image", "Group (3)", etc.
 */
export function getElementLabel(element: PptxElement): string {
  if (element.type === "text") return "Text";
  if (element.type === "connector") return "Connector";
  if (element.type === "image" || element.type === "picture") return "Image";
  if (element.type === "chart") return "Chart";
  if (element.type === "table") return "Table";
  if (element.type === "smartArt") return "SmartArt";
  if (element.type === "ole") {
    const ole = element as OlePptxElement;
    if (ole.oleName) return ole.oleName;
    if (ole.fileName) return ole.fileName;
    return "Embedded Object";
  }
  if (element.type === "media") return "Media";
  if (element.type === "ink") return "Drawing";
  if (element.type === "contentPart") return "Content Part";
  if (element.type === "group")
    return `Group (${(element as GroupPptxElement).children?.length ?? 0})`;
  return "Shape";
}

/**
 * Formats a raw ISO/date-string timestamp into a short localized display format.
 * Returns an empty string if the value is missing or cannot be parsed.
 * @param value - An ISO-8601 date string or undefined.
 * @returns A formatted string like "Mar 7, 10:30 AM", or "".
 */
export function formatCommentTimestamp(value: string | undefined): string {
  const normalized = String(value || "").trim();
  if (normalized.length === 0) return "";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Computes the rendered position for a comment marker icon on the slide canvas.
 * If the comment carries explicit x/y coordinates they are used (clamped to
 * the slide area); otherwise a grid-based fallback position is computed from
 * the comment's index so markers do not overlap.
 * @param comment - The comment object (may contain x/y).
 * @param index - Zero-based index of the comment on the slide.
 * @param width - Slide width in pixels.
 * @param height - Slide height in pixels.
 * @returns An `{x, y}` position clamped within the visible slide area.
 */
export function getCommentMarkerPosition(
  comment: PptxComment,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
  // Distribute fallback positions on a 4-column grid
  const fallbackX = 18 + (index % 4) * 14;
  const fallbackY = 18 + Math.floor(index / 4) * 14;
  const rawX =
    typeof comment.x === "number" && Number.isFinite(comment.x)
      ? comment.x
      : fallbackX;
  const rawY =
    typeof comment.y === "number" && Number.isFinite(comment.y)
      ? comment.y
      : fallbackY;

  return {
    x: Math.min(Math.max(rawX, 8), Math.max(width - 8, 8)),
    y: Math.min(Math.max(rawY, 8), Math.max(height - 8, 8)),
  };
}

/**
 * Returns the absolute position of a connection site on an element.
 *
 * Connection sites are numbered 0-3 following the OOXML convention:
 *   0 = top-centre, 1 = right-centre, 2 = bottom-centre, 3 = left-centre.
 *
 * Returns `undefined` for out-of-range site indices.
 */
export function getConnectionSitePosition(
  element: PptxElement,
  siteIndex: number,
): { x: number; y: number } | undefined {
  switch (siteIndex) {
    case 0: // top centre
      return { x: element.x + element.width / 2, y: element.y };
    case 1: // right centre
      return {
        x: element.x + element.width,
        y: element.y + element.height / 2,
      };
    case 2: // bottom centre
      return {
        x: element.x + element.width / 2,
        y: element.y + element.height,
      };
    case 3: // left centre
      return { x: element.x, y: element.y + element.height / 2 };
    default:
      return undefined;
  }
}
