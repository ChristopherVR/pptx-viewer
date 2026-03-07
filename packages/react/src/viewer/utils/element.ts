import type {
  PptxComment,
  PptxElement,
  PptxElementWithText,
  GroupPptxElement,
  OlePptxElement,
} from "pptx-viewer-core";
import { hasShapeProperties } from "pptx-viewer-core";
import { getShapeType } from "./shape-types";

export function isTemplateElement(element: PptxElement): boolean {
  return element.id.startsWith("layout-") || element.id.startsWith("master-");
}

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

export function getCommentMarkerPosition(
  comment: PptxComment,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
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
