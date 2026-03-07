/**
 * Main EMF GDI record replay loop.
 *
 * Reads EMF records sequentially, dispatches them to the appropriate handler
 * modules, and returns any deferred image draws for post-processing.
 */

import type {
  CanvasContext,
  EmfBounds,
  EmfGdiReplayCtx,
  DeferredImageDraw,
  GdiObject,
  DrawState,
} from "./emf-types";
import { defaultState, createEmfPlusState } from "./emf-types";
import {
  EMR_HEADER,
  EMR_EOF,
  EMR_COMMENT,
  EMR_SETBRUSHORGEX,
  EMR_EXTSELECTCLIPRGN,
  EMR_SETMETARGN,
  EMR_SETICMMODE,
  EMR_SETLAYOUT,
  EMFPLUS_SIGNATURE,
} from "./emf-constants";
import { emfLog } from "./emf-logging";
import { replayEmfPlusRecords } from "./emf-plus-replay";
import { handleEmfGdiStateRecord } from "./emf-gdi-state-handlers";
import { handleEmfGdiDrawRecord } from "./emf-gdi-draw-handlers";
import { handleEmfGdiPolyPathRecord } from "./emf-gdi-poly-path-handlers";

// ---------------------------------------------------------------------------
// GDI record name lookup (for debug logging)
// ---------------------------------------------------------------------------

const GDI_NAMES: Record<number, string> = {
  1: "EMR_HEADER",
  2: "EMR_POLYBEZIER",
  3: "EMR_POLYGON",
  4: "EMR_POLYLINE",
  5: "EMR_POLYBEZIERTO",
  6: "EMR_POLYLINETO",
  14: "EMR_EOF",
  27: "EMR_MOVETOEX",
  37: "EMR_SELECTOBJECT",
  38: "EMR_CREATEPEN",
  39: "EMR_CREATEBRUSHINDIRECT",
  40: "EMR_DELETEOBJECT",
  42: "EMR_ELLIPSE",
  43: "EMR_RECTANGLE",
  54: "EMR_LINETO",
  59: "EMR_BEGINPATH",
  60: "EMR_ENDPATH",
  62: "EMR_FILLPATH",
  63: "EMR_STROKEANDFILLPATH",
  64: "EMR_STROKEPATH",
  70: "EMR_COMMENT",
  76: "EMR_BITBLT",
  81: "EMR_STRETCHDIBITS",
  84: "EMR_EXTTEXTOUTW",
  85: "EMR_POLYBEZIER16",
  86: "EMR_POLYGON16",
  87: "EMR_POLYLINE16",
  88: "EMR_POLYBEZIERTO16",
  91: "EMR_POLYPOLYGON16",
};

// ---------------------------------------------------------------------------
// Main replay function
// ---------------------------------------------------------------------------

export function replayEmfRecords(
  view: DataView,
  ctx: CanvasContext,
  bounds: EmfBounds,
  canvasW: number,
  canvasH: number,
): DeferredImageDraw[] {
  emfLog(
    `replayEmfRecords: bounds=(${bounds.left},${bounds.top})→(${bounds.right},${bounds.bottom}), canvas=${canvasW}×${canvasH}`,
  );

  const allDeferredImages: DeferredImageDraw[] = [];
  const emfPlusState = createEmfPlusState();

  const logicalW = bounds.right - bounds.left || 1;
  const logicalH = bounds.bottom - bounds.top || 1;
  const sx = canvasW / logicalW;
  const sy = canvasH / logicalH;
  emfLog(
    `replayEmfRecords: logical=${logicalW}×${logicalH}, scale=(${sx.toFixed(4)},${sy.toFixed(4)})`,
  );

  // Build the replay context
  const rCtx: EmfGdiReplayCtx = {
    ctx,
    view,
    objectTable: new Map<number, GdiObject>(),
    state: defaultState(),
    stateStack: [] as DrawState[],
    inPath: false,
    windowOrg: { x: bounds.left, y: bounds.top },
    windowExt: { cx: logicalW, cy: logicalH },
    viewportOrg: { x: 0, y: 0 },
    viewportExt: { cx: canvasW, cy: canvasH },
    useMappingMode: false,
    clipSaveDepth: 0,
    bounds,
    canvasW,
    canvasH,
    sx,
    sy,
  };

  let offset = 0;
  const maxOffset = view.byteLength;
  const maxRecords = 50000;
  let recordCount = 0;
  let emfPlusCommentCount = 0;
  const gdiRecordTypes = new Map<number, number>();

  while (offset + 8 <= maxOffset && recordCount < maxRecords) {
    const recType = view.getUint32(offset, true);
    const recSize = view.getUint32(offset + 4, true);
    if (recSize < 8 || offset + recSize > maxOffset) break;
    recordCount++;

    const dataOff = offset + 8;
    gdiRecordTypes.set(recType, (gdiRecordTypes.get(recType) ?? 0) + 1);

    // --- inlined records (comment, EOF, ignored) ---
    if (recType === EMR_COMMENT) {
      if (recSize >= 16) {
        const commentDataSize = view.getUint32(dataOff, true);
        const sig = view.getUint32(dataOff + 4, true);
        if (sig === EMFPLUS_SIGNATURE && commentDataSize > 4) {
          emfPlusCommentCount++;
          emfLog(
            `replayEmfRecords: EMF+ comment #${emfPlusCommentCount} at offset 0x${offset.toString(16)}, dataSize=${commentDataSize}`,
          );
          const deferred = replayEmfPlusRecords(
            view,
            dataOff + 8,
            commentDataSize - 4,
            ctx,
            canvasW,
            canvasH,
            emfPlusState,
          );
          emfLog(
            `replayEmfRecords: EMF+ comment #${emfPlusCommentCount} returned ${deferred.length} deferred images`,
          );
          allDeferredImages.push(...deferred);
        }
      }
      offset += recSize;
      continue;
    }

    if (recType === EMR_EOF) {
      emfLog(`replayEmfRecords: EMR_EOF reached after ${recordCount} records`);
      const summary: string[] = [];
      for (const [type, count] of gdiRecordTypes) {
        summary.push(`${GDI_NAMES[type] ?? `0x${type.toString(16)}`}:${count}`);
      }
      emfLog("replayEmfRecords: GDI record summary:", summary.join(", "));
      emfLog(
        `replayEmfRecords: total deferred images = ${allDeferredImages.length}, EMF+ object table size = ${emfPlusState.objectTable.size}`,
      );
      break;
    }

    // Ignored records — safe to skip
    if (
      recType === EMR_SETBRUSHORGEX ||
      recType === EMR_EXTSELECTCLIPRGN ||
      recType === EMR_SETMETARGN ||
      recType === EMR_SETICMMODE ||
      recType === EMR_SETLAYOUT ||
      recType === EMR_HEADER
    ) {
      offset += recSize;
      continue;
    }

    // --- delegate to handler modules ---
    const handled =
      handleEmfGdiStateRecord(rCtx, recType, offset, dataOff, recSize) ||
      handleEmfGdiDrawRecord(rCtx, recType, offset, dataOff, recSize) ||
      handleEmfGdiPolyPathRecord(rCtx, recType, offset, dataOff, recSize);

    if (!handled) {
      console.warn(`[emf-converter] Unhandled EMR record type: ${recType}`);
    }

    offset += recSize;
  }

  return allDeferredImages;
}
