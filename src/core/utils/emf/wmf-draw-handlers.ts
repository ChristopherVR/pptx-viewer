/**
 * WMF drawing record handlers (shapes, poly, text).
 */

import type { WmfReplayCtx } from "./emf-types";
import {
  META_MOVETO,
  META_LINETO,
  META_RECTANGLE,
  META_ROUNDRECT,
  META_ELLIPSE,
  META_ARC,
  META_PIE,
  META_CHORD,
  META_POLYGON,
  META_POLYLINE,
  META_POLYPOLYGON,
  META_TEXTOUT,
  META_EXTTEXTOUT,
} from "./emf-constants";
import { applyPen, applyBrush, applyFont } from "./emf-canvas-helpers";

export function handleWmfDrawRecord(
  wCtx: WmfReplayCtx,
  recType: number,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state, coord } = wCtx;
  const { mx, my, mw, mh } = coord;

  switch (recType) {
    case META_MOVETO:
      if (recSize >= 10) {
        state.curY = view.getInt16(dataOff, true);
        state.curX = view.getInt16(dataOff + 2, true);
      }
      return true;

    case META_LINETO:
      if (recSize >= 10) {
        const ly = view.getInt16(dataOff, true);
        const lx = view.getInt16(dataOff + 2, true);
        applyPen(ctx, state);
        ctx.beginPath();
        ctx.moveTo(mx(state.curX), my(state.curY));
        ctx.lineTo(mx(lx), my(ly));
        ctx.stroke();
        state.curX = lx;
        state.curY = ly;
      }
      return true;

    case META_RECTANGLE:
      if (recSize >= 14) {
        const b = view.getInt16(dataOff, true);
        const r = view.getInt16(dataOff + 2, true);
        const t = view.getInt16(dataOff + 4, true);
        const l = view.getInt16(dataOff + 6, true);
        applyBrush(ctx, state);
        ctx.fillRect(mx(l), my(t), mw(r - l), mh(b - t));
        applyPen(ctx, state);
        ctx.strokeRect(mx(l), my(t), mw(r - l), mh(b - t));
      }
      return true;

    case META_ROUNDRECT:
      if (recSize >= 18) {
        const rh = Math.abs(mh(view.getInt16(dataOff, true))) / 2;
        const rw = Math.abs(mw(view.getInt16(dataOff + 2, true))) / 2;
        const b = view.getInt16(dataOff + 4, true);
        const r = view.getInt16(dataOff + 6, true);
        const t = view.getInt16(dataOff + 8, true);
        const l = view.getInt16(dataOff + 10, true);
        const x1 = mx(l),
          y1 = my(t);
        const w = mw(r - l),
          h = mh(b - t);
        const radius = Math.min(rw, rh, w / 2, h / 2);
        ctx.beginPath();
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
        applyBrush(ctx, state);
        ctx.fill();
        applyPen(ctx, state);
        ctx.stroke();
      }
      return true;

    case META_ELLIPSE:
      if (recSize >= 14) {
        const b = view.getInt16(dataOff, true);
        const r = view.getInt16(dataOff + 2, true);
        const t = view.getInt16(dataOff + 4, true);
        const l = view.getInt16(dataOff + 6, true);
        ctx.beginPath();
        ctx.ellipse(
          mx((l + r) / 2),
          my((t + b) / 2),
          Math.abs(mw(r - l)) / 2,
          Math.abs(mh(b - t)) / 2,
          0,
          0,
          Math.PI * 2,
        );
        applyBrush(ctx, state);
        ctx.fill();
        applyPen(ctx, state);
        ctx.stroke();
      }
      return true;

    case META_ARC:
    case META_PIE:
    case META_CHORD:
      if (recSize >= 22) {
        const endY = view.getInt16(dataOff, true);
        const endX = view.getInt16(dataOff + 2, true);
        const startY = view.getInt16(dataOff + 4, true);
        const startX = view.getInt16(dataOff + 6, true);
        const b = view.getInt16(dataOff + 8, true);
        const r = view.getInt16(dataOff + 10, true);
        const t = view.getInt16(dataOff + 12, true);
        const l = view.getInt16(dataOff + 14, true);
        const cxA = (l + r) / 2;
        const cyA = (t + b) / 2;
        const rxA = Math.abs(r - l) / 2;
        const ryA = Math.abs(b - t) / 2;
        const startAngle = Math.atan2(
          (startY - cyA) / (ryA || 1),
          (startX - cxA) / (rxA || 1),
        );
        const endAngle = Math.atan2(
          (endY - cyA) / (ryA || 1),
          (endX - cxA) / (rxA || 1),
        );
        ctx.beginPath();
        if (recType === META_PIE) ctx.moveTo(mx(cxA), my(cyA));
        ctx.ellipse(
          mx(cxA),
          my(cyA),
          Math.abs(mw(rxA)),
          Math.abs(mh(ryA)),
          0,
          startAngle,
          endAngle,
          false,
        );
        if (recType === META_PIE || recType === META_CHORD) ctx.closePath();
        if (recType === META_PIE || recType === META_CHORD) {
          applyBrush(ctx, state);
          ctx.fill();
        }
        applyPen(ctx, state);
        ctx.stroke();
      }
      return true;

    // ---- poly ----
    case META_POLYGON:
      if (recSize >= 10) {
        const count = view.getInt16(dataOff, true);
        if (count > 0 && dataOff + 2 + count * 4 <= offset + recSize) {
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const px = view.getInt16(dataOff + 2 + i * 4, true);
            const py = view.getInt16(dataOff + 4 + i * 4, true);
            if (i === 0) ctx.moveTo(mx(px), my(py));
            else ctx.lineTo(mx(px), my(py));
          }
          ctx.closePath();
          applyBrush(ctx, state);
          ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
          applyPen(ctx, state);
          ctx.stroke();
        }
      }
      return true;

    case META_POLYLINE:
      if (recSize >= 10) {
        const count = view.getInt16(dataOff, true);
        if (count > 0 && dataOff + 2 + count * 4 <= offset + recSize) {
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const px = view.getInt16(dataOff + 2 + i * 4, true);
            const py = view.getInt16(dataOff + 4 + i * 4, true);
            if (i === 0) ctx.moveTo(mx(px), my(py));
            else ctx.lineTo(mx(px), my(py));
          }
          applyPen(ctx, state);
          ctx.stroke();
        }
      }
      return true;

    case META_POLYPOLYGON:
      if (recSize >= 10) {
        const numPolys = view.getUint16(dataOff, true);
        let polyOff = dataOff + 2;
        const counts: number[] = [];
        for (let p = 0; p < numPolys && polyOff + 2 <= offset + recSize; p++) {
          counts.push(view.getInt16(polyOff, true));
          polyOff += 2;
        }
        ctx.beginPath();
        for (const count of counts) {
          if (count > 0 && polyOff + count * 4 <= offset + recSize) {
            for (let i = 0; i < count; i++) {
              const px = view.getInt16(polyOff + i * 4, true);
              const py = view.getInt16(polyOff + i * 4 + 2, true);
              if (i === 0) ctx.moveTo(mx(px), my(py));
              else ctx.lineTo(mx(px), my(py));
            }
            ctx.closePath();
            polyOff += count * 4;
          }
        }
        applyBrush(ctx, state);
        ctx.fill(state.polyFillMode === 2 ? "nonzero" : "evenodd");
        applyPen(ctx, state);
        ctx.stroke();
      }
      return true;

    // ---- text ----
    case META_TEXTOUT:
      if (recSize >= 12) {
        const nChars = view.getInt16(dataOff, true);
        if (nChars > 0 && dataOff + 2 + nChars <= offset + recSize) {
          let text = "";
          for (let i = 0; i < nChars; i++) {
            const ch = view.getUint8(dataOff + 2 + i);
            if (ch === 0) break;
            text += String.fromCharCode(ch);
          }
          const strBytes = nChars + (nChars % 2);
          const txOff = dataOff + 2 + strBytes;
          if (txOff + 4 <= offset + recSize) {
            const ty2 = view.getInt16(txOff, true);
            const txCoord = view.getInt16(txOff + 2, true);
            applyFont(ctx, state);
            ctx.fillStyle = state.textColor;
            ctx.fillText(text, mx(txCoord), my(ty2));
          }
        }
      }
      return true;

    case META_EXTTEXTOUT:
      if (recSize >= 14) {
        const ty2 = view.getInt16(dataOff, true);
        const txCoord = view.getInt16(dataOff + 2, true);
        const nChars = view.getInt16(dataOff + 4, true);
        const hasClipRect = (view.getUint16(dataOff + 6, true) & 0x04) !== 0;
        const stringOff = dataOff + 8 + (hasClipRect ? 8 : 0);
        if (nChars > 0 && stringOff + nChars <= offset + recSize) {
          let text = "";
          for (let i = 0; i < nChars; i++) {
            const ch = view.getUint8(stringOff + i);
            if (ch === 0) break;
            text += String.fromCharCode(ch);
          }
          applyFont(ctx, state);
          ctx.fillStyle = state.textColor;
          ctx.fillText(text, mx(txCoord), my(ty2));
        }
      }
      return true;

    default:
      return false;
  }
}
