/**
 * equation-editor-helpers.ts: Pure helpers backing the equation editor dialog
 * and its template gallery. Kept framework-free (no Angular / DOM) so the
 * LaTeX -> MathML conversion and the template catalogue are unit testable in
 * isolation.
 *
 * The conversion pipeline itself now lives in `pptx-viewer-shared`
 * (`render/equation-compile`), which every binding shares. This module stays as
 * a name shim: `latexToMathml` is part of this package's published surface
 * (re-exported from `viewer/index.ts`), so the spelling is preserved even though
 * shared uses `latexToMathMl`.
 */

import { EQUATION_TEMPLATES, latexToMathMl } from '../internal/shared';

export type { EquationTemplate } from '../internal/shared';

/**
 * Pre-defined equation templates covering common mathematical formulas
 * (the shared catalogue every binding's equation dialog renders).
 */
export const TEMPLATES = EQUATION_TEMPLATES;

/**
 * Convert a LaTeX string to a MathML markup string, empty on any failure.
 *
 * The result is DOMPurify-sanitised (MathML + SVG profiles) by shared before it
 * is returned. That matters here specifically: the Angular dialog and gallery
 * hand this string to `DomSanitizer.bypassSecurityTrustHtml`, which disables
 * Angular's own sanitiser, so this was previously the one binding injecting
 * unsanitised equation markup.
 */
export function latexToMathml(latex: string): string {
	return latexToMathMl(latex);
}
