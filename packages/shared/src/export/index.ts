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
export * from './gif-encoder';
export * from './handout-layout';
export * from './notes-page-layout';
export * from './pdf-notes-layout';
export * from './svg-print';
