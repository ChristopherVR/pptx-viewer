/**
 * EMF and WMF header parsers.
 */

import type { EmfBounds, WmfHeader } from "./emf-types";
import { emfLog, emfWarn } from "./emf-logging";
import { EMR_HEADER } from "./emf-constants";

// ---------------------------------------------------------------------------
// EMF header
// ---------------------------------------------------------------------------

export function parseEmfHeader(
  view: DataView,
): { bounds: EmfBounds; frameW: number; frameH: number } | null {
  emfLog("parseEmfHeader: byteLength =", view.byteLength);
  if (view.byteLength < 88) {
    emfWarn("parseEmfHeader: buffer too small (<88 bytes)");
    return null;
  }
  const recordType = view.getUint32(0, true);
  if (recordType !== EMR_HEADER) {
    emfWarn(
      "parseEmfHeader: first record type is",
      recordType,
      "(expected 1 = EMR_HEADER)",
    );
    return null;
  }

  const boundsLeft = view.getInt32(8, true);
  const boundsTop = view.getInt32(12, true);
  const boundsRight = view.getInt32(16, true);
  const boundsBottom = view.getInt32(20, true);

  const frameLeft = view.getInt32(24, true);
  const frameTop = view.getInt32(28, true);
  const frameRight = view.getInt32(32, true);
  const frameBottom = view.getInt32(36, true);

  const frameW = frameRight - frameLeft;
  const frameH = frameBottom - frameTop;

  emfLog(
    `parseEmfHeader: bounds=(${boundsLeft},${boundsTop})→(${boundsRight},${boundsBottom}) [${boundsRight - boundsLeft}×${boundsBottom - boundsTop}]`,
  );
  emfLog(
    `parseEmfHeader: frame=(${frameLeft},${frameTop})→(${frameRight},${frameBottom}) [${frameW}×${frameH}]`,
  );

  return {
    bounds: {
      left: boundsLeft,
      top: boundsTop,
      right: boundsRight,
      bottom: boundsBottom,
    },
    frameW,
    frameH,
  };
}

export function getRenderableEmfBounds(header: {
  bounds: EmfBounds;
  frameW: number;
  frameH: number;
}): EmfBounds | null {
  const boundsW = header.bounds.right - header.bounds.left;
  const boundsH = header.bounds.bottom - header.bounds.top;
  if (boundsW > 0 && boundsH > 0) {
    emfLog(`getRenderableEmfBounds: using bounds ${boundsW}×${boundsH}`);
    return header.bounds;
  }

  if (header.frameW > 0 && header.frameH > 0) {
    emfLog(
      `getRenderableEmfBounds: bounds invalid (${boundsW}×${boundsH}), falling back to frame ${header.frameW}×${header.frameH}`,
    );
    return { left: 0, top: 0, right: header.frameW, bottom: header.frameH };
  }

  emfWarn("getRenderableEmfBounds: no valid bounds or frame — returning null");
  return null;
}

// ---------------------------------------------------------------------------
// WMF header
// ---------------------------------------------------------------------------

export function parseWmfHeader(view: DataView): WmfHeader | null {
  if (view.byteLength < 22) return null;

  const magic = view.getUint32(0, true);
  let headerOffset = 0;
  let boundsLeft = 0;
  let boundsTop = 0;
  let boundsRight = 800;
  let boundsBottom = 600;
  let unitsPerInch = 96;

  if (magic === 0x9ac6cdd7) {
    boundsLeft = view.getInt16(6, true);
    boundsTop = view.getInt16(8, true);
    boundsRight = view.getInt16(10, true);
    boundsBottom = view.getInt16(12, true);
    unitsPerInch = view.getUint16(14, true) || 96;
    headerOffset = 22;
  }

  if (headerOffset + 18 > view.byteLength) return null;

  const fileType = view.getUint16(headerOffset, true);
  if (fileType !== 1 && fileType !== 2) return null;

  const headerSize = view.getUint16(headerOffset + 2, true) * 2;
  const maxRecordSize = view.getUint32(headerOffset + 8, true) * 2;

  return {
    headerSize: headerOffset + headerSize,
    maxRecordSize,
    boundsLeft,
    boundsTop,
    boundsRight,
    boundsBottom,
    unitsPerInch,
  };
}
