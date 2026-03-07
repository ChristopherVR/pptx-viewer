/**
 * EMF+ shape fill/draw record handlers.
 *
 * Handles: FillRects, DrawRects, FillEllipse, DrawEllipse,
 * FillPie, DrawPie, DrawArc, DrawLines, FillPolygon.
 */

import type { CanvasContext, EmfPlusReplayCtx } from "./emf-types";
import {
  EMFPLUS_FILLRECTS,
  EMFPLUS_DRAWRECTS,
  EMFPLUS_FILLELLIPSE,
  EMFPLUS_DRAWELLIPSE,
  EMFPLUS_FILLPIE,
  EMFPLUS_DRAWPIE,
  EMFPLUS_DRAWARC,
  EMFPLUS_DRAWLINES,
  EMFPLUS_FILLPOLYGON,
} from "./emf-constants";
import {
  resolveBrushColor,
  applyPlusWorldTransform,
} from "./emf-plus-state-handlers";
import { readRectFromView, readPointFromView } from "./emf-plus-read-helpers";

/**
 * Apply an EMF+ pen to the canvas context (stroke colour, line width, dash pattern).
 */
function applyEmfPlusPen(
  ctx: CanvasContext,
  pen: { color: string; width: number; dashStyle: number },
): void {
  ctx.strokeStyle = pen.color;
  ctx.lineWidth = pen.width;
  const w = pen.width || 1;
  switch (pen.dashStyle) {
    case 1: ctx.setLineDash([w * 3, w * 1]); break;                             // Dash
    case 2: ctx.setLineDash([w * 1, w * 1]); break;                             // Dot
    case 3: ctx.setLineDash([w * 3, w * 1, w * 1, w * 1]); break;              // DashDot
    case 4: ctx.setLineDash([w * 3, w * 1, w * 1, w * 1, w * 1, w * 1]); break; // DashDotDot
    default: ctx.setLineDash([]); break;                                        // Solid or Custom
  }
}

