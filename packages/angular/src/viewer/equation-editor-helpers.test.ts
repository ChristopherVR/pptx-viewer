/**
 * equation-editor-helpers.test.ts: Unit tests for the LaTeX -> MathML preview
 * conversion and the template catalogue split out of the equation editor.
 */

import { describe, expect, it } from 'vitest';

import { latexToMathml, TEMPLATES } from './equation-editor-helpers';

describe('latexToMathml', () => {
	it('returns an empty string for empty / whitespace input', () => {
		expect(latexToMathml('')).toBe('');
		expect(latexToMathml('   ')).toBe('');
	});

	it('produces MathML markup for a simple fraction', () => {
		const mathml = latexToMathml('\\frac{a}{b}');
		expect(mathml).toContain('<math');
		expect(mathml.toLowerCase()).toContain('mfrac');
	});

	it('never throws for arbitrary input', () => {
		expect(() => latexToMathml('\\frac{')).not.toThrow();
	});
});

describe('templates catalogue', () => {
	it('exposes a non-empty catalogue with label and latex on each entry', () => {
		expect(TEMPLATES.length).toBeGreaterThan(0);
		for (const tmpl of TEMPLATES) {
			expect(tmpl.label).toBeTruthy();
			expect(tmpl.latex).toBeTruthy();
		}
	});
});
