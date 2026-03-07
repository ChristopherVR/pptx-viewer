/**
 * latex-to-omml.ts - Barrel re-export
 *
 * Converts a subset of LaTeX math notation into Office MathML (OMML) XML
 * objects compatible with the fast-xml-parser structure used in the PPTX editor.
 *
 * Implementation split into:
 *   - latex-to-omml-constants.ts  - maps, token types, tokenizer
 *   - latex-to-omml-constructs.ts - nary / delimiter / func / script helpers
 *   - latex-to-omml-parser.ts     - LatexParser class + convertLatexToOmml
 *   - latex-to-omml-reverse.ts    - convertOmmlToLatex + reverse helpers
 */
export { convertLatexToOmml } from "./latex-to-omml-parser";
export { convertOmmlToLatex } from "./latex-to-omml-reverse";