export function handleEmfPlusDrawRecord(
  rCtx: EmfPlusReplayCtx,
  recType: number,
  recFlags: number,
  dataOff: number,
  recDataSize: number,
): boolean {
  const { ctx, view, objectTable } = rCtx;

  switch (recType) {
    case EMFPLUS_FILLRECTS: {
      if (recDataSize >= 8) {
        const brushVal = view.getUint32(dataOff, true);
        const count = view.getUint32(dataOff + 4, true);
        const compressed = (recFlags & 0x4000) !== 0;
        const rectSize = compressed ? 8 : 16;
        ctx.fillStyle = resolveBrushColor(rCtx, recFlags, brushVal);
        applyPlusWorldTransform(rCtx);
        let rOff = dataOff + 8;
        for (
          let i = 0;
          i < count && rOff + rectSize <= dataOff + recDataSize;
          i++
        ) {
          const { x, y, w, h } = readRectFromView(view, rOff, compressed);
          ctx.fillRect(x, y, w, h);
          rOff += rectSize;
        }
      }
      return true;
    }

    case EMFPLUS_DRAWRECTS: {
      if (recDataSize >= 4) {
        const penId = recFlags & 0xff;
        const pen = objectTable.get(penId);
        const count = view.getUint32(dataOff, true);
        const compressed = (recFlags & 0x4000) !== 0;
        const rectSize = compressed ? 8 : 16;
        if (pen && pen.kind === "plus-pen") {
          applyEmfPlusPen(ctx, pen);
        }
        applyPlusWorldTransform(rCtx);
        let rOff = dataOff + 4;
        for (
          let i = 0;
          i < count && rOff + rectSize <= dataOff + recDataSize;
          i++
        ) {
          const { x, y, w, h } = readRectFromView(view, rOff, compressed);
          ctx.strokeRect(x, y, w, h);
          rOff += rectSize;
        }
      }
      return true;
    }

    case EMFPLUS_FILLELLIPSE: {
      if (recDataSize >= 12) {
        const brushVal = view.getUint32(dataOff, true);
        const compressed = (recFlags & 0x4000) !== 0;
        let x: number, y: number, w: number, h: number;
        if (compressed) {
          x = view.getInt16(dataOff + 4, true);
          y = view.getInt16(dataOff + 6, true);
          w = view.getInt16(dataOff + 8, true);
          h = view.getInt16(dataOff + 10, true);
        } else {
          if (recDataSize < 20) return true;
          x = view.getFloat32(dataOff + 4, true);
          y = view.getFloat32(dataOff + 8, true);
          w = view.getFloat32(dataOff + 12, true);
          h = view.getFloat32(dataOff + 16, true);
        }
        ctx.fillStyle = resolveBrushColor(rCtx, recFlags, brushVal);
        applyPlusWorldTransform(rCtx);
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2,
          y + h / 2,
          Math.abs(w) / 2,
          Math.abs(h) / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      return true;
    }

    case EMFPLUS_DRAWELLIPSE: {
      const penId = recFlags & 0xff;
      const pen = objectTable.get(penId);
      const compressed = (recFlags & 0x4000) !== 0;
      let x: number, y: number, w: number, h: number;
      if (compressed && recDataSize >= 8) {
        x = view.getInt16(dataOff, true);
        y = view.getInt16(dataOff + 2, true);
        w = view.getInt16(dataOff + 4, true);
        h = view.getInt16(dataOff + 6, true);
      } else if (!compressed && recDataSize >= 16) {
        x = view.getFloat32(dataOff, true);
        y = view.getFloat32(dataOff + 4, true);
        w = view.getFloat32(dataOff + 8, true);
        h = view.getFloat32(dataOff + 12, true);
      } else {
        return true;
      }
      if (pen && pen.kind === "plus-pen") {
        applyEmfPlusPen(ctx, pen);
      }
      applyPlusWorldTransform(rCtx);
      ctx.beginPath();
      ctx.ellipse(
        x + w / 2,
        y + h / 2,
        Math.abs(w) / 2,
        Math.abs(h) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      return true;
    }

    case EMFPLUS_FILLPIE:
    case EMFPLUS_DRAWPIE:
    case EMFPLUS_DRAWARC: {
      const isFill = recType === EMFPLUS_FILLPIE;
      const minSize = isFill ? 12 : 8;
      if (recDataSize < minSize) return true;

      let aOff = dataOff;
      if (isFill) {
        const brushVal = view.getUint32(aOff, true);
        ctx.fillStyle = resolveBrushColor(rCtx, recFlags, brushVal);
        aOff += 4;
      }
      const startAngle = (view.getFloat32(aOff, true) * Math.PI) / 180;
      const sweepAngle = (view.getFloat32(aOff + 4, true) * Math.PI) / 180;
      aOff += 8;

      const compressed = (recFlags & 0x4000) !== 0;
      let x: number, y: number, w: number, h: number;
      if (compressed && aOff + 8 <= dataOff + recDataSize) {
        x = view.getInt16(aOff, true);
        y = view.getInt16(aOff + 2, true);
        w = view.getInt16(aOff + 4, true);
        h = view.getInt16(aOff + 6, true);
      } else if (!compressed && aOff + 16 <= dataOff + recDataSize) {
        x = view.getFloat32(aOff, true);
        y = view.getFloat32(aOff + 4, true);
        w = view.getFloat32(aOff + 8, true);
        h = view.getFloat32(aOff + 12, true);
      } else {
        return true;
      }

      if (recType !== EMFPLUS_FILLPIE) {
        const penId = recFlags & 0xff;
        const pen = objectTable.get(penId);
        if (pen && pen.kind === "plus-pen") {
          applyEmfPlusPen(ctx, pen);
        }
      }

      applyPlusWorldTransform(rCtx);
      ctx.beginPath();
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = Math.abs(w) / 2;
      const ry = Math.abs(h) / 2;
      if (isFill) ctx.moveTo(cx, cy);
      ctx.ellipse(
        cx,
        cy,
        rx,
        ry,
        0,
        startAngle,
        startAngle + sweepAngle,
        sweepAngle < 0,
      );
      if (isFill) {
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.stroke();
      }
      return true;
    }

    case EMFPLUS_DRAWLINES: {
      if (recDataSize >= 4) {
        const penId = recFlags & 0xff;
        const pen = objectTable.get(penId);
        const count = view.getUint32(dataOff, true);
        const compressed = (recFlags & 0x4000) !== 0;
        const ptSize = compressed ? 4 : 8;
        if (pen && pen.kind === "plus-pen") {
          applyEmfPlusPen(ctx, pen);
        }
        applyPlusWorldTransform(rCtx);
        ctx.beginPath();
        let pOff = dataOff + 4;
        for (
          let i = 0;
          i < count && pOff + ptSize <= dataOff + recDataSize;
          i++
        ) {
          const pt = readPointFromView(view, pOff, compressed);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
          pOff += ptSize;
        }
        if (recFlags & 0x2000) ctx.closePath();
        ctx.stroke();
      }
      return true;
    }

    case EMFPLUS_FILLPOLYGON: {
      if (recDataSize >= 8) {
        const brushVal = view.getUint32(dataOff, true);
        const count = view.getUint32(dataOff + 4, true);
        const compressed = (recFlags & 0x4000) !== 0;
        const ptSize = compressed ? 4 : 8;
        ctx.fillStyle = resolveBrushColor(rCtx, recFlags, brushVal);
        applyPlusWorldTransform(rCtx);
        ctx.beginPath();
        let pOff = dataOff + 8;
        for (
          let i = 0;
          i < count && pOff + ptSize <= dataOff + recDataSize;
          i++
        ) {
          const pt = readPointFromView(view, pOff, compressed);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
          pOff += ptSize;
        }
        ctx.closePath();
        ctx.fill();
      }
      return true;
    }

    default:
      return false;
  }
}
