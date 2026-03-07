/**
 * GDI coordinate mapping functions for the EMF record replay.
 */

import type { EmfGdiReplayCtx } from "./emf-types";

/** Map a logical X coordinate to canvas X. */
export function gmx(r: EmfGdiReplayCtx, x: number): number {
  if (r.useMappingMode) {
    return (
      ((x - r.windowOrg.x) / (r.windowExt.cx || 1)) * (r.viewportExt.cx || 1) +
      r.viewportOrg.x
    );
  }
  return (x - r.bounds.left) * r.sx;
}

/** Map a logical Y coordinate to canvas Y. */
export function gmy(r: EmfGdiReplayCtx, y: number): number {
  if (r.useMappingMode) {
    return (
      ((y - r.windowOrg.y) / (r.windowExt.cy || 1)) * (r.viewportExt.cy || 1) +
      r.viewportOrg.y
    );
  }
  return (y - r.bounds.top) * r.sy;
}

/** Map a logical width to canvas width. */
export function gmw(r: EmfGdiReplayCtx, w: number): number {
  if (r.useMappingMode) {
    return (w / (r.windowExt.cx || 1)) * (r.viewportExt.cx || 1);
  }
  return w * r.sx;
}

/** Map a logical height to canvas height. */
export function gmh(r: EmfGdiReplayCtx, h: number): number {
  if (r.useMappingMode) {
    return (h / (r.windowExt.cy || 1)) * (r.viewportExt.cy || 1);
  }
  return h * r.sy;
}

/** Switch to window/viewport mapping mode. */
export function activateGdiMappingMode(r: EmfGdiReplayCtx): void {
  r.useMappingMode = true;
}
