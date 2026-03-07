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
  EMR_EXTSELECTCLIPRGN,
  EMR_EXCLUDECLIPRECT,
  EMR_OFFSETCLIPRGN,
} from "./emf-constants";
import { applyFont, readUtf16LE, createTempCanvas } from "./emf-canvas-helpers";
import { decodeDibToImageData } from "./emf-dib-decoder";
import { gmx, gmy, gmw, gmh } from "./emf-gdi-coord";
import { emfLog } from "./emf-logging";

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
// EMR_EXTSELECTCLIPRGN (record type 75)
// ---------------------------------------------------------------------------

function handleExtSelectClipRgn(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  const { ctx, view } = rCtx;
  if (recSize < 16) return true;

  const cbRgnData = view.getUint32(dataOff, true);
  const iMode = view.getUint32(dataOff + 4, true);

  // RGN_COPY = 5: replace clip with region
  if (iMode === 5) {
    if (cbRgnData === 0) {
      // Reset clip — unwind any saved clip states
      while (rCtx.clipSaveDepth > 0) {
        ctx.restore();
        rCtx.clipSaveDepth--;
      }
      emfLog("EMR_EXTSELECTCLIPRGN: RGN_COPY with empty region — clip reset");
      return true;
    }

    // Parse RGNDATAHEADER (32 bytes)
    const rgnStart = dataOff + 8;
    if (cbRgnData < 32) return true;

    // const dwSize = view.getUint32(rgnStart, true);      // 32
    // const iType = view.getUint32(rgnStart + 4, true);    // 1 = RDH_RECTANGLES
    const nCount = view.getUint32(rgnStart + 8, true);
    // const nRgnSize = view.getUint32(rgnStart + 12, true);
    // rcBound: rgnStart+16..rgnStart+31

    if (nCount === 0) return true;

    // Unwind previous clip before applying new one
    while (rCtx.clipSaveDepth > 0) {
      ctx.restore();
      rCtx.clipSaveDepth--;
    }

    ctx.save();
    rCtx.clipSaveDepth++;
    ctx.beginPath();

    const rectsStart = rgnStart + 32;
    for (let i = 0; i < nCount; i++) {
      const rOff = rectsStart + i * 16;
      if (rOff + 16 > dataOff + 8 + cbRgnData) break;
      const left = view.getInt32(rOff, true);
      const top = view.getInt32(rOff + 4, true);
      const right = view.getInt32(rOff + 8, true);
      const bottom = view.getInt32(rOff + 12, true);
      ctx.rect(
        gmx(rCtx, left),
        gmy(rCtx, top),
        gmw(rCtx, right - left),
        gmh(rCtx, bottom - top),
      );
    }

    try {
      ctx.clip();
    } catch {
      /* ignore clip errors */
    }

    emfLog(
      `EMR_EXTSELECTCLIPRGN: RGN_COPY with ${nCount} rect(s)`,
    );
  } else {
    emfLog(
      `EMR_EXTSELECTCLIPRGN: mode=${iMode} not implemented (only RGN_COPY=5 supported)`,
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// EMR_EXCLUDECLIPRECT (record type 29) — stub
// ---------------------------------------------------------------------------

function handleExcludeClipRect(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  if (recSize >= 24) {
    const left = rCtx.view.getInt32(dataOff, true);
    const top = rCtx.view.getInt32(dataOff + 4, true);
    const right = rCtx.view.getInt32(dataOff + 8, true);
    const bottom = rCtx.view.getInt32(dataOff + 12, true);
    emfLog(
      `EMR_EXCLUDECLIPRECT: rect=(${left},${top})→(${right},${bottom}) — not implemented (Canvas API limitation)`,
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// EMR_OFFSETCLIPRGN (record type 26) — stub
// ---------------------------------------------------------------------------

function handleOffsetClipRgn(
  rCtx: EmfGdiReplayCtx,
  dataOff: number,
  recSize: number,
): boolean {
  if (recSize >= 16) {
    const dx = rCtx.view.getInt32(dataOff, true);
    const dy = rCtx.view.getInt32(dataOff + 4, true);
    emfLog(
      `EMR_OFFSETCLIPRGN: offset=(${dx},${dy}) — not implemented`,
    );
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
    case EMR_EXTSELECTCLIPRGN:
      return handleExtSelectClipRgn(rCtx, dataOff, recSize);
    case EMR_EXCLUDECLIPRECT:
      return handleExcludeClipRect(rCtx, dataOff, recSize);
    case EMR_OFFSETCLIPRGN:
      return handleOffsetClipRgn(rCtx, dataOff, recSize);
    default:
      return false;
  }
}
