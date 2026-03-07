/**
 * EMF+ complex object parsers: Pen and Image.
 *
 * Extracted from the EMFPLUS_OBJECT handler to keep files under 300 lines.
 */

import type { EmfPlusObject } from "./emf-types";
import { EMFPLUS_BRUSHTYPE_SOLID } from "./emf-constants";
import { argbToRgba } from "./emf-color-helpers";
import { readUtf16LE } from "./emf-canvas-helpers";
import { emfLog, emfWarn } from "./emf-logging";
import { decodeEmfPlusBitmapPixels } from "./emf-plus-bitmap-decoder";

// ---------------------------------------------------------------------------
// Pen object parser
// ---------------------------------------------------------------------------

export function parseEmfPlusPenObject(
  view: DataView,
  dataOff: number,
  recDataSize: number,
): EmfPlusObject | null {
  if (recDataSize < 20) return null;

  const penFlags = view.getUint32(dataOff + 4, true);
  const penWidth = view.getFloat32(dataOff + 16, true);

  let brushOff = dataOff + 20;
  const flagSizes: Array<[number, number]> = [
    [0x00000001, 4], // Transform (actually 24 bytes)
    [0x00000002, 4], // StartCap
    [0x00000004, 4], // EndCap
    [0x00000008, 4], // Join
    [0x00000010, 4], // MiterLimit
    [0x00000020, 4], // LineStyle (DashStyle)
    [0x00000040, 4], // DashCap
    [0x00000080, 4], // DashOffset
  ];
  let dashStyle = 0;
  for (const [flag, size] of flagSizes) {
    if (penFlags & flag) {
      if (flag === 0x00000001) {
        brushOff += 24; // Transform is a 6-float matrix
      } else {
        if (flag === 0x00000020 && brushOff + 4 <= dataOff + recDataSize) {
          dashStyle = view.getUint32(brushOff, true);
        }
        brushOff += size;
      }
    }
  }
  // DashPattern array
  if (penFlags & 0x00000100) {
    if (brushOff + 4 <= dataOff + recDataSize) {
      const dashCount = view.getUint32(brushOff, true);
      brushOff += 4 + dashCount * 4;
    }
  }
  // CompoundLine array
  if (penFlags & 0x00000200) {
    if (brushOff + 4 <= dataOff + recDataSize) {
      const compCount = view.getUint32(brushOff, true);
      brushOff += 4 + compCount * 4;
    }
  }
  // CustomStartCap
  if (penFlags & 0x00000400) {
    if (brushOff + 4 <= dataOff + recDataSize) {
      const capSize = view.getUint32(brushOff, true);
      brushOff += 4 + capSize;
    }
  }
  // CustomEndCap
  if (penFlags & 0x00000800) {
    if (brushOff + 4 <= dataOff + recDataSize) {
      const capSize = view.getUint32(brushOff, true);
      brushOff += 4 + capSize;
    }
  }

  let penColor = "rgba(0,0,0,1)";
  if (brushOff + 8 <= dataOff + recDataSize) {
    const penBrushType = view.getUint32(brushOff, true);
    if (
      penBrushType === EMFPLUS_BRUSHTYPE_SOLID &&
      brushOff + 8 <= dataOff + recDataSize
    ) {
      penColor = argbToRgba(view.getUint32(brushOff + 4, true));
    }
  }

  return { kind: "plus-pen", color: penColor, width: penWidth || 1, dashStyle };
}

// ---------------------------------------------------------------------------
// Image object parser
// ---------------------------------------------------------------------------

