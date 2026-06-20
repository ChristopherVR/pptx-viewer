/**
 * latex-to-omml.ts: thin re-export shim over `pptx-viewer-shared`.
 *
 * The LaTeX ↔ OMML conversion logic (formerly split across
 * `latex-to-omml-{constants,constructs,parser,reverse}.ts`) is consolidated in
 * `pptx-viewer-shared` (`packages/shared/src/render/latex-to-omml.ts`), consumed
 * identically by the React, Vue, and Angular bindings. This module preserves the
 * historical React import path / symbol surface (`convertLatexToOmml`,
 * `convertOmmlToLatex`) so consumers keep importing unchanged names.
 *
 * No deliberate divergence: React's previous local modules were behaviourally
 * equivalent to shared's consolidated implementation.
 */
export { convertLatexToOmml, convertOmmlToLatex } from 'pptx-viewer-shared';
