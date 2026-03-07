/**
 * EMF GDI state record handlers: save/restore and drawing-mode settings.
 *
 * Coordinate/transform records are delegated to ./emf-gdi-transform-handlers.
 * Object creation/selection records are delegated to ./emf-gdi-object-handlers.
 */

import type { EmfGdiReplayCtx } from "./emf-types";
import { cloneState } from "./emf-types";
import {
  EMR_SAVEDC,
  EMR_RESTOREDC,
  EMR_SETTEXTCOLOR,
  EMR_SETBKCOLOR,
  EMR_SETBKMODE,
  EMR_SETPOLYFILLMODE,
  EMR_SETROP2,
  EMR_SETSTRETCHBLTMODE,
  EMR_SETMITERLIMIT,
  EMR_SETTEXTALIGN,
} from "./emf-constants";
import { readColorRef } from "./emf-color-helpers";
import { handleEmfTransformRecord } from "./emf-gdi-transform-handlers";
import { handleEmfObjectRecord } from "./emf-gdi-object-handlers";

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export function handleEmfGdiStateRecord(
  rCtx: EmfGdiReplayCtx,
  recType: number,
  _offset: number,
  dataOff: number,
  recSize: number,
): boolean {
  // Delegate to coordinate / world-transform handler
  if (handleEmfTransformRecord(rCtx, recType, dataOff, recSize)) return true;

  // Delegate to object creation / selection / deletion handler
  if (handleEmfObjectRecord(rCtx, recType, dataOff, recSize)) return true;

  const { ctx, view, state } = rCtx;

  switch (recType) {
    // ---- save / restore ----
    case EMR_SAVEDC: {
      while (rCtx.clipSaveDepth > 0) {
        ctx.restore();
        rCtx.clipSaveDepth--;
      }
      rCtx.stateStack.push(cloneState(state));
      ctx.save();
      return true;
    }
    case EMR_RESTOREDC: {
      if (recSize >= 12) {
        while (rCtx.clipSaveDepth > 0) {
          ctx.restore();
          rCtx.clipSaveDepth--;
        }
        let rel = view.getInt32(dataOff, true);
        if (rel < 0) rel = rCtx.stateStack.length + rel;
        while (rCtx.stateStack.length > rel && rCtx.stateStack.length > 0) {
          rCtx.stateStack.pop();
          ctx.restore();
        }
        const restored = rCtx.stateStack.pop();
        if (restored) {
          Object.assign(state, restored);
          ctx.restore();
        }
      }
      return true;
    }

    // ---- drawing mode / color settings ----
    case EMR_SETTEXTCOLOR: {
      if (recSize >= 12) state.textColor = readColorRef(view, dataOff);
      return true;
    }
    case EMR_SETBKCOLOR: {
      if (recSize >= 12) state.bkColor = readColorRef(view, dataOff);
      return true;
    }
    case EMR_SETBKMODE: {
      if (recSize >= 12) state.bkMode = view.getUint32(dataOff, true);
      return true;
    }
    case EMR_SETPOLYFILLMODE: {
      if (recSize >= 12) state.polyFillMode = view.getUint32(dataOff, true);
      return true;
    }
    case EMR_SETROP2:
    case EMR_SETSTRETCHBLTMODE:
    case EMR_SETMITERLIMIT:
    case EMR_SETTEXTALIGN: {
      if (recType === EMR_SETTEXTALIGN && recSize >= 12) {
        state.textAlign = view.getUint32(dataOff, true);
      }
      return true;
    }

    default:
      return false;
  }
}
