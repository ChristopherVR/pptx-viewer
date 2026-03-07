/**
 * DIB (Device-Independent Bitmap) decoder.
 *
 * Supports 1/4/8/16/24/32 bpp with BI_RGB, BI_RLE4, BI_RLE8, and
 * BI_BITFIELDS compression modes.
 */

import { decodeRleBitmap } from "./emf-dib-rle-decoder";
import {
  decodeUncompressedRows,
  parseBitfieldMasks,
} from "./emf-dib-uncompressed";

export function decodeDibToImageData(
  view: DataView,
  bmiOffset: number,
  bitsOffset: number,
  bitsSize: number,
): ImageData | null {
  if (
    bmiOffset < 0 ||
    bitsOffset < 0 ||
    bmiOffset + 40 > view.byteLength ||
    bitsOffset + bitsSize > view.byteLength
  ) {
    return null;
  }

  const headerSize = view.getUint32(bmiOffset, true);
  if (headerSize < 40 || bmiOffset + headerSize > view.byteLength) return null;

  const width = view.getInt32(bmiOffset + 4, true);
  const heightRaw = view.getInt32(bmiOffset + 8, true);
  const planes = view.getUint16(bmiOffset + 12, true);
  const bitCount = view.getUint16(bmiOffset + 14, true);
  const compression = view.getUint32(bmiOffset + 16, true);

  if (planes !== 1 || width <= 0 || heightRaw === 0) return null;
  if (width > 8192 || Math.abs(heightRaw) > 8192) return null;

  const BI_RGB = 0;
  const BI_RLE8 = 1;
  const BI_RLE4 = 2;
  const BI_BITFIELDS = 3;

  if (
    bitCount !== 1 &&
    bitCount !== 4 &&
    bitCount !== 8 &&
    bitCount !== 16 &&
    bitCount !== 24 &&
    bitCount !== 32
  )
    return null;
  if (compression === BI_RLE8 && bitCount !== 8) return null;
  if (compression === BI_RLE4 && bitCount !== 4) return null;
  if (compression === BI_BITFIELDS && bitCount !== 16 && bitCount !== 32)
    return null;
  if (
    compression !== BI_RGB &&
    compression !== BI_RLE8 &&
    compression !== BI_RLE4 &&
    compression !== BI_BITFIELDS
  )
    return null;

  const height = Math.abs(heightRaw);
  const topDown = heightRaw < 0;

  // Read colour table for indexed modes
  const colorTable: Array<[number, number, number]> = [];
  if (bitCount <= 8) {
    const maxColors = 1 << bitCount;
    const colorsUsed = view.getUint32(bmiOffset + 32, true) || maxColors;
    const numColors = Math.min(colorsUsed, maxColors);
    const ctOffset = bmiOffset + headerSize;
    if (ctOffset + numColors * 4 > view.byteLength) return null;
    for (let i = 0; i < numColors; i++) {
      const b = view.getUint8(ctOffset + i * 4);
      const g = view.getUint8(ctOffset + i * 4 + 1);
      const r = view.getUint8(ctOffset + i * 4 + 2);
      colorTable.push([r, g, b]);
    }
  }

  // Parse bitfield masks for 16/32 bpp
  const masks = parseBitfieldMasks(
    view,
    bmiOffset,
    headerSize,
    compression,
    bitCount,
  );
  if (!masks) return null;

  const out = new Uint8ClampedArray(width * height * 4);

  // Handle RLE-compressed bitmaps
  if (compression === BI_RLE8 || compression === BI_RLE4) {
    const setPixel = (
      x: number,
      y: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      const dstPx = (y * width + x) * 4;
      out[dstPx] = r;
      out[dstPx + 1] = g;
      out[dstPx + 2] = b;
      out[dstPx + 3] = a;
    };

    return decodeRleBitmap(
      view,
      bitsOffset,
      bitsSize,
      width,
      height,
      topDown,
      compression === BI_RLE4,
      colorTable,
      out,
      setPixel,
    );
  }

  // Decode uncompressed bitmap rows
  decodeUncompressedRows(
    view,
    bitsOffset,
    width,
    height,
    topDown,
    bitCount,
    colorTable,
    masks,
    out,
  );

  return new ImageData(out, width, height);
}
