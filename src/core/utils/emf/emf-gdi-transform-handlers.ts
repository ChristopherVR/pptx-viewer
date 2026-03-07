/**
 * EMF GDI coordinate-system and world-transform record handlers.
 */

import type { EmfGdiReplayCtx, TransformMatrix } from "./emf-types";
import {
  EMR_SETWINDOWEXTEX,
  EMR_SETWINDOWORGEX,
  EMR_SETVIEWPORTEXTEX,
  EMR_SETVIEWPORTORGEX,
  EMR_SETMAPMODE,
  EMR_SCALEVIEWPORTEXTEX,
  EMR_SCALEWINDOWEXTEX,
  EMR_SETWORLDTRANSFORM,
  EMR_MODIFYWORLDTRANSFORM,
} from "./emf-constants";
import { activateGdiMappingMode } from "./emf-gdi-coord";

// ---------------------------------------------------------------------------
// Coordinate-system helpers
// ---------------------------------------------------------------------------

function handleCoordinateRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { view } = rCtx;

  switch (recType) {
    case EMR_SETWINDOWEXTEX: {
      if (recSize >= 16) {
        rCtx.windowExt.cx = view.getInt32(dataOff, true);
        rCtx.windowExt.cy = view.getInt32(dataOff + 4, true);
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    case EMR_SETWINDOWORGEX: {
      if (recSize >= 16) {
        rCtx.windowOrg.x = view.getInt32(dataOff, true);
        rCtx.windowOrg.y = view.getInt32(dataOff + 4, true);
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    case EMR_SETVIEWPORTEXTEX: {
      if (recSize >= 16) {
        rCtx.viewportExt.cx = view.getInt32(dataOff, true);
        rCtx.viewportExt.cy = view.getInt32(dataOff + 4, true);
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    case EMR_SETVIEWPORTORGEX: {
      if (recSize >= 16) {
        rCtx.viewportOrg.x = view.getInt32(dataOff, true);
        rCtx.viewportOrg.y = view.getInt32(dataOff + 4, true);
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    case EMR_SETMAPMODE: {
      if (recSize >= 12) {
        const mode = view.getUint32(dataOff, true);
        if (mode === 8 || mode === 7) {
          activateGdiMappingMode(rCtx);
        }
      }
      return true;
    }
    case EMR_SCALEVIEWPORTEXTEX: {
      if (recSize >= 24) {
        const xNum = view.getInt32(dataOff, true);
        const xDenom = view.getInt32(dataOff + 4, true);
        const yNum = view.getInt32(dataOff + 8, true);
        const yDenom = view.getInt32(dataOff + 12, true);
        if (xDenom !== 0)
          rCtx.viewportExt.cx = Math.round(
            (rCtx.viewportExt.cx * xNum) / xDenom,
          );
        if (yDenom !== 0)
          rCtx.viewportExt.cy = Math.round(
            (rCtx.viewportExt.cy * yNum) / yDenom,
          );
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    case EMR_SCALEWINDOWEXTEX: {
      if (recSize >= 24) {
        const xNum = view.getInt32(dataOff, true);
        const xDenom = view.getInt32(dataOff + 4, true);
        const yNum = view.getInt32(dataOff + 8, true);
        const yDenom = view.getInt32(dataOff + 12, true);
        if (xDenom !== 0)
          rCtx.windowExt.cx = Math.round((rCtx.windowExt.cx * xNum) / xDenom);
        if (yDenom !== 0)
          rCtx.windowExt.cy = Math.round((rCtx.windowExt.cy * yNum) / yDenom);
        activateGdiMappingMode(rCtx);
      }
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// World-transform helpers
// ---------------------------------------------------------------------------

function handleWorldTransformRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  const { view, state } = rCtx;

  switch (recType) {
    case EMR_SETWORLDTRANSFORM: {
      if (recSize >= 32) {
        state.worldTransform = [
          view.getFloat32(dataOff, true),
          view.getFloat32(dataOff + 4, true),
          view.getFloat32(dataOff + 8, true),
          view.getFloat32(dataOff + 12, true),
          view.getFloat32(dataOff + 16, true),
          view.getFloat32(dataOff + 20, true),
        ];
      }
      return true;
    }
    case EMR_MODIFYWORLDTRANSFORM: {
      if (recSize >= 36) {
        const mode = view.getUint32(dataOff + 24, true);
        if (mode === 1) {
          state.worldTransform = [1, 0, 0, 1, 0, 0];
        } else if (mode === 2 || mode === 3) {
          const xf: TransformMatrix = [
            view.getFloat32(dataOff, true),
            view.getFloat32(dataOff + 4, true),
            view.getFloat32(dataOff + 8, true),
            view.getFloat32(dataOff + 12, true),
            view.getFloat32(dataOff + 16, true),
            view.getFloat32(dataOff + 20, true),
          ];
          const [a1, b1, c1, d1, e1, f1] = state.worldTransform;
          if (mode === 2) {
            state.worldTransform = [
              xf[0] * a1 + xf[1] * c1,
              xf[0] * b1 + xf[1] * d1,
              xf[2] * a1 + xf[3] * c1,
              xf[2] * b1 + xf[3] * d1,
              xf[4] * a1 + xf[5] * c1 + e1,
              xf[4] * b1 + xf[5] * d1 + f1,
            ];
          } else {
            state.worldTransform = [
              a1 * xf[0] + b1 * xf[2],
              a1 * xf[1] + b1 * xf[3],
              c1 * xf[0] + d1 * xf[2],
              c1 * xf[1] + d1 * xf[3],
              e1 * xf[0] + f1 * xf[2] + xf[4],
              e1 * xf[1] + f1 * xf[3] + xf[5],
            ];
          }
        }
      }
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Public combined handler
// ---------------------------------------------------------------------------

export function handleEmfTransformRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  dataOff: number,
  recSize: number,
): boolean {
  return (
    handleCoordinateRecord(rCtx, recType, dataOff, recSize) ||
    handleWorldTransformRecord(rCtx, recType, dataOff, recSize)
  );
}
