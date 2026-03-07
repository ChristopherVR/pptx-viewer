/**
 * EMF+ path parsing and canvas replay.
 */

import type { CanvasContext, EmfPlusPath } from "./emf-types";

// ---------------------------------------------------------------------------
// Parse an EMF+ Path object from a DataView
// ---------------------------------------------------------------------------

export function parseEmfPlusPath(
  data: DataView,
  off: number,
  maxLen: number,
): EmfPlusPath | null {
  if (maxLen < 12) return null;

  const version = data.getUint32(off, true);
  void version;
  const pointCount = data.getUint32(off + 4, true);
  const pathFlags = data.getUint32(off + 8, true);

  if (pointCount === 0 || pointCount > 100000) return null;

  const compressed = (pathFlags & 0x4000) !== 0;
  const pointSize = compressed ? 4 : 8;
  const pointsBytes = pointCount * pointSize;
  const typesBytes = pointCount;
  const neededAfterHeader = pointsBytes + typesBytes;

  if (12 + neededAfterHeader > maxLen) return null;

  const points: Array<{ x: number; y: number }> = [];
  let pOff = off + 12;
  for (let i = 0; i < pointCount; i++) {
    if (compressed) {
      points.push({
        x: data.getInt16(pOff, true),
        y: data.getInt16(pOff + 2, true),
      });
      pOff += 4;
    } else {
      points.push({
        x: data.getFloat32(pOff, true),
        y: data.getFloat32(pOff + 4, true),
      });
      pOff += 8;
    }
  }

  const alignedPOff = (pOff + 3) & ~3;
  const types = new Uint8Array(
    data.buffer,
    data.byteOffset + alignedPOff,
    pointCount,
  );

  return { kind: "plus-path", points, types: new Uint8Array(types) };
}

// ---------------------------------------------------------------------------
// Replay a parsed EMF+ path onto a canvas context
// ---------------------------------------------------------------------------

export function replayEmfPlusPath(ctx: CanvasContext, path: EmfPlusPath): void {
  ctx.beginPath();
  const pts = path.points;
  const types = path.types;
  let i = 0;
  while (i < pts.length) {
    const t = types[i] & 0x0f;
    const close = (types[i] & 0x80) !== 0;
    if (t === 0) {
      ctx.moveTo(pts[i].x, pts[i].y);
      i++;
    } else if (t === 1) {
      ctx.lineTo(pts[i].x, pts[i].y);
      i++;
    } else if (t === 3) {
      if (i + 2 < pts.length) {
        ctx.bezierCurveTo(
          pts[i].x,
          pts[i].y,
          pts[i + 1].x,
          pts[i + 1].y,
          pts[i + 2].x,
          pts[i + 2].y,
        );
        if ((types[i + 2] & 0x80) !== 0) ctx.closePath();
        i += 3;
        continue;
      } else {
        break;
      }
    } else {
      ctx.lineTo(pts[i].x, pts[i].y);
      i++;
    }
    if (close) ctx.closePath();
  }
}
