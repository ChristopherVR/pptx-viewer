/**
 * omml-to-mathml.ts: thin re-export shim over `pptx-viewer-shared`.
 *
 * The OMML → MathML conversion logic (and its former `omml-helpers` /
 * `omml-converters` split) lives in `pptx-viewer-shared`
 * (`packages/shared/src/render/omml-to-mathml.ts`), consumed identically by the
 * React, Vue, and Angular bindings. This module preserves the historical React
 * import path / symbol surface (`convertOmmlToMathMl`, `OmmlNode`) so consumers
 * keep importing unchanged names.
 *
 * No deliberate divergence; React's previous local copy was byte-equivalent in
 * behaviour to shared's (shared was originally extracted from it).
 */
export { convertOmmlToMathMl, ommlToMathml } from 'pptx-viewer-shared';
export type { OmmlNode } from 'pptx-viewer-shared';
