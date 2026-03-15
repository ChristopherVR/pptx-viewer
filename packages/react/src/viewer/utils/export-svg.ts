/**
 * SVG vector export utilities.
 *
 * Delegates to the headless {@link SvgExporter} from `pptx-viewer-core` to
 * convert parsed slide data into SVG XML strings, then provides
 * browser-friendly download helpers.
 *
 * Unlike the raster (PNG) export path which captures the DOM via html2canvas,
 * this module builds SVG directly from the element data model, producing
 * resolution-independent vector output.
 *
 * @module export-svg
 */

import { SvgExporter } from "pptx-viewer-core";
import type { SvgExportOptions, PptxSlide, PptxData } from "pptx-viewer-core";

import { downloadBlob } from "./export-helpers";
import type { ExportProgressCallback } from "./export-helpers";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Options for SVG export. */
export interface SvgExportSingleSlideOptions extends SvgExportOptions {
  /**
   * When `true`, inject `@font-face` declarations into the SVG `<defs>`
   * block for any fonts referenced by text elements. The caller must
   * provide the font data via {@link fontFaces}.
   *
   * Default: `false`.
   */
  embedFonts?: boolean;

  /**
   * Font-face declarations to embed when {@link embedFonts} is `true`.
   *
   * Each entry maps a font family name to its `@font-face` CSS source
   * (including the base64-encoded `src: url(data:...)` portion).
   *
   * @example
   * ```ts
   * fontFaces: [
   *   {
   *     family: "Calibri",
   *     css: "@font-face { font-family: 'Calibri'; src: url(data:font/woff2;base64,...) format('woff2'); }",
   *   },
   * ]
   * ```
   */
  fontFaces?: FontFaceEntry[];
}

/** A single @font-face declaration to embed in SVG. */
export interface FontFaceEntry {
  /** The CSS font-family name (e.g. "Calibri"). */
  family: string;
  /** Full `@font-face { ... }` CSS rule. */
  css: string;
}

/** Options for multi-slide SVG export. */
export interface SvgExportAllOptions extends SvgExportSingleSlideOptions {
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
}

/* ------------------------------------------------------------------ */
/*  Font embedding                                                     */
/* ------------------------------------------------------------------ */

/**
 * Inject a `<style>` block containing `@font-face` declarations into
 * an SVG string. The block is inserted inside `<defs>` if one exists,
 * or a new `<defs>` is created right after the opening `<svg>` tag.
 */
function injectFontFaces(svg: string, fontFaces: FontFaceEntry[]): string {
  if (!fontFaces.length) return svg;

  const styleBlock =
    `<style type="text/css">${fontFaces.map((f) => f.css).join("\n")}</style>`;

  // If the SVG already contains a <defs> block, insert the style at the start
  if (svg.includes("<defs>")) {
    return svg.replace("<defs>", `<defs>${styleBlock}`);
  }

  // Otherwise create a <defs> block right after the opening <svg ...>
  const closingBracket = svg.indexOf(">");
  if (closingBracket === -1) return svg;

  return (
    svg.slice(0, closingBracket + 1) +
    `<defs>${styleBlock}</defs>` +
    svg.slice(closingBracket + 1)
  );
}

/* ------------------------------------------------------------------ */
/*  Single-slide export                                                */
/* ------------------------------------------------------------------ */

/**
 * Export a single slide to an SVG XML string.
 *
 * Builds SVG from the slide element data model (not from the DOM),
 * producing resolution-independent vector output.
 *
 * @param slide   - The parsed slide data.
 * @param width   - SVG viewport width in pixels.
 * @param height  - SVG viewport height in pixels.
 * @param options - Export options (font embedding, default fonts, etc.).
 * @returns A complete SVG document as a string.
 */
export function exportSlideToSvg(
  slide: PptxSlide,
  width: number,
  height: number,
  options: SvgExportSingleSlideOptions = {},
): string {
  let svg = SvgExporter.exportSlide(slide, width, height, options);

  if (options.embedFonts && options.fontFaces?.length) {
    svg = injectFontFaces(svg, options.fontFaces);
  }

  return svg;
}

/**
 * Export a single slide as an SVG Blob.
 *
 * @param slide   - The parsed slide data.
 * @param width   - SVG viewport width in pixels.
 * @param height  - SVG viewport height in pixels.
 * @param options - Export options.
 * @returns An `image/svg+xml` Blob ready for download or further processing.
 */
export function exportSlideToSvgBlob(
  slide: PptxSlide,
  width: number,
  height: number,
  options: SvgExportSingleSlideOptions = {},
): Blob {
  const svg = exportSlideToSvg(slide, width, height, options);
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * Export a single slide as SVG and trigger a browser download.
 *
 * @param slide      - The parsed slide data.
 * @param slideIndex - Zero-based slide index (used in the filename).
 * @param width      - SVG viewport width in pixels.
 * @param height     - SVG viewport height in pixels.
 * @param options    - Export options.
 */
export function exportSlideAsSvg(
  slide: PptxSlide,
  slideIndex: number,
  width: number,
  height: number,
  options: SvgExportSingleSlideOptions = {},
): void {
  const blob = exportSlideToSvgBlob(slide, width, height, options);
  downloadBlob(blob, `slide-${slideIndex + 1}.svg`);
}

/* ------------------------------------------------------------------ */
/*  Multi-slide export                                                 */
/* ------------------------------------------------------------------ */

/**
 * Export all slides to SVG XML strings.
 *
 * @param data    - The fully parsed PPTX presentation data.
 * @param options - Export options (font embedding, slide filtering, etc.).
 * @returns An array of SVG XML strings, one per exported slide.
 */
export function exportAllSlidesToSvg(
  data: PptxData,
  options: SvgExportAllOptions = {},
): string[] {
  const { onProgress, embedFonts, fontFaces } = options;
  const svgOptions: SvgExportOptions = {
    includeHidden: options.includeHidden,
    slideIndices: options.slideIndices,
    defaultFontFamily: options.defaultFontFamily,
    defaultFontSize: options.defaultFontSize,
  };
  const results: string[] = [];
  const includeHidden = svgOptions.includeHidden ?? false;

  let processedCount = 0;

  for (let i = 0; i < data.slides.length; i++) {
    if (svgOptions.slideIndices && !svgOptions.slideIndices.includes(i)) {
      continue;
    }

    const slide = data.slides[i];
    if (slide.hidden && !includeHidden) {
      continue;
    }

    onProgress?.(processedCount, data.slides.length);

    let svg = SvgExporter.exportSlide(slide, data.width, data.height, svgOptions);

    if (embedFonts && fontFaces?.length) {
      svg = injectFontFaces(svg, fontFaces);
    }

    results.push(svg);
    processedCount++;
  }

  onProgress?.(processedCount, data.slides.length);
  return results;
}

/**
 * Export all slides as individual SVG Blobs.
 *
 * @param data    - The fully parsed PPTX presentation data.
 * @param options - Export options.
 * @returns An array of `image/svg+xml` Blobs.
 */
export function exportAllSlidesToSvgBlobs(
  data: PptxData,
  options: SvgExportAllOptions = {},
): Blob[] {
  const svgs = exportAllSlidesToSvg(data, options);
  return svgs.map(
    (svg) => new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
}
