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
// Canvas -> JPEG byte extraction for PDF embedding.
export * from './canvas-jpeg';
export * from './package-readme';
export * from './gif-encoder';
export * from './handout-layout';
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
// Pure WebM video planning: frame-segment timing, fps maths, MediaRecorder MIME
// selection. The MediaRecorder/canvas capture driver stays in each binding.
export * from './video-plan';
