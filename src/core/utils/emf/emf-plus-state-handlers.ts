/**
 * EMF+ state / transform / save / restore / clip record handlers.
 *
 * Also exports shared utility functions used by other handler modules.
 */

import type { EmfPlusReplayCtx, TransformMatrix } from "./emf-types";
import {
  EMFPLUS_SETWORLDTRANSFORM,
  EMFPLUS_RESETWORLDTRANSFORM,
  EMFPLUS_MULTIPLYWORLDTRANSFORM,
  EMFPLUS_TRANSLATEWORLDTRANSFORM,
  EMFPLUS_SCALEWORLDTRANSFORM,
  EMFPLUS_ROTATEWORLDTRANSFORM,
  EMFPLUS_SAVE,
  EMFPLUS_RESTORE,
  EMFPLUS_SETCLIPRECT,
  EMFPLUS_RESETCLIP,
  EMFPLUS_BEGINCONTAINERNOPARAMS,
  EMFPLUS_ENDCONTAINER,
  EMFPLUS_SETPAGETRANSFORM,
  EMFPLUS_SETANTIALIASMODE,
  EMFPLUS_SETTEXTRENDERINGHINT,
  EMFPLUS_SETINTERPOLATIONMODE,
  EMFPLUS_SETPIXELOFFSETMODE,
  EMFPLUS_SETCOMPOSITINGQUALITY,
  EMFPLUS_SETCLIPREGION,
  EMFPLUS_SETCLIPPATH,
} from "./emf-constants";
import { argbToRgba } from "./emf-color-helpers";
import { emfLog } from "./emf-logging";
import { replayEmfPlusPath } from "./emf-plus-path";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/** Multiply two affine matrices [a,b,c,d,e,f]. */
export function multiplyMatrix(
  m1: TransformMatrix,
  m2: TransformMatrix,
): TransformMatrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

/** Resolve a brush (either inline ARGB colour or object-table ref). */
export function resolveBrushColor(
  rCtx: EmfPlusReplayCtx,
  flags: number,
  brushIdOrColor: number,
): string {
  if (flags & 0x8000) {
    return argbToRgba(brushIdOrColor);
  }
  const obj = rCtx.objectTable.get(brushIdOrColor & 0xff);
  if (obj && obj.kind === "plus-brush") return obj.color;
  return "rgba(0,0,0,1)";
}

/** Apply the current EMF+ world transform to the canvas. */
export function applyPlusWorldTransform(rCtx: EmfPlusReplayCtx): void {
  const wt = rCtx.worldTransform;
  rCtx.ctx.setTransform(wt[0], wt[1], wt[2], wt[3], wt[4], wt[5]);
}

// ---------------------------------------------------------------------------
// Internal helper: save/restore logic shared between Save/Container ops
// ---------------------------------------------------------------------------

function pushState(rCtx: EmfPlusReplayCtx, stackId: number): void {
  rCtx.saveStack.push({
    transform: [...rCtx.worldTransform] as TransformMatrix,
  });
  rCtx.saveIdMap.set(stackId, rCtx.saveStack.length - 1);
}

