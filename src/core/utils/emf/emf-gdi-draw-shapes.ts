/**
 * EMF GDI shape record handlers: MoveTo, LineTo, Rectangle, RoundRect,
 * Ellipse, Arc, ArcTo, Chord, and Pie.
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import {
  EMR_MOVETOEX,
  EMR_LINETO,
  EMR_RECTANGLE,
  EMR_ROUNDRECT,
  EMR_ELLIPSE,
  EMR_ARC,
  EMR_ARCTO,
  EMR_CHORD,
  EMR_PIE,
} from "./emf-constants";
import { applyPen, applyBrush } from "./emf-canvas-helpers";
import { gmx, gmy, gmw, gmh } from "./emf-gdi-coord";

// ---------------------------------------------------------------------------
// Individual shape handlers
// ---------------------------------------------------------------------------

function handleMoveToEx(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 16) {
    state.curX = view.getInt32(dataOff, true);
    state.curY = view.getInt32(dataOff + 4, true);
    if (inPath) ctx.moveTo(gmx(rCtx, state.curX), gmy(rCtx, state.curY));
  }
  return true;
}

function handleLineTo(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 16) {
    const lx = view.getInt32(dataOff, true);
    const ly = view.getInt32(dataOff + 4, true);
    if (inPath) {
      ctx.lineTo(gmx(rCtx, lx), gmy(rCtx, ly));
    } else {
      applyPen(ctx, state);
      ctx.beginPath();
      ctx.moveTo(gmx(rCtx, state.curX), gmy(rCtx, state.curY));
      ctx.lineTo(gmx(rCtx, lx), gmy(rCtx, ly));
      ctx.stroke();
    }
    state.curX = lx;
    state.curY = ly;
  }
  return true;
}

function handleRectangle(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 24) {
    const l = view.getInt32(dataOff, true);
    const t = view.getInt32(dataOff + 4, true);
    const r = view.getInt32(dataOff + 8, true);
    const b = view.getInt32(dataOff + 12, true);
    if (inPath) {
      ctx.rect(gmx(rCtx, l), gmy(rCtx, t), gmw(rCtx, r - l), gmh(rCtx, b - t));
    } else {
      applyBrush(ctx, state);
      ctx.fillRect(
        gmx(rCtx, l),
        gmy(rCtx, t),
        gmw(rCtx, r - l),
        gmh(rCtx, b - t),
      );
      applyPen(ctx, state);
      ctx.strokeRect(
        gmx(rCtx, l),
        gmy(rCtx, t),
        gmw(rCtx, r - l),
        gmh(rCtx, b - t),
      );
    }
  }
  return true;
}

function handleRoundRect(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 32) {
    const l = view.getInt32(dataOff, true);
    const t = view.getInt32(dataOff + 4, true);
    const r = view.getInt32(dataOff + 8, true);
    const b = view.getInt32(dataOff + 12, true);
    const rw = Math.abs(gmw(rCtx, view.getInt32(dataOff + 16, true))) / 2;
    const rh = Math.abs(gmh(rCtx, view.getInt32(dataOff + 20, true))) / 2;
    const x1 = gmx(rCtx, l);
    const y1 = gmy(rCtx, t);
    const w = gmw(rCtx, r - l);
    const h = gmh(rCtx, b - t);
    const drawRoundRect = () => {
      const radius = Math.min(rw, rh, w / 2, h / 2);
      ctx.moveTo(x1 + radius, y1);
      ctx.lineTo(x1 + w - radius, y1);
      ctx.arcTo(x1 + w, y1, x1 + w, y1 + radius, radius);
      ctx.lineTo(x1 + w, y1 + h - radius);
      ctx.arcTo(x1 + w, y1 + h, x1 + w - radius, y1 + h, radius);
      ctx.lineTo(x1 + radius, y1 + h);
      ctx.arcTo(x1, y1 + h, x1, y1 + h - radius, radius);
      ctx.lineTo(x1, y1 + radius);
      ctx.arcTo(x1, y1, x1 + radius, y1, radius);
      ctx.closePath();
    };
    if (inPath) {
      drawRoundRect();
    } else {
      ctx.beginPath();
      drawRoundRect();
      applyBrush(ctx, state);
      ctx.fill();
      applyPen(ctx, state);
      ctx.stroke();
    }
  }
  return true;
}

function handleEllipse(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 24) {
    const l = view.getInt32(dataOff, true);
    const t = view.getInt32(dataOff + 4, true);
    const r = view.getInt32(dataOff + 8, true);
    const b = view.getInt32(dataOff + 12, true);
    const cx = gmx(rCtx, (l + r) / 2);
    const cy = gmy(rCtx, (t + b) / 2);
    const rx = Math.abs(gmw(rCtx, r - l)) / 2;
    const ry = Math.abs(gmh(rCtx, b - t)) / 2;
    if (inPath) {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      applyBrush(ctx, state);
      ctx.fill();
      applyPen(ctx, state);
      ctx.stroke();
    }
  }
  return true;
}

function handleArcFamily(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize >= 40) {
    const l = view.getInt32(dataOff, true);
    const t = view.getInt32(dataOff + 4, true);
    const r = view.getInt32(dataOff + 8, true);
    const b = view.getInt32(dataOff + 12, true);
    const startX = view.getInt32(dataOff + 16, true);
    const startY = view.getInt32(dataOff + 20, true);
    const endX = view.getInt32(dataOff + 24, true);
    const endY = view.getInt32(dataOff + 28, true);
    const cxA = (l + r) / 2;
    const cyA = (t + b) / 2;
    const rx = Math.abs(r - l) / 2;
    const ry = Math.abs(b - t) / 2;
    const startAngle = Math.atan2(
      (startY - cyA) / (ry || 1),
      (startX - cxA) / (rx || 1),
    );
    const endAngle = Math.atan2(
      (endY - cyA) / (ry || 1),
      (endX - cxA) / (rx || 1),
    );
    const mcx = gmx(rCtx, cxA);
    const mcy = gmy(rCtx, cyA);
    const mrx = Math.abs(gmw(rCtx, rx));
    const mry = Math.abs(gmh(rCtx, ry));
    const isArcTo = recType === EMR_ARCTO;
    const needsFill = recType === EMR_PIE || recType === EMR_CHORD;
    if (!inPath) ctx.beginPath();
    if (recType === EMR_PIE) ctx.moveTo(mcx, mcy);
    if (isArcTo) {
      ctx.lineTo(
        mcx + mrx * Math.cos(startAngle),
        mcy + mry * Math.sin(startAngle),
      );
    }
    ctx.ellipse(mcx, mcy, mrx, mry, 0, startAngle, endAngle, false);
    if (recType === EMR_PIE || recType === EMR_CHORD) ctx.closePath();
    if (!inPath) {
      if (needsFill) {
        applyBrush(ctx, state);
        ctx.fill();
      }
      applyPen(ctx, state);
      ctx.stroke();
    }
    if (isArcTo) {
      state.curX = endX;
      state.curY = endY;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function handleEmfGdiShapeRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  switch (recType) {
    case EMR_MOVETOEX:
      return handleMoveToEx(rCtx, dataOff, recSize);
    case EMR_LINETO:
      return handleLineTo(rCtx, dataOff, recSize);
    case EMR_RECTANGLE:
      return handleRectangle(rCtx, dataOff, recSize);
    case EMR_ROUNDRECT:
      return handleRoundRect(rCtx, dataOff, recSize);
    case EMR_ELLIPSE:
      return handleEllipse(rCtx, dataOff, recSize);
    case EMR_ARC:
    case EMR_ARCTO:
    case EMR_CHORD:
    case EMR_PIE:
      return handleArcFamily(rCtx, recType, dataOff, recSize);
    default:
      return false;
  }
}
