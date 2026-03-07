/**
 * Low-level binary coordinate readers for EMF+ records.
 *
 * Reads compressed (Int16) or uncompressed (Float32) rectangle / point
 * data from a DataView at the given byte offset.
 */

export interface RectCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PointCoords {
  x: number;
  y: number;
}

/** Read four Int16 or Float32 values as a rectangle. */
export function readRectFromView(
  view: DataView,
  offset: number,
  compressed: boolean,
): RectCoords {
  if (compressed) {
    return {
      x: view.getInt16(offset, true),
      y: view.getInt16(offset + 2, true),
      w: view.getInt16(offset + 4, true),
      h: view.getInt16(offset + 6, true),
    };
  }
  return {
    x: view.getFloat32(offset, true),
    y: view.getFloat32(offset + 4, true),
    w: view.getFloat32(offset + 8, true),
    h: view.getFloat32(offset + 12, true),
  };
}

/** Read two Int16 or Float32 values as a point. */
export function readPointFromView(
  view: DataView,
  offset: number,
  compressed: boolean,
): PointCoords {
  if (compressed) {
    return {
      x: view.getInt16(offset, true),
      y: view.getInt16(offset + 2, true),
    };
  }
  return {
    x: view.getFloat32(offset, true),
    y: view.getFloat32(offset + 4, true),
  };
}
