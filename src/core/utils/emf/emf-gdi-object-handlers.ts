/**
 * EMF GDI object creation, selection, and deletion record handlers.
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import {
  EMR_CREATEPEN,
  EMR_EXTCREATEPEN,
  EMR_CREATEBRUSHINDIRECT,
  EMR_EXTCREATEFONTINDIRECTW,
  EMR_SELECTOBJECT,
  EMR_DELETEOBJECT,
  STOCK_OBJECT_BASE,
} from "./emf-constants";
import { readColorRef } from "./emf-color-helpers";
import { readUtf16LE, getStockObject } from "./emf-canvas-helpers";

// ---------------------------------------------------------------------------
// Object record handler
// ---------------------------------------------------------------------------

export function handleEmfObjectRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { view, state } = rCtx;

  switch (recType) {
    case EMR_CREATEPEN: {
      if (recSize >= 28) {
        const ihPen = view.getUint32(dataOff, true);
        const penStyle = view.getUint32(dataOff + 4, true);
        const widthX = view.getInt32(dataOff + 8, true);
        const color = readColorRef(view, dataOff + 16);
        rCtx.objectTable.set(ihPen, {
          kind: "pen",
          style: penStyle & 0xff,
          widthX,
          color,
        });
      }
      return true;
    }
    case EMR_EXTCREATEPEN: {
      if (recSize >= 52) {
        const ihPen = view.getUint32(dataOff, true);
        const penStyle = view.getUint32(dataOff + 12, true);
        const widthX = view.getInt32(dataOff + 16, true);
        const color = readColorRef(view, dataOff + 24);
        rCtx.objectTable.set(ihPen, {
          kind: "pen",
          style: penStyle & 0xff,
          widthX,
          color,
        });
      }
      return true;
    }
    case EMR_CREATEBRUSHINDIRECT: {
      if (recSize >= 24) {
        const ihBrush = view.getUint32(dataOff, true);
        const brushStyle = view.getUint32(dataOff + 4, true);
        const color = readColorRef(view, dataOff + 8);
        rCtx.objectTable.set(ihBrush, {
          kind: "brush",
          style: brushStyle,
          color,
        });
      }
      return true;
    }
    case EMR_EXTCREATEFONTINDIRECTW: {
      if (recSize >= 332) {
        const ihFont = view.getUint32(dataOff, true);
        const height = view.getInt32(dataOff + 4, true);
        const weight = view.getInt32(dataOff + 20, true);
        const italic = view.getUint8(dataOff + 24);
        const family = readUtf16LE(view, dataOff + 28, 32) || "sans-serif";
        rCtx.objectTable.set(ihFont, {
          kind: "font",
          height: Math.abs(height),
          weight,
          italic: italic !== 0,
          family,
        });
      }
      return true;
    }
    case EMR_SELECTOBJECT: {
      if (recSize >= 12) {
        const ihObject = view.getUint32(dataOff, true);
        const obj =
          ihObject >= STOCK_OBJECT_BASE
            ? getStockObject(ihObject - STOCK_OBJECT_BASE)
            : (rCtx.objectTable.get(ihObject) ?? null);
        if (obj) {
          switch (obj.kind) {
            case "pen":
              state.penStyle = obj.style;
              state.penWidth = obj.widthX;
              state.penColor = obj.color;
              break;
            case "brush":
              state.brushStyle = obj.style;
              state.brushColor = obj.color;
              break;
            case "font":
              state.fontHeight = obj.height;
              state.fontWeight = obj.weight;
              state.fontItalic = obj.italic;
              state.fontFamily = obj.family;
              break;
          }
        }
      }
      return true;
    }
    case EMR_DELETEOBJECT: {
      if (recSize >= 12) {
        rCtx.objectTable.delete(view.getUint32(dataOff, true));
      }
      return true;
    }
    default:
      return false;
  }
}
