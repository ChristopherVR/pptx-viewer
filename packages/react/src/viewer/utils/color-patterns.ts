/**
 * SVG pattern generation for OOXML pattern fill presets.
 *
 * Thin re-export shim. The implementation now lives in the framework-agnostic
 * `pptx-viewer-shared` package (`render/fill-style.ts`); this file preserves
 * the historical `./color-patterns` import surface (`getPatternSvg`).
 *
 * Reference: ECMA-376 Part 1, §20.1.10.33 (ST_PresetPatternVal).
 */
export { getPatternSvg } from 'pptx-viewer-shared';
