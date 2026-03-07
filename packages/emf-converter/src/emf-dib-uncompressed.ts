/**
 * Uncompressed DIB bitmap row decoder and bitfield mask helpers.
 */

export interface BitfieldMasks {
  rMask: number;
  gMask: number;
  bMask: number;
  rShift: number;
  gShift: number;
  bShift: number;
  rMax: number;
  gMax: number;
  bMax: number;
}

/** Count trailing zeros in a 32-bit integer. */
export function countTrailingZeros(v: number): number {
  if (v === 0) return 0;
  let c = 0;
  let val = v;
  while ((val & 1) === 0) {
    val >>>= 1;
    c++;
  }
  return c;
}

const BI_BITFIELDS = 3;

/**
 * Parse bitfield masks from the DIB header.
 * Returns `null` when the bitfield data extends beyond the view.
 */
export function parseBitfieldMasks(
  view: DataView,
  bmiOffset: number,
  headerSize: number,
  compression: number,
  bitCount: number,
): BitfieldMasks | null {
  let rMask = 0,
    gMask = 0,
    bMask = 0;
  let rShift = 0,
    gShift = 0,
    bShift = 0;
  let rMax = 1,
    gMax = 1,
    bMax = 1;

  if (compression === BI_BITFIELDS) {
    const bfOff = bmiOffset + headerSize;
    if (bfOff + 12 > view.byteLength) return null;
    rMask = view.getUint32(bfOff, true);
    gMask = view.getUint32(bfOff + 4, true);
    bMask = view.getUint32(bfOff + 8, true);
    rShift = countTrailingZeros(rMask);
    gShift = countTrailingZeros(gMask);
    bShift = countTrailingZeros(bMask);
    rMax = rMask >>> rShift || 1;
    gMax = gMask >>> gShift || 1;
    bMax = bMask >>> bShift || 1;
  } else if (bitCount === 16) {
    rMask = 0x7c00;
    gMask = 0x03e0;
    bMask = 0x001f;
    rShift = 10;
    gShift = 5;
    bShift = 0;
    rMax = 31;
    gMax = 31;
    bMax = 31;
  }

  return { rMask, gMask, bMask, rShift, gShift, bShift, rMax, gMax, bMax };
}

/**
 * Decode uncompressed DIB rows into an RGBA pixel buffer.
 */
export function decodeUncompressedRows(
  view: DataView,
  bitsOffset: number,
  width: number,
  height: number,
  topDown: boolean,
  bitCount: number,
  colorTable: Array<[number, number, number]>,
  masks: BitfieldMasks,
  out: Uint8ClampedArray,
): void {
  const rowStride = Math.floor((bitCount * width + 31) / 32) * 4;
  const { rMask, gMask, bMask, rShift, gShift, bShift, rMax, gMax, bMax } =
    masks;

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const rowStart = bitsOffset + srcY * rowStride;
    if (rowStart + rowStride > view.byteLength) continue;

    for (let x = 0; x < width; x++) {
      const dstPx = (y * width + x) * 4;
      if (bitCount === 1) {
        const byteIdx = rowStart + (x >> 3);
        const bit = (view.getUint8(byteIdx) >> (7 - (x & 7))) & 1;
        if (bit < colorTable.length) {
          out[dstPx] = colorTable[bit][0];
          out[dstPx + 1] = colorTable[bit][1];
          out[dstPx + 2] = colorTable[bit][2];
        }
        out[dstPx + 3] = 255;
      } else if (bitCount === 4) {
        const byteIdx = rowStart + (x >> 1);
        const nibble =
          (x & 1) === 0
            ? (view.getUint8(byteIdx) >> 4) & 0xf
            : view.getUint8(byteIdx) & 0xf;
        if (nibble < colorTable.length) {
          out[dstPx] = colorTable[nibble][0];
          out[dstPx + 1] = colorTable[nibble][1];
          out[dstPx + 2] = colorTable[nibble][2];
        }
        out[dstPx + 3] = 255;
      } else if (bitCount === 8) {
        const idx = view.getUint8(rowStart + x);
        if (idx < colorTable.length) {
          out[dstPx] = colorTable[idx][0];
          out[dstPx + 1] = colorTable[idx][1];
          out[dstPx + 2] = colorTable[idx][2];
        }
        out[dstPx + 3] = 255;
      } else if (bitCount === 16) {
        const val = view.getUint16(rowStart + x * 2, true);
        out[dstPx] = Math.round((((val & rMask) >>> rShift) * 255) / rMax);
        out[dstPx + 1] = Math.round((((val & gMask) >>> gShift) * 255) / gMax);
        out[dstPx + 2] = Math.round((((val & bMask) >>> bShift) * 255) / bMax);
        out[dstPx + 3] = 255;
      } else if (bitCount === 24) {
        const srcPx = rowStart + x * 3;
        out[dstPx] = view.getUint8(srcPx + 2);
        out[dstPx + 1] = view.getUint8(srcPx + 1);
        out[dstPx + 2] = view.getUint8(srcPx);
        out[dstPx + 3] = 255;
      } else {
        const srcPx = rowStart + x * 4;
        const bb = view.getUint8(srcPx);
        const gg = view.getUint8(srcPx + 1);
        const rr = view.getUint8(srcPx + 2);
        const aa = view.getUint8(srcPx + 3);
        out[dstPx] = rr;
        out[dstPx + 1] = gg;
        out[dstPx + 2] = bb;
        out[dstPx + 3] = aa === 0 ? 255 : aa;
      }
    }
  }
}
