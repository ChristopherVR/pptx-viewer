/**
 * EMF GDI text, bitmap, and clipping record handlers:
 * ExtTextOutW, BitBlt, StretchDIBits, IntersectClipRect.
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import {
  EMR_EXTTEXTOUTW,
  EMR_BITBLT,
  EMR_STRETCHDIBITS,
  EMR_INTERSECTCLIPRECT,
} from "./emf-constants";
import { applyFont, readUtf16LE, createTempCanvas } from "./emf-canvas-helpers";
import { decodeDibToImageData } from "./emf-dib-decoder";
import { gmx, gmy, gmw, gmh } from "./emf-gdi-coord";

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function handleExtTextOutW(
  rCtx: EmfGdiReplayCtx,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view, state } = rCtx;
  if (recSize >= 76) {
    const refX = view.getInt32(dataOff + 28, true);
    const refY = view.getInt32(dataOff + 32, true);
    const nChars = view.getUint32(dataOff + 36, true);
    const offString = view.getUint32(dataOff + 40, true);
    const maxOffset = view.byteLength;
    if (
      nChars > 0 &&
      offString > 0 &&
      offset + offString + nChars * 2 <= maxOffset
    ) {
      const text = readUtf16LE(view, offset + offString, nChars);
      if (text.length > 0) {
        applyFont(ctx, state);
        ctx.fillStyle = state.textColor;
        let alignBaseline: CanvasTextBaseline = "alphabetic";
        let alignHoriz: CanvasTextAlign = "left";
        if (state.textAlign & 0x08) alignBaseline = "bottom";
        if (state.textAlign & 0x18) alignBaseline = "alphabetic";
        if (state.textAlign & 0x06) alignHoriz = "center";
        if (state.textAlign & 0x02) alignHoriz = "right";
        ctx.textBaseline = alignBaseline;
        ctx.textAlign = alignHoriz;
        if (state.bkMode === 2) {
          const measured = ctx.measureText(text);
          const bgH = state.fontHeight || 12;
          ctx.fillStyle = state.bkColor;
          ctx.fillRect(
            gmx(rCtx, refX),
            gmy(rCtx, refY) - bgH,
            measured.width,
            bgH,
          );
          ctx.fillStyle = state.textColor;
        }
        ctx.fillText(text, gmx(rCtx, refX), gmy(rCtx, refY));
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Bitmap operations
// ---------------------------------------------------------------------------

function handleBitBlt(
  rCtx: EmfGdiReplayCtx,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view } = rCtx;
  if (recSize >= 96) {
    const dstX = view.getInt32(dataOff + 16, true);
    const dstY = view.getInt32(dataOff + 20, true);
    const dstW = view.getInt32(dataOff + 24, true);
    const dstH = view.getInt32(dataOff + 28, true);
    const offBmiSrc = view.getUint32(dataOff + 76, true);
    const cbBmiSrc = view.getUint32(dataOff + 80, true);
    const offBitsSrc = view.getUint32(dataOff + 84, true);
    const cbBitsSrc = view.getUint32(dataOff + 88, true);
    if (offBmiSrc > 0 && cbBmiSrc > 0 && offBitsSrc > 0 && cbBitsSrc > 0) {
      const imageData = decodeDibToImageData(
        view,
        offset + offBmiSrc,
        offset + offBitsSrc,
        cbBitsSrc,
      );
      if (imageData) {
        const temp = createTempCanvas(imageData.width, imageData.height);
        if (temp) {
          temp.ctx.putImageData(imageData, 0, 0);
          ctx.drawImage(
            temp.canvas as CanvasImageSource,
            gmx(rCtx, dstX),
            gmy(rCtx, dstY),
            gmw(rCtx, dstW),
            gmh(rCtx, dstH),
          );
        }
      }
    }
  }
  return true;
}

function handleStretchDibits(
  rCtx: EmfGdiReplayCtx,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view } = rCtx;
  if (recSize >= 80) {
    const dstX = view.getInt32(dataOff + 16, true);
    const dstY = view.getInt32(dataOff + 20, true);
    const dstW = view.getInt32(dataOff + 64, true);
    const dstH = view.getInt32(dataOff + 68, true);
    const offBmiSrc = view.getUint32(dataOff + 40, true);
    const cbBmiSrc = view.getUint32(dataOff + 44, true);
    const offBitsSrc = view.getUint32(dataOff + 48, true);
    const cbBitsSrc = view.getUint32(dataOff + 52, true);
    if (offBmiSrc > 0 && cbBmiSrc > 0 && offBitsSrc > 0 && cbBitsSrc > 0) {
      const imageData = decodeDibToImageData(
        view,
        offset + offBmiSrc,
        offset + offBitsSrc,
        cbBitsSrc,
      );
      if (imageData) {
        const temp = createTempCanvas(imageData.width, imageData.height);
        if (temp) {
          temp.ctx.putImageData(imageData, 0, 0);
          ctx.drawImage(
            temp.canvas as CanvasImageSource,
            gmx(rCtx, dstX),
            gmy(rCtx, dstY),
            gmw(rCtx, dstW),
            gmh(rCtx, dstH),
          );
        }
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Clipping
// ---------------------------------------------------------------------------

function handleIntersectClipRect(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view } = rCtx;
  if (recSize >= 24) {
    const left = view.getInt32(dataOff, true);
    const top = view.getInt32(dataOff + 4, true);
    const right = view.getInt32(dataOff + 8, true);
    const bottom = view.getInt32(dataOff + 12, true);
    ctx.save();
    rCtx.clipSaveDepth++;
    ctx.beginPath();
    ctx.rect(
      gmx(rCtx, left),
      gmy(rCtx, top),
      gmw(rCtx, right - left),
      gmh(rCtx, bottom - top),
    );
    try {
      ctx.clip();
    } catch {
      /* ignore clip errors */
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function handleEmfGdiTextBitmapRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  switch (recType) {
    case EMR_EXTTEXTOUTW:
      return handleExtTextOutW(rCtx, offset, dataOff, recSize);
    case EMR_BITBLT:
      return handleBitBlt(rCtx, offset, dataOff, recSize);
    case EMR_STRETCHDIBITS:
      return handleStretchDibits(rCtx, offset, dataOff, recSize);
    case EMR_INTERSECTCLIPRECT:
      return handleIntersectClipRect(rCtx, dataOff, recSize);
    default:
      return false;
  }
}
