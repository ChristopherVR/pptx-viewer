/**
 * EMF GDI polypolygon record helpers (32-bit and 16-bit).
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import { applyPen, applyBrush } from "./emf-canvas-helpers";
import { gmx, gmy } from "./emf-gdi-coord";

export function handlePolyPolygon32(
  rCtx: EmfGdiReplayCtx,
  offset: number,
  dataOff: number,
  recSize: number,
): void {
  const { ctx, view, state, inPath } = rCtx;
  const numPolys = view.getUint32(dataOff + 16, true);
  const totalPoints = view.getUint32(dataOff + 20, true);
  if (numPolys === 0 || numPolys >= 10000 || totalPoints >= 100000) return;
  const countsOff = dataOff + 24;
  const ptOff = countsOff + numPolys * 4;
  if (ptOff + totalPoints * 8 > offset + recSize) return;
  if (!inPath) ctx.beginPath();
  let pIdx = 0;
  for (let p = 0; p < numPolys; p++) {
    const count = view.getUint32(countsOff + p * 4, true);
    for (let i = 0; i < count && pIdx < totalPoints; i++) {
      const px = view.getInt32(ptOff + pIdx * 8, true);
      const py = view.getInt32(ptOff + pIdx * 8 + 4, true);
      if (i === 0) ctx.moveTo(gmx(rCtx, px), gmy(rCtx, py));
      else ctx.lineTo(gmx(rCtx, px), gmy(rCtx, py));
      pIdx++;
    }
    ctx.closePath();
  }
  if (!inPath) {
    applyBrush(ctx, state);
    ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
    applyPen(ctx, state);
    ctx.stroke();
  }
}

export function handlePolyPolygon16(
  rCtx: EmfGdiReplayCtx,
  offset: number,
  dataOff: number,
  recSize: number,
): void {
  const { ctx, view, state, inPath } = rCtx;
  const numPolys = view.getUint32(dataOff + 16, true);
  const totalPoints = view.getUint32(dataOff + 20, true);
  if (numPolys === 0 || numPolys >= 10000 || totalPoints >= 100000) return;
  const countsOff = dataOff + 24;
  const ptOff = countsOff + numPolys * 4;
  if (ptOff + totalPoints * 4 > offset + recSize) return;
  if (!inPath) ctx.beginPath();
  let pIdx = 0;
  for (let p = 0; p < numPolys; p++) {
    const count = view.getUint32(countsOff + p * 4, true);
    for (let i = 0; i < count && pIdx < totalPoints; i++) {
      const px = view.getInt16(ptOff + pIdx * 4, true);
      const py = view.getInt16(ptOff + pIdx * 4 + 2, true);
      if (i === 0) ctx.moveTo(gmx(rCtx, px), gmy(rCtx, py));
      else ctx.lineTo(gmx(rCtx, px), gmy(rCtx, py));
      pIdx++;
    }
    ctx.closePath();
  }
  if (!inPath) {
    applyBrush(ctx, state);
    ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
    applyPen(ctx, state);
    ctx.stroke();
  }
}