function popState(rCtx: EmfPlusReplayCtx, stackId: number): void {
  const idx = rCtx.saveIdMap.get(stackId);
  if (idx !== undefined && idx < rCtx.saveStack.length) {
    rCtx.worldTransform = [...rCtx.saveStack[idx].transform] as TransformMatrix;
    rCtx.saveStack.length = idx;
    const newMap = new Map<number, number>();
    for (const [k, v] of rCtx.saveIdMap) {
      if (v < idx) newMap.set(k, v);
    }
    rCtx.saveIdMap = newMap;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export function handleEmfPlusStateRecord(
  rCtx: EmfPlusReplayCtx,
  recType: number,
  recFlags: number,
  dataOff: number,
  recDataSize: number,
): boolean {
  const { view } = rCtx;

  switch (recType) {
    // ---- transforms ----
    case EMFPLUS_SETWORLDTRANSFORM: {
      if (recDataSize >= 24) {
        rCtx.worldTransform = [
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

    case EMFPLUS_RESETWORLDTRANSFORM: {
      rCtx.worldTransform = [1, 0, 0, 1, 0, 0];
      return true;
    }

    case EMFPLUS_MULTIPLYWORLDTRANSFORM: {
      if (recDataSize >= 24) {
        const xf: TransformMatrix = [
          view.getFloat32(dataOff, true),
          view.getFloat32(dataOff + 4, true),
          view.getFloat32(dataOff + 8, true),
          view.getFloat32(dataOff + 12, true),
          view.getFloat32(dataOff + 16, true),
          view.getFloat32(dataOff + 20, true),
        ];
        if (recFlags & 0x2000) {
          rCtx.worldTransform = multiplyMatrix(rCtx.worldTransform, xf);
        } else {
          rCtx.worldTransform = multiplyMatrix(xf, rCtx.worldTransform);
        }
      }
      return true;
    }

    case EMFPLUS_TRANSLATEWORLDTRANSFORM: {
      if (recDataSize >= 8) {
        const dx = view.getFloat32(dataOff, true);
        const dy = view.getFloat32(dataOff + 4, true);
        const xf: TransformMatrix = [1, 0, 0, 1, dx, dy];
        if (recFlags & 0x2000) {
          rCtx.worldTransform = multiplyMatrix(rCtx.worldTransform, xf);
        } else {
          rCtx.worldTransform = multiplyMatrix(xf, rCtx.worldTransform);
        }
      }
      return true;
    }

    case EMFPLUS_SCALEWORLDTRANSFORM: {
      if (recDataSize >= 8) {
        const sx = view.getFloat32(dataOff, true);
        const sy = view.getFloat32(dataOff + 4, true);
        const xf: TransformMatrix = [sx, 0, 0, sy, 0, 0];
        if (recFlags & 0x2000) {
          rCtx.worldTransform = multiplyMatrix(rCtx.worldTransform, xf);
        } else {
          rCtx.worldTransform = multiplyMatrix(xf, rCtx.worldTransform);
        }
      }
      return true;
    }

    case EMFPLUS_ROTATEWORLDTRANSFORM: {
      if (recDataSize >= 4) {
        const angle = (view.getFloat32(dataOff, true) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const xf: TransformMatrix = [cos, sin, -sin, cos, 0, 0];
        if (recFlags & 0x2000) {
          rCtx.worldTransform = multiplyMatrix(rCtx.worldTransform, xf);
        } else {
          rCtx.worldTransform = multiplyMatrix(xf, rCtx.worldTransform);
        }
      }
      return true;
    }

    // ---- save / restore ----
    case EMFPLUS_SAVE: {
      if (recDataSize >= 4) {
        pushState(rCtx, view.getUint32(dataOff, true));
      }
      return true;
    }

    case EMFPLUS_RESTORE: {
      if (recDataSize >= 4) {
        popState(rCtx, view.getUint32(dataOff, true));
      }
      return true;
    }

    // ---- clipping ----
    case EMFPLUS_SETCLIPRECT: {
      if (recDataSize >= 16) {
        const cx = view.getFloat32(dataOff, true);
        const cy = view.getFloat32(dataOff + 4, true);
        const cw = view.getFloat32(dataOff + 8, true);
        const ch = view.getFloat32(dataOff + 12, true);
        applyPlusWorldTransform(rCtx);
        rCtx.ctx.beginPath();
        rCtx.ctx.rect(cx, cy, cw, ch);
        try {
          rCtx.ctx.clip();
        } catch {
          /* ignore clip errors */
        }
      }
      return true;
    }

    case EMFPLUS_RESETCLIP:
      return true;

    case EMFPLUS_SETCLIPREGION:
      return true;

    case EMFPLUS_SETCLIPPATH: {
      const pathId = (recFlags >> 8) & 0x0f;
      const pathObj = rCtx.objectTable.get(pathId);
      if (pathObj && pathObj.kind === "plus-path") {
        applyPlusWorldTransform(rCtx);
        replayEmfPlusPath(rCtx.ctx, pathObj);
        try {
          rCtx.ctx.clip();
        } catch {
          /* ignore clip errors */
        }
      }
      return true;
    }

    // ---- containers ----
    case EMFPLUS_BEGINCONTAINERNOPARAMS: {
      if (recDataSize >= 4) {
        pushState(rCtx, view.getUint32(dataOff, true));
      }
      return true;
    }

    case EMFPLUS_ENDCONTAINER: {
      if (recDataSize >= 4) {
        popState(rCtx, view.getUint32(dataOff, true));
      }
      return true;
    }

    // ---- page transform ----
    case EMFPLUS_SETPAGETRANSFORM: {
      const pageUnit = recFlags & 0xff;
      const pageScale = recDataSize >= 4 ? view.getFloat32(dataOff, true) : 1;
      const UNIT_NAMES: Record<number, string> = {
        0: "World",
        1: "Display",
        2: "Pixel",
        3: "Point",
        4: "Inch",
        5: "Document",
        6: "Millimeter",
      };
      emfLog(
        `SetPageTransform: unit=${UNIT_NAMES[pageUnit] ?? pageUnit}, scale=${pageScale}`,
      );
      return true;
    }

    // ---- rendering hints (accepted, ignored) ----
    case EMFPLUS_SETANTIALIASMODE:
    case EMFPLUS_SETTEXTRENDERINGHINT:
    case EMFPLUS_SETINTERPOLATIONMODE:
    case EMFPLUS_SETPIXELOFFSETMODE:
    case EMFPLUS_SETCOMPOSITINGQUALITY:
      return true;

    default:
      return false;
  }
}
