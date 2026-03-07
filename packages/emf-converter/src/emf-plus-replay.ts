/**
 * EMF+ record stream replay — main loop.
 *
 * Iterates over EMF+ records embedded inside EMR_COMMENT records and
 * dispatches to the appropriate handler modules.
 */

import type {
  CanvasContext,
  DeferredImageDraw,
  EmfPlusReplayCtx,
  EmfPlusState,
} from "./emf-types";
import { createEmfPlusState } from "./emf-types";
import {
  EMFPLUS_HEADER,
  EMFPLUS_ENDOFFILE,
  EMFPLUS_GETDC,
  EMFPLUS_OBJECT,
} from "./emf-constants";
import { emfLog } from "./emf-logging";
import { handleEmfPlusObjectRecord } from "./emf-plus-object-parser";
import { handleEmfPlusDrawRecord } from "./emf-plus-draw-handlers";
import { handleEmfPlusTextImageRecord } from "./emf-plus-text-image-handlers";
import { handleEmfPlusStateRecord } from "./emf-plus-state-handlers";

// ---------------------------------------------------------------------------
// Record-name lookup (debug logging only)
// ---------------------------------------------------------------------------

const EMFPLUS_REC_NAMES: Record<number, string> = {
  0x4001: "Header",
  0x4002: "EndOfFile",
  0x4004: "GetDC",
  0x4008: "Object",
  0x400a: "FillRects",
  0x400b: "DrawRects",
  0x400c: "FillPolygon",
  0x400d: "DrawLines",
  0x400e: "FillEllipse",
  0x400f: "DrawEllipse",
  0x4014: "FillPath",
  0x4015: "DrawPath",
  0x401a: "DrawImage",
  0x401b: "DrawImagePoints",
  0x401c: "DrawString",
  0x4036: "DrawDriverString",
  0x401e: "SetAntiAliasMode",
  0x402a: "SetWorldTransform",
  0x402b: "ResetWorldTransform",
  0x402c: "MultiplyWorldTransform",
  0x4030: "SetPageTransform",
  0x4031: "ResetClip",
  0x4032: "SetClipRect",
  0x4033: "SetClipPath",
  0x4034: "SetClipRegion",
  0x4035: "OffsetClip",
  0x4025: "Save",
  0x4026: "Restore",
  0x4028: "BeginContainerNoParams",
  0x4029: "EndContainer",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function replayEmfPlusRecords(
  view: DataView,
  offset: number,
  length: number,
  ctx: CanvasContext,
  _canvasW: number,
  _canvasH: number,
  state?: EmfPlusState,
): DeferredImageDraw[] {
  const s = state ?? createEmfPlusState();
  const rCtx: EmfPlusReplayCtx = {
    ctx,
    view,
    objectTable: s.objectTable,
    worldTransform: s.worldTransform,
    deferredImages: [],
    saveStack: s.saveStack,
    saveIdMap: s.saveIdMap,
    totalImageObjects: 0,
    totalDrawImageCalls: 0,
    clipSaveDepth: 0,
    pageUnit: 2,
    pageScale: 1,
    continuationBuffer: null,
    continuationObjectId: -1,
    continuationObjectType: 0,
    continuationTotalSize: 0,
    continuationOffset: 0,
  };

  const end = offset + length;
  const maxRecords = 500000;
  let recordCount = 0;
  const emfPlusRecordTypes = new Map<number, number>();

  emfLog(
    `replayEmfPlusRecords: offset=0x${offset.toString(16)}, length=${length}`,
  );

  while (offset + 12 <= end && recordCount < maxRecords) {
    const recType = view.getUint16(offset, true);
    const recFlags = view.getUint16(offset + 2, true);
    const recSize = view.getUint32(offset + 4, true);
    const recDataSize = view.getUint32(offset + 8, true);

    if (recSize < 12 || offset + recSize > end) break;
    recordCount++;
    emfPlusRecordTypes.set(recType, (emfPlusRecordTypes.get(recType) ?? 0) + 1);

    const dataOff = offset + 12;

    switch (recType) {
      case EMFPLUS_HEADER: {
        if (recDataSize >= 16) {
          const dpiX = view.getFloat32(dataOff + 8, true);
          const dpiY = view.getFloat32(dataOff + 12, true);
          emfLog(`replayEmfPlusRecords: HEADER dpiX=${dpiX}, dpiY=${dpiY}`);
        }
        void recDataSize;
        break;
      }

      case EMFPLUS_ENDOFFILE:
        offset = end;
        continue;

      case EMFPLUS_GETDC:
        break;

      case EMFPLUS_OBJECT: {
        const isContinuation = (recFlags & 0x8000) !== 0;
        const objectId = recFlags & 0xff;

        if (isContinuation) {
          // Start or continue accumulating data
          if (rCtx.continuationBuffer === null) {
            // First continuation record — has totalObjectSize (UINT32) at start
            if (recDataSize >= 4) {
              const totalSize = view.getUint32(dataOff, true);
              const objectType = (recFlags >> 8) & 0x7f;
              rCtx.continuationTotalSize = totalSize;
              rCtx.continuationObjectId = objectId;
              rCtx.continuationObjectType = objectType;
              rCtx.continuationBuffer = new Uint8Array(totalSize);
              const chunkSize = recDataSize - 4;
              const chunk = new Uint8Array(
                view.buffer,
                view.byteOffset + dataOff + 4,
                Math.min(chunkSize, totalSize),
              );
              rCtx.continuationBuffer.set(chunk, 0);
              rCtx.continuationOffset = chunk.length;
            }
          } else {
            // Subsequent continuation record — append raw data
            const remaining = rCtx.continuationTotalSize - rCtx.continuationOffset;
            const chunk = new Uint8Array(
              view.buffer,
              view.byteOffset + dataOff,
              Math.min(recDataSize, remaining),
            );
            rCtx.continuationBuffer.set(chunk, rCtx.continuationOffset);
            rCtx.continuationOffset += chunk.length;
          }
        } else if (
          rCtx.continuationBuffer !== null &&
          objectId === rCtx.continuationObjectId
        ) {
          // Final record of a continuation sequence — append last chunk & parse
          const remaining = rCtx.continuationTotalSize - rCtx.continuationOffset;
          const chunk = new Uint8Array(
            view.buffer,
            view.byteOffset + dataOff,
            Math.min(recDataSize, remaining),
          );
          rCtx.continuationBuffer.set(chunk, rCtx.continuationOffset);

          // Parse the fully-assembled object
          const completeView = new DataView(
            rCtx.continuationBuffer.buffer,
            rCtx.continuationBuffer.byteOffset,
            rCtx.continuationBuffer.byteLength,
          );
          const assembledFlags =
            (rCtx.continuationObjectType << 8) | objectId;
          handleEmfPlusObjectRecord(
            { ...rCtx, view: completeView },
            assembledFlags,
            0,
            rCtx.continuationTotalSize,
          );

          // Reset continuation state
          rCtx.continuationBuffer = null;
          rCtx.continuationObjectId = -1;
          rCtx.continuationObjectType = 0;
          rCtx.continuationTotalSize = 0;
          rCtx.continuationOffset = 0;
        } else {
          // Normal non-continuation record
          handleEmfPlusObjectRecord(rCtx, recFlags, dataOff, recDataSize);
        }
        break;
      }

      default: {
        const handled =
          handleEmfPlusDrawRecord(
            rCtx,
            recType,
            recFlags,
            dataOff,
            recDataSize,
          ) ||
          handleEmfPlusTextImageRecord(
            rCtx,
            recType,
            recFlags,
            dataOff,
            recDataSize,
          ) ||
          handleEmfPlusStateRecord(
            rCtx,
            recType,
            recFlags,
            dataOff,
            recDataSize,
          );
        if (!handled) {
          console.warn(
            `[emf-converter] Unhandled EMF+ record type: 0x${recType.toString(16)}`,
          );
        }
        break;
      }
    }

    offset += recSize;
  }

  if (recordCount >= maxRecords) {
    console.warn(`[emf-converter] EMF+ record limit reached (${maxRecords}). Output may be incomplete.`);
  }

  // Log summary
  const summary: string[] = [];
  for (const [type, cnt] of emfPlusRecordTypes) {
    summary.push(
      `${EMFPLUS_REC_NAMES[type] ?? `0x${type.toString(16)}`}:${cnt}`,
    );
  }
  emfLog(
    `replayEmfPlusRecords: ${recordCount} records processed: ${summary.join(", ")}`,
  );
  emfLog(
    `replayEmfPlusRecords: totalImageObjects=${rCtx.totalImageObjects}, totalDrawImageCalls=${rCtx.totalDrawImageCalls}, deferredImages=${rCtx.deferredImages.length}`,
  );
  emfLog(
    `replayEmfPlusRecords: object table has ${rCtx.objectTable.size} entries: [${Array.from(
      rCtx.objectTable.entries(),
    )
      .map(([id, obj]) => `${id}:${obj.kind}`)
      .join(", ")}]`,
  );

  // Persist state for next EMR_COMMENT continuation
  if (state) {
    state.worldTransform = rCtx.worldTransform;
    state.saveIdMap = rCtx.saveIdMap;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return rCtx.deferredImages;
}
