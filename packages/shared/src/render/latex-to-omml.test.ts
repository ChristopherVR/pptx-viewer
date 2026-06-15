import { describe, expect, it } from 'vitest';

import { convertLatexToOmml, convertOmmlToLatex } from './latex-to-omml';

describe('convertLatexToOmml', () => {
	it('returns an empty object for blank input', () => {
		expect(convertLatexToOmml('')).toStrictEqual({});
		expect(convertLatexToOmml('   ')).toStrictEqual({});
	});

	it('wraps output in m:oMathPara > m:oMath', () => {
		const omml = convertLatexToOmml('x');
		expect(omml).toHaveProperty('m:oMathPara');
		const para = omml['m:oMathPara'] as Record<string, unknown>;
		expect(para).toHaveProperty('m:oMath');
	});

	it('produces an m:f fraction node for \\frac', () => {
		const omml = convertLatexToOmml('\\frac{a}{b}');
		const oMath = (omml['m:oMathPara'] as Record<string, unknown>)['m:oMath'] as Record<
			string,
			unknown
		>;
		expect(oMath).toHaveProperty('m:f');
	});

	it('produces an m:rad node for \\sqrt', () => {
		const omml = convertLatexToOmml('\\sqrt{x}');
		const oMath = (omml['m:oMathPara'] as Record<string, unknown>)['m:oMath'] as Record<
			string,
			unknown
		>;
		expect(oMath).toHaveProperty('m:rad');
	});

	it('produces an m:sSup node for superscripts', () => {
		const omml = convertLatexToOmml('x^{2}');
		const oMath = (omml['m:oMathPara'] as Record<string, unknown>)['m:oMath'] as Record<
			string,
			unknown
		>;
		expect(oMath).toHaveProperty('m:sSup');
	});

	it('produces an m:nary node for \\sum', () => {
		const omml = convertLatexToOmml('\\sum_{i=1}^{n}{a}');
		const oMath = (omml['m:oMathPara'] as Record<string, unknown>)['m:oMath'] as Record<
			string,
			unknown
		>;
		expect(oMath).toHaveProperty('m:nary');
	});
});

describe('convertOmmlToLatex', () => {
	it('returns an empty string for a non-object input', () => {
		expect(convertOmmlToLatex({})).toBe('');
	});

	it('round-trips a simple fraction back to LaTeX', () => {
		const omml = convertLatexToOmml('\\frac{a}{b}');
		expect(convertOmmlToLatex(omml)).toBe('\\frac{a}{b}');
	});

	it('round-trips a square root', () => {
		const omml = convertLatexToOmml('\\sqrt{x}');
		expect(convertOmmlToLatex(omml)).toBe('\\sqrt{x}');
	});

	it('reverses a superscript', () => {
		const omml = convertLatexToOmml('x^{2}');
		expect(convertOmmlToLatex(omml)).toBe('x^{2}');
	});
});
