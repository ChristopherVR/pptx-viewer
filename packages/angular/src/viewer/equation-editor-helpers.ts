/**
 * equation-editor-helpers.ts: Pure helpers backing the equation editor dialog
 * and its template gallery. Kept framework-free (no Angular / DOM) so the
 * LaTeX -> MathML conversion and the template catalogue are unit testable in
 * isolation.
 */

import { convertLatexToOmml, EQUATION_TEMPLATES, ommlToMathml } from '../internal/shared';
import type { OmmlNode } from '../internal/shared';

export type { EquationTemplate } from '../internal/shared';

/**
 * Pre-defined equation templates covering common mathematical formulas
 * (the shared catalogue every binding's equation dialog renders).
 */
export const TEMPLATES = EQUATION_TEMPLATES;

/** Convert a LaTeX string to a MathML markup string, empty on any failure. */
export function latexToMathml(latex: string): string {
	if (!latex.trim()) {
		return '';
	}
	try {
		const omml = convertLatexToOmml(latex);
		return ommlToMathml(omml as OmmlNode);
	} catch {
		return '';
	}
}
