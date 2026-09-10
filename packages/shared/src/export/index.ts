/**
 * Framework-agnostic EXPORT helpers shared by the React, Vue, and Angular
 * `pptx-viewer` bindings. These are the PURE portions of the export pipeline —
 * byte/string assembly and layout math — with zero DOM/browser dependency. The
 * DOM/canvas/Blob drivers (html2canvas capture, `getImageData`, object-URL
 * creation, print-window writing) stay in each binding.
 *
 * - gif:      `gif-encoder` (median-cut quantisation + LZW GIF89a byte encoder,
 *             plus pure frame-planning / dimension-clamp helpers).
 * - handouts: `handout-layout` (slides-per-page grid, A4 page geometry, cell
 *             positioning, pagination).
 * - notes:    `notes-page-layout` (per-slide notes-page thumbnail + text-area
 *             geometry in mm).
 * - pdf:      `pdf-notes-layout` (notes-page PDF point geometry, text wrapping,
 *             PDF content-stream fragments, escaping, layout constants).
 * - svg:      `svg-print` (self-contained SVG / print-HTML string assembly +
 *             XML escaping + data-URL).
 */
// Browser download helpers (object-URL anchor click) + the rich download
// filename sanitizer. The only DOM-touching helpers in this subtree.
export * from './download-helpers';
// Deck-as-JSON (pptx-viewer-json) export: filename derivation + download.
export * from './deck-json';
// Canvas -> JPEG byte extraction for PDF embedding.
export * from './canvas-jpeg';
export * from './gif-encoder';
export * from './handout-layout';
// Handout master "chrome": background/header/footer/date/page-number/slide-rect
// resolution (`handout-master-chrome`) and its HTML markup (`handout-chrome-html`)
// for the print path, reused by `print-document.ts`.
export * from './handout-master-chrome';
export * from './handout-chrome-html';
// HTML escaping (`escapeHtml`, `safeDataImageSrc`) shared by every print
// markup builder above and `print-document.ts` itself.
export * from './html-escape';
export * from './notes-page-layout';
export * from './pdf-notes-layout';
export * from './svg-print';
// CSS/colour preprocessing for html2canvas capture: pure DOM passes (custom-
// property resolution, oklch/oklab -> sRGB, backdrop-filter / mix-blend-mode /
// 3D-transform flattening, blob -> data URL). The html2canvas-pro driver itself
// stays in each binding; only the cloned-document mutation passes are shared.
export * from './css-preprocessing';
export * from './canvas-color-fix';
// Pure PDF byte assembly: slides-only (`buildSlidesPdfBytes`) and notes-page
// (`buildNotesPdfBytes`) builders plus the segment-merge helper. The binding
// converts canvases to JPEG bytes and wraps the result in a Blob/object-URL.
export * from './pdf-slides';
export * from './pdf-notes-builder';
export * from './pdf-page-size';
// Pure print helpers: settings validation, slide-range / colour-filter
// resolution, page-count estimation, HTML markup builders + escaping, and the
// full print-document string assembler. The binding writes it to a print window.
export * from './print-document';
// DOM-touching print-window open/finish lifecycle (window.open-based paths
// only; the popup-blocking fix every binding needs lives here once).
export * from './print-window';
// Pure WebM video planning: frame-segment timing, fps maths, MediaRecorder MIME
// selection. The MediaRecorder/canvas capture driver stays in each binding.
export * from './video-plan';
// Pure PNG byte framing (CRC-32, chunk assembly, filter-type-0 scanlines) plus
// the `CompressionStream('deflate')`-driven streaming encoder that turns
// row-bands into a full PNG without ever holding the whole image in memory.
export * from './png-crc32';
export * from './png-chunk-builder';
export * from './png-row-filter';
export * from './streaming-png-encoder';
// SVG `foreignObject` raster export: draws an already-assembled self-contained
// SVG string (see `render/foreign-object-svg-document.ts`) onto a canvas via
// an `Image`, verifying the draw actually produced readable (untainted)
// pixels so the caller can fall back when it did not.
export * from './rasterize-foreign-object';
// Per-window/per-tile strategy selection (foreignObject -> vector-SVG ->
// html2canvas) and the public single-shot / tiled raster-export entry point.
// `probeMaxCanvasDimension` re-exports the cached probe from
// `render/canvas-size-probe.ts` under this directory's own import convention.
export * from './canvas-size-probe';
export * from './rasterize-element-strategy';
// The raw per-tile canvases (no PNG stitching), for a caller that can place
// several images itself - PDF/notes-PDF pages, which have no canvas-size
// limit of their own.
export * from './rasterize-element-tiles';
export * from './rasterize-element';
// Pure pixel-index math combining one tile-row's per-tile RGBA buffers into a
// full-width row-band, consumed by `rasterize-element.ts`'s PNG-stitch path.
export * from './tile-row-stitch';
// Pure geometry placing one export tile onto a PDF page (native-size or
// fixed-aspect/letterboxed), so PDF/notes-PDF can embed several small tile
// images per page instead of one full-page image.
export * from './pdf-tile-placement';
// `rasterizeElement()` with the scale clamped so the result is always a
// single canvas without stitching - for the rare case a slide's natural size
// alone (before any export scale) already exceeds the cap, which stitching
// cannot help since there would be nothing to tile in the first place.
export * from './rasterize-element-clamped';
// `rasterizeElement()`'s tiled case, stitched into one full-resolution canvas
// (`putImageData`, not pre-encoded PNG bytes) - for GIF frames, a
// `captureStream()` recording canvas, and any other caller that needs an
// actual `<canvas>` at full requested resolution instead of downscaling.
export * from './rasterize-element-tiled-canvas';
// Converts a `RasterizeElementResult` to a PNG Blob/data URL, handling the
// tiled `png-bytes` branch identically for every binding's PNG-export /
// "copy slide as image" handler.
export * from './raster-result-to-blob';
