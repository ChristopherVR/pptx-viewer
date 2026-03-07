/**
 * Colour conversion helpers for the EMF/WMF converter.
 */

export function colorRefToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r & 0xff)}${toHex(g & 0xff)}${toHex(b & 0xff)}`;
}

export function readColorRef(view: DataView, offset: number): string {
  const r = view.getUint8(offset);
  const g = view.getUint8(offset + 1);
  const b = view.getUint8(offset + 2);
  return colorRefToHex(r, g, b);
}

/** Convert an ARGB 32-bit integer to a CSS rgba() string. */
export function argbToRgba(argb: number): string {
  const a = ((argb >>> 24) & 0xff) / 255;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
