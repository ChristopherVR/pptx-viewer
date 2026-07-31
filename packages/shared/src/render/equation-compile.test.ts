// @vitest-environment jsdom
/**
 * `equation-compile` tests. jsdom is required: `sanitizeMathMl` fails closed to
 * an empty string without a DOM, so the default node environment would make
 * every preview assertion trivially pass on `''`.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	compileEquationTemplateMathMl,
	compileLatexEquation,
	latexToMathMl,
} from './equation-compile';
import { EQUATION_TEMPLATES } from './equation-templates';

/**
 * Spy that records what reaches the sanitiser while still running the real one.
 * The preview markup is injected with `innerHTML`-family sinks in all five
 * bindings, so "the sanitiser is actually in the chain" is the invariant worth
 * pinning; output-shape assertions alone would not catch a dropped call,
 * because `omml-to-mathml` already entity-escapes run text.
 */
const sanitizeSpy = vi.hoisted(() => vi.fn<(markup: string) => void>());
vi.mock(import('./mathml-sanitize'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('./mathml-sanitize')>();
	return {
		sanitizeMathMl: (markup: string): string => {
			sanitizeSpy(markup);
			return actual.sanitizeMathMl(markup);
		},
	};
});

describe('compileLatexEquation', () => {
	it('returns the empty result for empty / whitespace input', () => {
		expect(compileLatexEquation('')).toStrictEqual({ mathml: '', omml: {} });
		expect(compileLatexEquation('   \n ')).toStrictEqual({ mathml: '', omml: {} });
	});

	it('compiles a fraction to both OMML and MathML', () => {
		const { mathml, omml } = compileLatexEquation('\\frac{a}{b}');
		expect(omml).toHaveProperty('m:oMathPara');
		expect(mathml).toContain('<math');
		expect(mathml.toLowerCase()).toContain('mfrac');
	});

	it('keeps sibling order for an interleaved expression', () => {
		const { mathml } = compileLatexEquation('a^2+b^2=c^2');
		const plain = mathml.replaceAll(/<[^>]*>/gu, '');
		expect(plain).toBe('a2+b2=c2');
	});

	it('never throws on malformed LaTeX, it collapses to the empty result', () => {
		expect(() => compileLatexEquation('\\frac{')).not.toThrow();
		expect(compileLatexEquation('\\frac{')).toStrictEqual({ mathml: '', omml: {} });
	});

	it('does not share the empty result object between calls', () => {
		const first = compileLatexEquation('');
		first.omml['m:injected'] = true;
		expect(compileLatexEquation('')).toStrictEqual({ mathml: '', omml: {} });
	});

	it('routes the generated markup through the mathml sanitiser', () => {
		sanitizeSpy.mockClear();
		const { mathml } = compileLatexEquation('\\frac{a}{b}');
		expect(sanitizeSpy).toHaveBeenCalledOnce();
		expect(sanitizeSpy.mock.calls[0]?.[0]).toContain('<math');
		expect(mathml).toContain('<math');
	});

	it('does not call the sanitiser when there is nothing to render', () => {
		sanitizeSpy.mockClear();
		compileLatexEquation('   ');
		expect(sanitizeSpy).not.toHaveBeenCalled();
	});
});

describe('latexToMathMl', () => {
	it('matches the mathml half of compileLatexEquation', () => {
		expect(latexToMathMl('\\sqrt{x}')).toBe(compileLatexEquation('\\sqrt{x}').mathml);
	});

	it('returns an empty string for empty input', () => {
		expect(latexToMathMl('  ')).toBe('');
	});
});

describe('compileEquationTemplateMathMl', () => {
	it('returns one non-empty MathML string per catalogue entry, in order', () => {
		const compiled = compileEquationTemplateMathMl();
		expect(compiled).toHaveLength(EQUATION_TEMPLATES.length);
		expect(compiled.every((markup) => markup.includes('<math'))).toBeTruthy();
		expect(compiled[0]).toBe(latexToMathMl(EQUATION_TEMPLATES[0]!.latex));
	});

	it('recomputes per call rather than caching a DOM-less empty result', () => {
		expect(compileEquationTemplateMathMl()).toStrictEqual(compileEquationTemplateMathMl());
		expect(compileEquationTemplateMathMl()).not.toBe(compileEquationTemplateMathMl());
	});
});
