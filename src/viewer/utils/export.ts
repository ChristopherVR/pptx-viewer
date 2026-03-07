/**
 * Slide export utilities — PNG, PDF, Video (WebM), GIF, and Package export.
 *
 * Barrel re-export. Implementation split into:
 *   - export-helpers.ts   (types + shared helpers)
 *   - export-slides.ts    (PNG + PDF export)
 *   - export-video.ts     (WebM video export)
 *   - export-gif.ts       (animated GIF export)
 *   - export-package.ts   (media asset collection + readme)
 */

export type {
  ExportProgressCallback,
  PngExportOptions,
  PdfExportOptions,
  SlideCaptureOptions,
} from "./export-helpers";

export {
  exportSlideToPngBlob,
  exportSlideAsPng,
  copySlideToClipboard,
  exportAllSlidesAsPdf,
  captureAllSlidesAsPngDataUrls,
  exportSlideAsPdf,
} from "./export-slides";

export type { VideoExportOptions } from "./export-video";
export { exportAllSlidesAsVideo } from "./export-video";

export type { GifExportOptions } from "./export-gif";
export { exportAllSlidesAsGif } from "./export-gif";

export type { MediaAssetInfo, PackageExportOptions } from "./export-package";
export { collectMediaAssets, generatePackageReadme } from "./export-package";
