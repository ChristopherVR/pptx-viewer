/**
 * Framework-agnostic element utility functions.
 *
 * XML builders live in `./element-xml-builders.ts`;
 * action helpers live in `./element-actions.ts`.
 */
import type {
  PptxElement,
  PptxElementWithText,
  TextSegment,
  TextStyle,
} from "../types";
import { hasTextProperties } from "../types";
import { cloneTextStyle } from "./clone-utils";

// Re-export split modules for backward compatibility.
export {
  createTemplateShapeRawXml,
  createTemplateConnectorRawXml,
} from "./element-xml-builders";
export {
  pptxActionToElementAction,
  elementActionToPptxAction,
  elementHasAction,
} from "./element-actions";

// ---------------------------------------------------------------------------
// Element identity helpers
// ---------------------------------------------------------------------------

export function isTemplateElement(element: PptxElement): boolean {
  return element.id.startsWith("layout-") || element.id.startsWith("master-");
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
  if (element.type === "ole") return "Embedded Object";
  if (element.type === "media") return "Media";

  return "Shape";
}

export function shouldRenderFallbackLabel(
  element: PptxElement,
  isTextElement: boolean,
): boolean {
  if (isTextElement) return false;
  if (element.type === "shape" || element.type === "connector") return false;
  if (element.type === "picture" || element.type === "image") return false;
  if (element.type === "table") return false;
  return (
    element.type === "chart" ||
    element.type === "smartArt" ||
    element.type === "ole" ||
    element.type === "media" ||
    element.type === "unknown"
  );
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function getElementTextContent(element: PptxElement): string {
  if (!hasTextProperties(element)) return "";
  if (typeof element.text === "string") return element.text;
  if (!element.textSegments || element.textSegments.length === 0) return "";
  return element.textSegments
    .map((segment) => String(segment.text || ""))
    .join("");
}

export function createUniformTextSegments(
  text: string,
  style: TextStyle | undefined,
): TextSegment[] {
  return [
    {
      text,
      style: cloneTextStyle(style) || {},
    },
  ];
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function createEditorId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// ---------------------------------------------------------------------------
// Buffer copy
// ---------------------------------------------------------------------------

export function createArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

// ---------------------------------------------------------------------------
// Array normalisation
// ---------------------------------------------------------------------------

export function ensureArrayValue<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

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
  comment: { x?: number; y?: number },
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

// ---------------------------------------------------------------------------
// File reader helper
// ---------------------------------------------------------------------------

export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read image file."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };
    reader.readAsDataURL(file);
  });
}
