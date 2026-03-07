/**
 * EMF GDI polygon, polyline, and path-operation record handlers.
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import {
  EMR_POLYLINE,
  EMR_POLYGON,
  EMR_POLYBEZIER,
  EMR_POLYBEZIERTO,
  EMR_POLYLINETO,
  EMR_POLYPOLYLINE,
  EMR_POLYLINE16,
  EMR_POLYGON16,
  EMR_POLYBEZIER16,
  EMR_POLYBEZIERTO16,
  EMR_POLYLINETO16,
  EMR_POLYPOLYGON,
  EMR_POLYPOLYGON16,
  EMR_BEGINPATH,
  EMR_ENDPATH,
  EMR_CLOSEFIGURE,
  EMR_FILLPATH,
  EMR_STROKEANDFILLPATH,
  EMR_STROKEPATH,
  EMR_SELECTCLIPPATH,
} from "./emf-constants";
import { applyPen, applyBrush } from "./emf-canvas-helpers";
import { gmx, gmy } from "./emf-gdi-coord";
import {
  handlePolyPolygon32,
  handlePolyPolyline32,
  handlePolyPolygon16,
} from "./emf-gdi-polypolygon-helpers";

// ---------------------------------------------------------------------------
// 32-bit poly helper
// ---------------------------------------------------------------------------

function handlePoly32(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize < 28) return true;

  const count = view.getUint32(dataOff + 16, true);
  const ptOff = dataOff + 20;
  if (count === 0 || ptOff + count * 8 > offset + recSize) return true;

  const isPolygon = recType === EMR_POLYGON;
  const isBezier = recType === EMR_POLYBEZIER || recType === EMR_POLYBEZIERTO;
  const isTo = recType === EMR_POLYBEZIERTO || recType === EMR_POLYLINETO;

  if (!inPath) ctx.beginPath();
  if (!isTo) {
    ctx.moveTo(
      gmx(rCtx, view.getInt32(ptOff, true)),
      gmy(rCtx, view.getInt32(ptOff + 4, true)),
    );
  }

  let i = isTo ? 0 : 1;
  if (isBezier) {
    while (i + 2 < count) {
      ctx.bezierCurveTo(
        gmx(rCtx, view.getInt32(ptOff + i * 8, true)),
        gmy(rCtx, view.getInt32(ptOff + i * 8 + 4, true)),
        gmx(rCtx, view.getInt32(ptOff + (i + 1) * 8, true)),
        gmy(rCtx, view.getInt32(ptOff + (i + 1) * 8 + 4, true)),
        gmx(rCtx, view.getInt32(ptOff + (i + 2) * 8, true)),
        gmy(rCtx, view.getInt32(ptOff + (i + 2) * 8 + 4, true)),
      );
      i += 3;
    }
  } else {
    for (; i < count; i++) {
      ctx.lineTo(
        gmx(rCtx, view.getInt32(ptOff + i * 8, true)),
        gmy(rCtx, view.getInt32(ptOff + i * 8 + 4, true)),
      );
    }
  }

  if (isPolygon) ctx.closePath();
  if (!inPath) {
    if (isPolygon) {
      applyBrush(ctx, state);
      ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
    }
    applyPen(ctx, state);
    ctx.stroke();
  }

  if (count > 0) {
    const last = count - 1;
    state.curX = view.getInt32(ptOff + last * 8, true);
    state.curY = view.getInt32(ptOff + last * 8 + 4, true);
  }
  return true;
}

// ---------------------------------------------------------------------------
// 16-bit poly helper
// ---------------------------------------------------------------------------

function handlePoly16(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, inPath } = rCtx;
  if (recSize < 28) return true;

  const count = view.getUint32(dataOff + 16, true);
  const ptOff = dataOff + 20;
  if (count === 0 || ptOff + count * 4 > offset + recSize) return true;

  const isPolygon = recType === EMR_POLYGON16;
  const isBezier =
    recType === EMR_POLYBEZIER16 || recType === EMR_POLYBEZIERTO16;
  const isTo = recType === EMR_POLYBEZIERTO16 || recType === EMR_POLYLINETO16;

  if (!inPath) ctx.beginPath();
  if (!isTo) {
    ctx.moveTo(
      gmx(rCtx, view.getInt16(ptOff, true)),
      gmy(rCtx, view.getInt16(ptOff + 2, true)),
    );
  }

  let i = isTo ? 0 : 1;
  if (isBezier) {
    while (i + 2 < count) {
      ctx.bezierCurveTo(
        gmx(rCtx, view.getInt16(ptOff + i * 4, true)),
        gmy(rCtx, view.getInt16(ptOff + i * 4 + 2, true)),
        gmx(rCtx, view.getInt16(ptOff + (i + 1) * 4, true)),
        gmy(rCtx, view.getInt16(ptOff + (i + 1) * 4 + 2, true)),
        gmx(rCtx, view.getInt16(ptOff + (i + 2) * 4, true)),
        gmy(rCtx, view.getInt16(ptOff + (i + 2) * 4 + 2, true)),
      );
      i += 3;
    }
  } else {
    for (; i < count; i++) {
      ctx.lineTo(
        gmx(rCtx, view.getInt16(ptOff + i * 4, true)),
        gmy(rCtx, view.getInt16(ptOff + i * 4 + 2, true)),
      );
    }
  }

  if (isPolygon) ctx.closePath();
  if (!inPath) {
    if (isPolygon) {
      applyBrush(ctx, state);
      ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
    }
    applyPen(ctx, state);
    ctx.stroke();
  }

  if (count > 0) {
    const last = count - 1;
    state.curX = view.getInt16(ptOff + last * 4, true);
    state.curY = view.getInt16(ptOff + last * 4 + 2, true);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export function handleEmfGdiPolyPathRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, state } = rCtx;

  switch (recType) {
    // ---- 32-bit polys ----
    case EMR_POLYLINE:
    case EMR_POLYGON:
    case EMR_POLYBEZIER:
    case EMR_POLYBEZIERTO:
    case EMR_POLYLINETO:
      return handlePoly32(rCtx, recType, offset, dataOff, recSize);

    // ---- 16-bit polys ----
    case EMR_POLYLINE16:
    case EMR_POLYGON16:
    case EMR_POLYBEZIER16:
    case EMR_POLYBEZIERTO16:
    case EMR_POLYLINETO16:
      return handlePoly16(rCtx, recType, offset, dataOff, recSize);

    // ---- polypolyline / polypolygon ----
    case EMR_POLYPOLYLINE:
      if (recSize >= 28) handlePolyPolyline32(rCtx, offset, dataOff, recSize);
      return true;
    case EMR_POLYPOLYGON:
      if (recSize >= 28) handlePolyPolygon32(rCtx, offset, dataOff, recSize);
      return true;
    case EMR_POLYPOLYGON16:
      if (recSize >= 28) handlePolyPolygon16(rCtx, offset, dataOff, recSize);
      return true;

    // ---- path operations ----
    case EMR_BEGINPATH:
      rCtx.inPath = true;
      ctx.beginPath();
      return true;
    case EMR_ENDPATH:
      rCtx.inPath = false;
      return true;
    case EMR_CLOSEFIGURE:
      ctx.closePath();
      return true;
    case EMR_FILLPATH:
      applyBrush(ctx, state);
      ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
      return true;
    case EMR_STROKEANDFILLPATH:
      applyBrush(ctx, state);
      ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
      applyPen(ctx, state);
      ctx.stroke();
      return true;
    case EMR_STROKEPATH:
      applyPen(ctx, state);
      ctx.stroke();
      return true;

    case EMR_SELECTCLIPPATH: {
      const clipMode = recSize >= 12 ? rCtx.view.getUint32(dataOff, true) : 5;
      try {
        if (clipMode === 5) {
          while (rCtx.clipSaveDepth > 0) {
            ctx.restore();
            rCtx.clipSaveDepth--;
          }
          ctx.save();
          rCtx.clipSaveDepth++;
          ctx.clip();
        } else {
          ctx.save();
          rCtx.clipSaveDepth++;
          ctx.clip();
        }
      } catch {
        /* ignore clip errors */
      }
      return true;
    }

    default:
      return false;
  }
}
