/**
 * EMF/WMF converter — barrel re-export.
 *
 * This package converts Enhanced Metafile (EMF) and Windows Metafile (WMF)
 * binary buffers into PNG data-URL strings by parsing their record streams
 * and replaying the drawing operations onto an HTML Canvas or OffscreenCanvas.
 *
 * The two public entry points are:
 * - {@link convertEmfToDataUrl} — handles EMF (including embedded EMF+ / GDI+ records)
 * - {@link convertWmfToDataUrl} — handles the older 16-bit WMF format
 *
 * @packageDocumentation
 */
export {
  convertEmfToDataUrl,
  convertWmfToDataUrl,
  type EmfConvertOptions,
} from "./emf-converter";
export { DEFAULT_DPI_SCALE } from "./emf-canvas-helpers";
