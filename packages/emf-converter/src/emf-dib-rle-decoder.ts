/**
 * RLE decoder for DIB bitmaps (BI_RLE4 / BI_RLE8).
 */

export type SetPixelFn = (
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
) => void;

export function decodeRleBitmap(
  view: DataView,
  bitsOffset: number,
  bitsSize: number,
  width: number,
  height: number,
  _topDown: boolean,
  isRle4: boolean,
  colorTable: Array<[number, number, number]>,
  out: Uint8ClampedArray,
  setPixel: SetPixelFn,
): ImageData {
  let x = 0;
  let y = height - 1;
  let off = bitsOffset;
  const endOff = bitsOffset + bitsSize;

  while (off + 1 < endOff && y >= 0) {
    const first = view.getUint8(off);
    const second = view.getUint8(off + 1);
    off += 2;

    if (first === 0) {
      if (second === 0) {
        x = 0;
        y--;
      } else if (second === 1) {
        break;
      } else if (second === 2) {
        if (off + 1 >= endOff) break;
        x += view.getUint8(off);
        y -= view.getUint8(off + 1);
        off += 2;
      } else {
        const count = second;
        if (!isRle4) {
          for (let i = 0; i < count && off < endOff && x < width; i++) {
            const idx = view.getUint8(off++);
            if (idx < colorTable.length) {
              setPixel(
                x,
                height - 1 - y,
                colorTable[idx][0],
                colorTable[idx][1],
                colorTable[idx][2],
                255,
              );
            }
            x++;
          }
          if (count & 1) off++;
        } else {
          const bytes = Math.ceil(count / 2);
          let pi = 0;
          for (let i = 0; i < bytes && off < endOff; i++) {
            const byte = view.getUint8(off++);
            for (let nibble = 0; nibble < 2 && pi < count; nibble++) {
              const idx = nibble === 0 ? (byte >> 4) & 0xf : byte & 0xf;
              if (idx < colorTable.length && x < width) {
                setPixel(
                  x,
                  height - 1 - y,
                  colorTable[idx][0],
                  colorTable[idx][1],
                  colorTable[idx][2],
                  255,
                );
              }
              x++;
              pi++;
            }
          }
          if (bytes & 1) off++;
        }
      }
    } else {
      if (!isRle4) {
        const idx = second;
        const c: [number, number, number] =
          idx < colorTable.length ? colorTable[idx] : [0, 0, 0];
        for (let i = 0; i < first && x < width; i++) {
          setPixel(x, height - 1 - y, c[0], c[1], c[2], 255);
          x++;
        }
      } else {
        const hi = (second >> 4) & 0xf;
        const lo = second & 0xf;
        for (let i = 0; i < first && x < width; i++) {
          const idx = (i & 1) === 0 ? hi : lo;
          if (idx < colorTable.length) {
            setPixel(
              x,
              height - 1 - y,
              colorTable[idx][0],
              colorTable[idx][1],
              colorTable[idx][2],
              255,
            );
          }
          x++;
        }
      }
    }
  }
  return new ImageData(out as unknown as Uint8ClampedArray, width, height);
}
