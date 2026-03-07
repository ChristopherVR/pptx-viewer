/**
 * EMF+ bitmap pixel-data decoder.
 *
 * Converts raw GDI+ pixel arrays (24/32 bpp) into a BMP file buffer
 * suitable for createImageBitmap.
 */

// GDI+ PixelFormat constants
export const PIXELFORMAT_24BPP_RGB = 0x00021808;
export const PIXELFORMAT_32BPP_RGB = 0x00022009;
export const PIXELFORMAT_32BPP_ARGB = 0x0026200a;
export const PIXELFORMAT_32BPP_PARGB = 0x000e200b;

/**
 * Decode raw EMF+ bitmap pixel data into a BMP file buffer.
 * Returns null if the pixel format is unsupported.
 */
export function decodeEmfPlusBitmapPixels(
  view: DataView,
  pixelStart: number,
  width: number,
  height: number,
  stride: number,
  pixelFormat: number,
): ArrayBuffer | null {
  const absStride = Math.abs(stride);
  const topDown = stride > 0;

  const rowBytes = width * 4;
  const bmpRowStride = (rowBytes + 3) & ~3;
  const pixelDataSize = bmpRowStride * height;
  const bmpData = new Uint8Array(pixelDataSize);

  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const rowOff = pixelStart + srcRow * absStride;
    const dstRow = (height - 1 - y) * bmpRowStride;

    switch (pixelFormat) {
      case PIXELFORMAT_32BPP_ARGB:
      case PIXELFORMAT_32BPP_PARGB: {
        for (let x = 0; x < width; x++) {
          const off = rowOff + x * 4;
          if (off + 3 >= view.byteLength) break;
          let b = view.getUint8(off);
          let g = view.getUint8(off + 1);
          let r = view.getUint8(off + 2);
          const a = view.getUint8(off + 3);
          if (pixelFormat === PIXELFORMAT_32BPP_PARGB && a > 0 && a < 255) {
            r = Math.min(255, Math.round((r * 255) / a));
            g = Math.min(255, Math.round((g * 255) / a));
            b = Math.min(255, Math.round((b * 255) / a));
          }
          const di = dstRow + x * 4;
          bmpData[di] = b;
          bmpData[di + 1] = g;
          bmpData[di + 2] = r;
          bmpData[di + 3] = a;
        }
        break;
      }
      case PIXELFORMAT_32BPP_RGB: {
        for (let x = 0; x < width; x++) {
          const off = rowOff + x * 4;
          if (off + 3 >= view.byteLength) break;
          const di = dstRow + x * 4;
          bmpData[di] = view.getUint8(off);
          bmpData[di + 1] = view.getUint8(off + 1);
          bmpData[di + 2] = view.getUint8(off + 2);
          bmpData[di + 3] = 255;
        }
        break;
      }
      case PIXELFORMAT_24BPP_RGB: {
        for (let x = 0; x < width; x++) {
          const off = rowOff + x * 3;
          if (off + 2 >= view.byteLength) break;
          const di = dstRow + x * 4;
          bmpData[di] = view.getUint8(off);
          bmpData[di + 1] = view.getUint8(off + 1);
          bmpData[di + 2] = view.getUint8(off + 2);
          bmpData[di + 3] = 255;
        }
        break;
      }
      default:
        return null;
    }
  }

  // Build a minimal BMP file (BITMAPFILEHEADER + BITMAPV4HEADER + pixels)
  const fileHeaderSize = 14;
  const dibHeaderSize = 108; // BITMAPV4HEADER
  const fileSize = fileHeaderSize + dibHeaderSize + pixelDataSize;
  const bmpFile = new ArrayBuffer(fileSize);
  const bmpView = new DataView(bmpFile);
  const bmpBytes = new Uint8Array(bmpFile);

  // BITMAPFILEHEADER
  bmpView.setUint8(0, 0x42); // 'B'
  bmpView.setUint8(1, 0x4d); // 'M'
  bmpView.setUint32(2, fileSize, true);
  bmpView.setUint32(6, 0, true);
  bmpView.setUint32(10, fileHeaderSize + dibHeaderSize, true);

  // BITMAPV4HEADER
  bmpView.setUint32(14, dibHeaderSize, true);
  bmpView.setInt32(18, width, true);
  bmpView.setInt32(22, height, true);
  bmpView.setUint16(26, 1, true);
  bmpView.setUint16(28, 32, true);
  bmpView.setUint32(30, 3, true); // BI_BITFIELDS
  bmpView.setUint32(34, pixelDataSize, true);
  bmpView.setInt32(38, 2835, true);
  bmpView.setInt32(42, 2835, true);
  bmpView.setUint32(46, 0, true);
  bmpView.setUint32(50, 0, true);
  // Channel masks (BGRA in BMP)
  bmpView.setUint32(54, 0x00ff0000, true);
  bmpView.setUint32(58, 0x0000ff00, true);
  bmpView.setUint32(62, 0x000000ff, true);
  bmpView.setUint32(66, 0xff000000, true);
  // Color space type: LCS_sRGB
  bmpView.setUint32(70, 0x73524742, true);

  bmpBytes.set(bmpData, fileHeaderSize + dibHeaderSize);

  return bmpFile;
}