export function parseEmfPlusImageObject(
  view: DataView,
  dataOff: number,
  recDataSize: number,
  objectId: number,
): { data: ArrayBuffer | SharedArrayBuffer | null; type: number } {
  let imgData: ArrayBuffer | SharedArrayBuffer | null = null;
  const imgType = view.getUint32(dataOff + 4, true);

  const IMG_TYPE_NAMES: Record<number, string> = { 1: "Bitmap", 2: "Metafile" };
  emfLog(
    `replayEmfPlusRecords: OBJECT Image id=${objectId}, imgType=${IMG_TYPE_NAMES[imgType] ?? `Unknown(${imgType})`}, recDataSize=${recDataSize}`,
  );

  if (imgType === 1 && recDataSize >= 28) {
    const bmpType = view.getUint32(dataOff + 24, true);
    if (bmpType === 1) {
      const bmpW = view.getInt32(dataOff + 8, true);
      const bmpH = view.getInt32(dataOff + 12, true);
      const bmpStride = view.getInt32(dataOff + 16, true);
      const pixelFormat = view.getUint32(dataOff + 20, true);
      emfLog(
        `  Bitmap(Pixel): ${bmpW}×${bmpH}, stride=${bmpStride}, pixelFormat=0x${pixelFormat.toString(16).padStart(8, "0")}`,
      );
      const pixelStart = dataOff + 28;
      const absStride = Math.abs(bmpStride);
      if (
        bmpW > 0 &&
        bmpH > 0 &&
        bmpW <= 8192 &&
        bmpH <= 8192 &&
        pixelStart + absStride * bmpH <= view.byteLength
      ) {
        const decoded = decodeEmfPlusBitmapPixels(
          view,
          pixelStart,
          bmpW,
          bmpH,
          bmpStride,
          pixelFormat,
        );
        if (decoded) {
          emfLog(
            `  Bitmap(Pixel): decoded successfully, size=${decoded.byteLength} bytes`,
          );
          imgData = decoded;
        } else {
          emfWarn(`  Bitmap(Pixel): decodeEmfPlusBitmapPixels returned null`);
        }
      }
    } else if (bmpType === 2) {
      const imgStart = dataOff + 28;
      const imgLen = recDataSize - 28;
      emfLog(
        `  Bitmap(Compressed): imgLen=${imgLen}, imgStart=0x${imgStart.toString(16)}`,
      );
      if (imgLen > 0 && imgStart + imgLen <= view.byteLength) {
        imgData = view.buffer.slice(
          view.byteOffset + imgStart,
          view.byteOffset + imgStart + imgLen,
        );
        if (imgData.byteLength >= 4) {
          const hdr = new Uint8Array(imgData, 0, 4);
          emfLog(
            `  Bitmap(Compressed): first 4 bytes = [${Array.from(hdr)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ")}]`,
          );
        }
      } else {
        emfWarn(`  Bitmap(Compressed): out of bounds or empty`);
      }
    }
  } else if (imgType === 2 && recDataSize >= 12) {
    const mfType = view.getUint32(dataOff + 8, true);
    const mfDataSize = view.getUint32(dataOff + 12, true);
    const MF_TYPE_NAMES: Record<number, string> = {
      1: "WMF",
      2: "WMF+Placeable",
      3: "EMF",
      4: "EMF+Only",
      5: "EMF+Dual",
    };
    emfLog(
      `  Metafile: type=${MF_TYPE_NAMES[mfType] ?? `Unknown(${mfType})`}, mfDataSize=${mfDataSize}`,
    );
    const mfStart = dataOff + 16;
    if (mfDataSize > 0 && mfStart + mfDataSize <= view.byteLength) {
      imgData = view.buffer.slice(
        view.byteOffset + mfStart,
        view.byteOffset + mfStart + mfDataSize,
      );
      if (imgData.byteLength >= 4) {
        const hdr = new DataView(imgData);
        const firstRec = hdr.getUint32(0, true);
        emfLog(`  Metafile: first 4 bytes recType=${firstRec} (1=EMR_HEADER)`);
      }
    } else {
      emfWarn(
        `  Metafile: out of bounds or empty (mfStart=0x${mfStart.toString(16)}, mfDataSize=${mfDataSize}, viewLen=${view.byteLength})`,
      );
    }
  }

  return { data: imgData, type: imgType };
}

// ---------------------------------------------------------------------------
// Font object parser
// ---------------------------------------------------------------------------

export function parseEmfPlusFontObject(
  view: DataView,
  dataOff: number,
  recDataSize: number,
): EmfPlusObject | null {
  if (recDataSize < 28) return null;
  const emSize = view.getFloat32(dataOff + 4, true);
  const styleFlags = view.getInt32(dataOff + 12, true);
  const nameLen = view.getUint32(dataOff + 20, true);
  let family = "sans-serif";
  if (nameLen > 0 && dataOff + 24 + nameLen * 2 <= dataOff + recDataSize) {
    family = readUtf16LE(view, dataOff + 24, nameLen) || "sans-serif";
  }
  return { kind: "plus-font", emSize: emSize || 12, flags: styleFlags, family };
}
