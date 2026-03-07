/**
 * EMF+ state / transform / save / restore / clip record handlers.
 *
 * Also exports shared utility functions used by other handler modules.
 */

import type { EmfPlusReplayCtx, EmfPlusRegionNode, TransformMatrix, CanvasContext } from "./emf-types";
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
  EMFPLUS_OFFSETCLIP,
} from "./emf-constants";
import { argbToRgba } from "./emf-color-helpers";
import { emfLog, emfWarn } from "./emf-logging";
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

/**
 * Compute the multiplier that converts from the current page unit to pixels
 * (assuming a 96 DPI canvas), scaled by the page scale factor.
 */
export function getPageUnitMultiplier(pageUnit: number, pageScale: number): number {
  const DPI = 96;
  let unitToPixel: number;
  switch (pageUnit) {
    case 3: unitToPixel = DPI / 72; break;      // Point
    case 4: unitToPixel = DPI; break;            // Inch
    case 5: unitToPixel = DPI / 300; break;      // Document
    case 6: unitToPixel = DPI / 25.4; break;     // Millimeter
    default: unitToPixel = 1; break;             // World, Display, Pixel
  }
  return unitToPixel * pageScale;
}

/** Apply the current EMF+ world transform to the canvas, incorporating page units. */
export function applyPlusWorldTransform(rCtx: EmfPlusReplayCtx): void {
  const wt = rCtx.worldTransform;
  const m = getPageUnitMultiplier(rCtx.pageUnit, rCtx.pageScale);
  rCtx.ctx.setTransform(
    wt[0] * m, wt[1] * m,
    wt[2] * m, wt[3] * m,
    wt[4] * m, wt[5] * m,
  );
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
// Clip save/restore helpers for CombineMode support
// ---------------------------------------------------------------------------

/**
 * Ensure the canvas state has been saved for clip management.
 * Called before any clip operation so we can later restore to a clean state.
 */
function ensureClipSave(rCtx: EmfPlusReplayCtx): void {
  if (rCtx.clipSaveDepth === 0) {
    rCtx.ctx.save();
    rCtx.clipSaveDepth = 1;
  }
}

/**
 * Restore the canvas to the pre-clip state, removing all clip regions.
 */
function resetClipState(rCtx: EmfPlusReplayCtx): void {
  if (rCtx.clipSaveDepth > 0) {
    rCtx.ctx.restore();
    rCtx.clipSaveDepth = 0;
  }
}

/**
 * Apply a clip operation respecting the CombineMode.
 *
 * CombineMode values:
 *   0 = Replace — restore pre-clip state, then apply new clip
 *   1 = Intersect — apply clip on top of existing (Canvas default)
 *   2 = Union — not supported, fall back to Intersect with warning
 *   3 = Xor — not supported, skip with warning
 *   4 = Exclude — not supported, skip with warning
 *   5 = Complement — not supported, skip with warning
 *
 * @returns true if the clip was applied, false if skipped
 */
function applyClipCombineMode(
  rCtx: EmfPlusReplayCtx,
  combineMode: number,
  opName: string,
  clipFn: () => void,
): boolean {
  switch (combineMode) {
    case 0: // Replace
      resetClipState(rCtx);
      ensureClipSave(rCtx);
      clipFn();
      return true;
    case 1: // Intersect
      ensureClipSave(rCtx);
      clipFn();
      return true;
    case 2: // Union
      emfWarn(`${opName}: CombineMode Union not supported by Canvas2D, falling back to Intersect`);
      ensureClipSave(rCtx);
      clipFn();
      return true;
    case 3: // Xor
      emfWarn(`${opName}: CombineMode Xor not supported by Canvas2D, skipping`);
      return false;
    case 4: // Exclude
      emfWarn(`${opName}: CombineMode Exclude not supported by Canvas2D, skipping`);
      return false;
    case 5: // Complement
      emfWarn(`${opName}: CombineMode Complement not supported by Canvas2D, skipping`);
      return false;
    default:
      emfWarn(`${opName}: unknown CombineMode ${combineMode}, falling back to Intersect`);
      ensureClipSave(rCtx);
      clipFn();
      return true;
  }
}

// ---------------------------------------------------------------------------
// Region clipping helpers
// ---------------------------------------------------------------------------

/**
 * Recursively trace a region node tree onto the canvas as a clip path.
 * Builds a path from rect / path leaf nodes. For combine nodes, only
 * Intersect is natively supported by Canvas2D; others log a warning
 * and fall back to tracing just the left subtree.
 */
function traceRegionNodePath(
  ctx: CanvasContext,
  node: EmfPlusRegionNode,
): void {
  switch (node.type) {
    case "rect":
      ctx.rect(node.x, node.y, node.width, node.height);
      break;
    case "path":
      replayEmfPlusPath(ctx, node.path);
      break;
    case "infinite":
      // Infinite region — clip to a very large rectangle
      ctx.rect(-1e6, -1e6, 2e6, 2e6);
      break;
    case "empty":
      // Empty region — trace a zero-area rect (clips everything)
      ctx.rect(0, 0, 0, 0);
      break;
    case "combine":
      // Canvas2D only supports intersect natively via successive clip() calls.
      // For other combine modes we trace the left subtree as a best-effort fallback.
      traceRegionNodePath(ctx, node.left);
      if (node.combineMode !== 0 /* And/Intersect */) {
        emfWarn(
          `traceRegionNodePath: combine mode ${node.combineMode} not fully supported, using left subtree only`,
        );
      } else {
        // For Intersect: trace right subtree too; successive clip() will intersect.
        try {
          ctx.clip();
        } catch { /* ignore */ }
        ctx.beginPath();
        traceRegionNodePath(ctx, node.right);
      }
      break;
  }
}

/**
 * Apply a region node as a clipping region on the canvas context.
 *
 * CombineMode values (from SetClipRegion flags):
 *   0 = Replace, 1 = Intersect, 2 = Union, 3 = Xor, 4 = Exclude, 5 = Complement
 *
 * Canvas2D only supports Replace (save + beginPath + clip) and Intersect
 * (just beginPath + clip on top of existing clip). For other modes we log
 * a warning and fall back to Replace.
 */
function applyRegionNodeClip(
  ctx: CanvasContext,
  rootNode: EmfPlusRegionNode,
  combineMode: number,
): void {
  if (combineMode > 1) {
    emfWarn(
      `applyRegionNodeClip: CombineMode ${combineMode} not supported by Canvas2D, falling back to Replace`,
    );
  }

  ctx.beginPath();
  traceRegionNodePath(ctx, rootNode);
  try {
    ctx.clip();
  } catch {
    /* ignore clip errors */
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
        const combineMode = (recFlags >> 8) & 0x0f;
        const cx = view.getFloat32(dataOff, true);
        const cy = view.getFloat32(dataOff + 4, true);
        const cw = view.getFloat32(dataOff + 8, true);
        const ch = view.getFloat32(dataOff + 12, true);
        applyClipCombineMode(rCtx, combineMode, "SetClipRect", () => {
          applyPlusWorldTransform(rCtx);
          rCtx.ctx.beginPath();
          rCtx.ctx.rect(cx, cy, cw, ch);
          try {
            rCtx.ctx.clip();
          } catch {
            /* ignore clip errors */
          }
        });
      }
      return true;
    }

    case EMFPLUS_RESETCLIP: {
      resetClipState(rCtx);
      // Re-save so subsequent clips can be applied and later reset
      ensureClipSave(rCtx);
      emfLog("ResetClip: clip region cleared");
      return true;
    }

    case EMFPLUS_SETCLIPREGION: {
      const regionId = recFlags & 0xff;
      const combineMode = (recFlags >> 8) & 0x0f;
      const regionObj = rCtx.objectTable.get(regionId);
      if (regionObj && regionObj.kind === "plus-region" && regionObj.nodes.length > 0) {
        applyPlusWorldTransform(rCtx);
        const rootNode = regionObj.nodes[0];
        applyRegionNodeClip(rCtx.ctx, rootNode, combineMode);
      }
      return true;
    }

    case EMFPLUS_SETCLIPPATH: {
      const pathId = recFlags & 0xff;
      const combineMode = (recFlags >> 8) & 0x0f;
      const pathObj = rCtx.objectTable.get(pathId);
      if (pathObj && pathObj.kind === "plus-path") {
        applyClipCombineMode(rCtx, combineMode, "SetClipPath", () => {
          applyPlusWorldTransform(rCtx);
          rCtx.ctx.beginPath();
          replayEmfPlusPath(rCtx.ctx, pathObj);
          try {
            rCtx.ctx.clip();
          } catch {
            /* ignore clip errors */
          }
        });
      }
      return true;
    }

    case EMFPLUS_OFFSETCLIP: {
      if (recDataSize >= 8) {
        const dx = view.getFloat32(dataOff, true);
        const dy = view.getFloat32(dataOff + 4, true);
        emfLog(`OffsetClip: dx=${dx}, dy=${dy} (not fully supported)`);
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
      rCtx.pageUnit = pageUnit;
      rCtx.pageScale = pageScale;
      const UNIT_NAMES: Record<number, string> = {
        0: "World", 1: "Display", 2: "Pixel", 3: "Point",
        4: "Inch", 5: "Document", 6: "Millimeter",
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
