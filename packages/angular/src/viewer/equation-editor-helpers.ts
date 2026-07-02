/**
 * equation-editor-helpers.ts: Pure helpers backing the equation editor dialog
 * and its template gallery. Kept framework-free (no Angular / DOM) so the
 * LaTeX -> MathML conversion and the template catalogue are unit testable in
 * isolation.
 */

import { convertLatexToOmml, ommlToMathml } from '../internal/shared';
import type { OmmlNode } from '../internal/shared';

/** Describes a pre-built equation template shown in the template gallery. */
export interface EquationTemplate {
	/** Human-readable label (English fallback). */
	label: string;
	/** LaTeX source for the template equation. */
	latex: string;
}

/** Pre-defined equation templates covering common mathematical formulas. */
export const TEMPLATES: EquationTemplate[] = [
	{ label: 'Fraction', latex: '\\frac{a}{b}' },
	{ label: 'Quadratic', latex: 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}' },
	{ label: 'Pythagorean', latex: 'a^{2}+b^{2}=c^{2}' },
	{ label: 'Sum', latex: '\\sum_{i=1}^{n}{a_{i}}' },
	{ label: 'Integral', latex: '\\int_{a}^{b}{f(x)}dx' },
	{ label: 'Square Root', latex: '\\sqrt{x^{2}+y^{2}}' },
	{ label: 'Limit', latex: '\\lim_{x\\to\\infty}{f(x)}' },
	{ label: "Euler's", latex: 'e^{i\\pi}+1=0' },
	{ label: 'Matrix 2x2', latex: '\\left[a,b;c,d\\right]' },
	{ label: 'Binomial', latex: '\\left(a+b\\right)^{n}' },
	{ label: 'Derivative', latex: '\\frac{dy}{dx}' },
	{ label: 'Trig Identity', latex: '\\sin^{2}\\theta+\\cos^{2}\\theta=1' },
];

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
