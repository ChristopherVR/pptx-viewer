/**
 * Canvas creation, styling, string reading, stock objects, and export helpers.
 */

import type { CanvasContext, DrawState, GdiObject } from "./emf-types";
import { emfLog, emfWarn } from "./emf-logging";

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

export function createCanvas(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasContext;
  scaleX: number;
  scaleY: number;
} | null {
  let w = width;
  let h = height;
  let scaleX = 1;
  let scaleY = 1;

  if (maxWidth && w > maxWidth) {
    const factor = maxWidth / w;
    w = maxWidth;
    h = Math.round(h * factor);
    scaleX = factor;
    scaleY = factor;
  }
  if (maxHeight && h > maxHeight) {
    const factor = maxHeight / h;
    h = maxHeight;
    w = Math.round((w / scaleY) * factor * scaleX);
    scaleX *= factor;
    scaleY *= factor;
  }

  w = Math.max(1, Math.min(w, 4096));
  h = Math.max(1, Math.min(h, 4096));

  try {
    if (typeof OffscreenCanvas !== "undefined") {
      emfLog(
        `createCanvas: using OffscreenCanvas ${w}×${h}, scale=(${scaleX.toFixed(3)},${scaleY.toFixed(3)})`,
      );
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        emfWarn('createCanvas: OffscreenCanvas.getContext("2d") returned null');
        return null;
      }
      return { canvas, ctx, scaleX, scaleY };
    }

    if (typeof document === "undefined") {
      emfWarn(
        "createCanvas: no OffscreenCanvas and no document — cannot create canvas",
      );
      return null;
    }

    emfLog(
      `createCanvas: using HTMLCanvasElement ${w}×${h}, scale=(${scaleX.toFixed(3)},${scaleY.toFixed(3)})`,
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      emfWarn('createCanvas: HTMLCanvasElement.getContext("2d") returned null');
      return null;
    }
    return { canvas, ctx, scaleX, scaleY };
  } catch (err) {
    emfWarn("createCanvas: exception:", err);
    return null;
  }
}

export function createTempCanvas(
  width: number,
  height: number,
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasContext;
} | null {
  if (width <= 0 || height <= 0) return null;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Apply pen/brush/font to context
// ---------------------------------------------------------------------------

export function applyPen(ctx: CanvasContext, state: DrawState): void {
  if (state.penStyle === 5) {
    ctx.strokeStyle = "rgba(0,0,0,0)";
    ctx.lineWidth = 0;
    return;
  }
  ctx.strokeStyle = state.penColor;
  ctx.lineWidth = Math.max(state.penWidth, 1);
  switch (state.penStyle) {
    case 1:
      ctx.setLineDash([8, 4]);
      break;
    case 2:
      ctx.setLineDash([2, 2]);
      break;
    case 3:
      ctx.setLineDash([8, 4, 2, 4]);
      break;
    case 4:
      ctx.setLineDash([8, 4, 2, 4, 2, 4]);
      break;
    default:
      ctx.setLineDash([]);
      break;
  }
}

export function applyBrush(ctx: CanvasContext, state: DrawState): void {
  if (state.brushStyle === 1) {
    ctx.fillStyle = "rgba(0,0,0,0)";
    return;
  }
  ctx.fillStyle = state.brushColor;
}

export function applyFont(ctx: CanvasContext, state: DrawState): void {
  const italic = state.fontItalic ? "italic " : "";
  const weight = state.fontWeight >= 700 ? "bold " : "";
  const size = Math.max(Math.abs(state.fontHeight), 8);
  ctx.font = `${italic}${weight}${size}px ${state.fontFamily}`;
}

// ---------------------------------------------------------------------------
// Read a UTF-16LE string from a DataView
// ---------------------------------------------------------------------------

export function readUtf16LE(
  view: DataView,
  offset: number,
  charCount: number,
): string {
  const chars: string[] = [];
  for (let i = 0; i < charCount; i++) {
    if (offset + i * 2 + 1 >= view.byteLength) break;
    const code = view.getUint16(offset + i * 2, true);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

// ---------------------------------------------------------------------------
// Stock objects (default GDI objects referenced via STOCK_OBJECT_BASE + idx)
// ---------------------------------------------------------------------------

export function getStockObject(index: number): GdiObject | null {
  switch (index) {
    case 0:
      return { kind: "brush", style: 0, color: "#ffffff" };
    case 1:
      return { kind: "brush", style: 0, color: "#c0c0c0" };
    case 2:
      return { kind: "brush", style: 0, color: "#808080" };
    case 3:
      return { kind: "brush", style: 0, color: "#404040" };
    case 4:
      return { kind: "brush", style: 0, color: "#000000" };
    case 5:
      return { kind: "brush", style: 1, color: "#000000" };
    case 6:
      return { kind: "pen", style: 0, widthX: 1, color: "#ffffff" };
    case 7:
      return { kind: "pen", style: 0, widthX: 1, color: "#000000" };
    case 8:
      return { kind: "pen", style: 5, widthX: 0, color: "#000000" };
    case 10:
    case 11:
      return {
        kind: "font",
        height: 12,
        weight: 400,
        italic: false,
        family: "monospace",
      };
    case 12:
    case 13:
    case 14:
    case 17:
      return {
        kind: "font",
        height: 12,
        weight: 400,
        italic: false,
        family: "sans-serif",
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Canvas export helpers
// ---------------------------------------------------------------------------

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportCanvasToPngDataUrl(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<string | null> {
  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    emfLog(
      `exportCanvasToPngDataUrl: using OffscreenCanvas.convertToBlob (${canvas.width}×${canvas.height})`,
    );
    const blob = await canvas.convertToBlob({ type: "image/png" });
    emfLog(
      `exportCanvasToPngDataUrl: blob size=${blob.size} bytes, type=${blob.type}`,
    );
    return blobToDataUrl(blob);
  }

  if (
    typeof HTMLCanvasElement !== "undefined" &&
    canvas instanceof HTMLCanvasElement
  ) {
    emfLog(
      `exportCanvasToPngDataUrl: using HTMLCanvasElement.toDataURL (${canvas.width}×${canvas.height})`,
    );
    return canvas.toDataURL("image/png");
  }

  emfWarn("exportCanvasToPngDataUrl: no canvas type matched — returning null");
  return null;
}
