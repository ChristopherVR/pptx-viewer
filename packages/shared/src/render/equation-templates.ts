/**
 * equation-templates: the shared catalogue of pre-built equation templates
 * shown in every binding's equation editor dialog (React's
 * `EquationEditorDialog` is the reference implementation). Each entry pairs a
 * LaTeX source with an i18n key (plus an English fallback label) so the
 * gallery tiles render identically across React, Vue, Angular, Svelte, and
 * Vanilla.
 */

/** Describes a pre-built equation template shown in the template gallery. */
export interface EquationTemplate {
	/** Human-readable label (English fallback). */
	label: string;
	/** LaTeX source for the template equation. */
	latex: string;
	/** i18n translation key for the template name. */
	i18nKey: string;
}

/** Pre-defined equation templates covering common mathematical formulas. */
export const EQUATION_TEMPLATES: readonly EquationTemplate[] = [
	{
		label: 'Fraction',
		latex: '\\frac{a}{b}',
		i18nKey: 'pptx.equation.template.fraction',
	},
	{
		label: 'Quadratic',
		latex: 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
		i18nKey: 'pptx.equation.template.quadratic',
	},
	{
		label: 'Pythagorean',
		latex: 'a^{2}+b^{2}=c^{2}',
		i18nKey: 'pptx.equation.template.pythagorean',
	},
	{
		label: 'Sum',
		latex: '\\sum_{i=1}^{n}{a_{i}}',
		i18nKey: 'pptx.equation.template.sum',
	},
	{
		label: 'Integral',
		latex: '\\int_{a}^{b}{f(x)}dx',
		i18nKey: 'pptx.equation.template.integral',
	},
	{
		label: 'Square Root',
		latex: '\\sqrt{x^{2}+y^{2}}',
		i18nKey: 'pptx.equation.template.squareRoot',
	},
	{
		label: 'Limit',
		latex: '\\lim_{x\\to\\infty}{f(x)}',
		i18nKey: 'pptx.equation.template.limit',
	},
	{
		label: "Euler's",
		latex: 'e^{i\\pi}+1=0',
		i18nKey: 'pptx.equation.template.euler',
	},
	{
		label: 'Matrix 2x2',
		latex: '\\left[a,b;c,d\\right]',
		i18nKey: 'pptx.equation.template.matrix',
	},
	{
		label: 'Binomial',
		latex: '\\left(a+b\\right)^{n}',
		i18nKey: 'pptx.equation.template.binomial',
	},
	{
		label: 'Derivative',
		latex: '\\frac{dy}{dx}',
		i18nKey: 'pptx.equation.template.derivative',
	},
	{
		label: 'Trig Identity',
		latex: '\\sin^{2}\\theta+\\cos^{2}\\theta=1',
		i18nKey: 'pptx.equation.template.trigIdentity',
	},
];
