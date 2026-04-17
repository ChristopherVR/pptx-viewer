import { describe, it, expect } from 'vitest';

import { GREEK_MAP, OPERATOR_MAP, NARY_MAP, FUNC_NAMES, tokenize } from './latex-to-omml-constants';

// ── GREEK_MAP ────────────────────────────────────────────────────────────

describe('gREEK_MAP', () => {
	it('maps \\alpha to α', () => {
		expect(GREEK_MAP['\\alpha']).toBe('\u03B1');
	});

	it('maps \\beta to β', () => {
		expect(GREEK_MAP['\\beta']).toBe('\u03B2');
	});

	it('maps \\gamma to γ', () => {
		expect(GREEK_MAP['\\gamma']).toBe('\u03B3');
	});

	it('maps \\delta to δ', () => {
		expect(GREEK_MAP['\\delta']).toBe('\u03B4');
	});

	it('maps \\theta to θ', () => {
		expect(GREEK_MAP['\\theta']).toBe('\u03B8');
	});

	it('maps \\lambda to λ', () => {
		expect(GREEK_MAP['\\lambda']).toBe('\u03BB');
	});

	it('maps \\pi to π', () => {
		expect(GREEK_MAP['\\pi']).toBe('\u03C0');
	});

	it('maps \\sigma to σ', () => {
		expect(GREEK_MAP['\\sigma']).toBe('\u03C3');
	});

	it('maps \\omega to ω', () => {
		expect(GREEK_MAP['\\omega']).toBe('\u03C9');
	});

	it('maps \\Gamma to Γ (uppercase)', () => {
		expect(GREEK_MAP['\\Gamma']).toBe('\u0393');
	});

	it('maps \\Delta to Δ (uppercase)', () => {
		expect(GREEK_MAP['\\Delta']).toBe('\u0394');
	});

	it('maps \\Omega to Ω (uppercase)', () => {
		expect(GREEK_MAP['\\Omega']).toBe('\u03A9');
	});

	it('maps \\Sigma to Σ (uppercase)', () => {
		expect(GREEK_MAP['\\Sigma']).toBe('\u03A3');
	});

	it('maps \\Phi to Φ (uppercase)', () => {
		expect(GREEK_MAP['\\Phi']).toBe('\u03A6');
	});

	it('maps \\varepsilon to ε (variant)', () => {
		expect(GREEK_MAP['\\varepsilon']).toBe('\u03B5');
	});

	it('maps \\varphi to ϕ (variant)', () => {
		expect(GREEK_MAP['\\varphi']).toBe('\u03D5');
	});

	it('does not contain non-Greek commands', () => {
		expect(GREEK_MAP['\\frac']).toBeUndefined();
		expect(GREEK_MAP['\\sum']).toBeUndefined();
	});
});

// ── OPERATOR_MAP ─────────────────────────────────────────────────────────

describe('oPERATOR_MAP', () => {
	it('maps \\times to ×', () => {
		expect(OPERATOR_MAP['\\times']).toBe('\u00D7');
	});

	it('maps \\div to ÷', () => {
		expect(OPERATOR_MAP['\\div']).toBe('\u00F7');
	});

	it('maps \\pm to ±', () => {
		expect(OPERATOR_MAP['\\pm']).toBe('\u00B1');
	});

	it('maps \\leq to ≤', () => {
		expect(OPERATOR_MAP['\\leq']).toBe('\u2264');
	});

	it('maps \\geq to ≥', () => {
		expect(OPERATOR_MAP['\\geq']).toBe('\u2265');
	});

	it('maps \\neq to ≠', () => {
		expect(OPERATOR_MAP['\\neq']).toBe('\u2260');
	});

	it('maps \\approx to ≈', () => {
		expect(OPERATOR_MAP['\\approx']).toBe('\u2248');
	});

	it('maps \\in to ∈', () => {
		expect(OPERATOR_MAP['\\in']).toBe('\u2208');
	});

	it('maps \\infty to ∞', () => {
		expect(OPERATOR_MAP['\\infty']).toBe('\u221E');
	});

	it('maps \\to to →', () => {
		expect(OPERATOR_MAP['\\to']).toBe('\u2192');
	});

	it('maps \\Rightarrow to ⇒', () => {
		expect(OPERATOR_MAP['\\Rightarrow']).toBe('\u21D2');
	});

	it('maps \\partial to ∂', () => {
		expect(OPERATOR_MAP['\\partial']).toBe('\u2202');
	});

	it('maps \\forall to ∀', () => {
		expect(OPERATOR_MAP['\\forall']).toBe('\u2200');
	});

	it('maps \\exists to ∃', () => {
		expect(OPERATOR_MAP['\\exists']).toBe('\u2203');
	});

	it('maps short aliases \\le and \\ge', () => {
		expect(OPERATOR_MAP['\\le']).toBe('\u2264');
		expect(OPERATOR_MAP['\\ge']).toBe('\u2265');
	});

	it('maps \\cdot to ·', () => {
		expect(OPERATOR_MAP['\\cdot']).toBe('\u00B7');
	});
});

// ── NARY_MAP ─────────────────────────────────────────────────────────────

describe('nARY_MAP', () => {
	it('maps \\sum to ∑', () => {
		expect(NARY_MAP['\\sum']).toBe('\u2211');
	});

	it('maps \\prod to ∏', () => {
		expect(NARY_MAP['\\prod']).toBe('\u220F');
	});

	it('maps \\int to ∫', () => {
		expect(NARY_MAP['\\int']).toBe('\u222B');
	});

	it('maps \\iint to ∬', () => {
		expect(NARY_MAP['\\iint']).toBe('\u222C');
	});

	it('maps \\iiint to ∭', () => {
		expect(NARY_MAP['\\iiint']).toBe('\u222D');
	});

	it('maps \\oint to ∮', () => {
		expect(NARY_MAP['\\oint']).toBe('\u222E');
	});

	it('maps \\coprod to ∐', () => {
		expect(NARY_MAP['\\coprod']).toBe('\u2210');
	});

	it('maps \\bigcup to ⋃', () => {
		expect(NARY_MAP['\\bigcup']).toBe('\u22C3');
	});

	it('maps \\bigcap to ⋂', () => {
		expect(NARY_MAP['\\bigcap']).toBe('\u22C2');
	});
});

// ── FUNC_NAMES ───────────────────────────────────────────────────────────

describe('fUNC_NAMES', () => {
	it('contains trigonometric functions', () => {
		expect(FUNC_NAMES.has('sin')).toBeTruthy();
		expect(FUNC_NAMES.has('cos')).toBeTruthy();
		expect(FUNC_NAMES.has('tan')).toBeTruthy();
		expect(FUNC_NAMES.has('cot')).toBeTruthy();
		expect(FUNC_NAMES.has('sec')).toBeTruthy();
		expect(FUNC_NAMES.has('csc')).toBeTruthy();
	});

	it('contains inverse trig functions', () => {
		expect(FUNC_NAMES.has('arcsin')).toBeTruthy();
		expect(FUNC_NAMES.has('arccos')).toBeTruthy();
		expect(FUNC_NAMES.has('arctan')).toBeTruthy();
	});

	it('contains hyperbolic functions', () => {
		expect(FUNC_NAMES.has('sinh')).toBeTruthy();
		expect(FUNC_NAMES.has('cosh')).toBeTruthy();
		expect(FUNC_NAMES.has('tanh')).toBeTruthy();
	});

	it('contains logarithmic functions', () => {
		expect(FUNC_NAMES.has('log')).toBeTruthy();
		expect(FUNC_NAMES.has('ln')).toBeTruthy();
		expect(FUNC_NAMES.has('exp')).toBeTruthy();
	});

	it('contains limit-related functions', () => {
		expect(FUNC_NAMES.has('lim')).toBeTruthy();
		expect(FUNC_NAMES.has('min')).toBeTruthy();
		expect(FUNC_NAMES.has('max')).toBeTruthy();
		expect(FUNC_NAMES.has('sup')).toBeTruthy();
		expect(FUNC_NAMES.has('inf')).toBeTruthy();
	});

	it('contains algebraic functions', () => {
		expect(FUNC_NAMES.has('det')).toBeTruthy();
		expect(FUNC_NAMES.has('dim')).toBeTruthy();
		expect(FUNC_NAMES.has('gcd')).toBeTruthy();
		expect(FUNC_NAMES.has('mod')).toBeTruthy();
		expect(FUNC_NAMES.has('ker')).toBeTruthy();
		expect(FUNC_NAMES.has('hom')).toBeTruthy();
		expect(FUNC_NAMES.has('deg')).toBeTruthy();
	});

	it('does not contain non-function names', () => {
		expect(FUNC_NAMES.has('frac')).toBeFalsy();
		expect(FUNC_NAMES.has('sqrt')).toBeFalsy();
		expect(FUNC_NAMES.has('alpha')).toBeFalsy();
	});
});

// ── tokenize ─────────────────────────────────────────────────────────────

describe('tokenize', () => {
	it('tokenizes a single text character', () => {
		expect(tokenize('x')).toStrictEqual([{ type: 'text', value: 'x' }]);
	});

	it('tokenizes multiple text characters individually', () => {
		expect(tokenize('ab')).toStrictEqual([
			{ type: 'text', value: 'a' },
			{ type: 'text', value: 'b' },
		]);
	});

	it('tokenizes a backslash command', () => {
		expect(tokenize('\\alpha')).toStrictEqual([{ type: 'command', value: '\\alpha' }]);
	});

	it('tokenizes multiple commands', () => {
		const tokens = tokenize('\\alpha\\beta');
		expect(tokens).toStrictEqual([
			{ type: 'command', value: '\\alpha' },
			{ type: 'command', value: '\\beta' },
		]);
	});

	it('tokenizes group start and end', () => {
		expect(tokenize('{x}')).toStrictEqual([
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: 'x' },
			{ type: 'group_end', value: '}' },
		]);
	});

	it('tokenizes superscript', () => {
		expect(tokenize('x^2')).toStrictEqual([
			{ type: 'text', value: 'x' },
			{ type: 'superscript', value: '^' },
			{ type: 'text', value: '2' },
		]);
	});

	it('tokenizes subscript', () => {
		expect(tokenize('a_i')).toStrictEqual([
			{ type: 'text', value: 'a' },
			{ type: 'subscript', value: '_' },
			{ type: 'text', value: 'i' },
		]);
	});

	it('tokenizes \\frac{a}{b} correctly', () => {
		expect(tokenize('\\frac{a}{b}')).toStrictEqual([
			{ type: 'command', value: '\\frac' },
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: 'a' },
			{ type: 'group_end', value: '}' },
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: 'b' },
			{ type: 'group_end', value: '}' },
		]);
	});

	it('tokenizes whitespace as whitespace tokens', () => {
		const tokens = tokenize('x y');
		expect(tokens).toStrictEqual([
			{ type: 'text', value: 'x' },
			{ type: 'whitespace', value: ' ' },
			{ type: 'text', value: 'y' },
		]);
	});

	it('tokenizes special escaped characters like \\{', () => {
		expect(tokenize('\\{')).toStrictEqual([{ type: 'command', value: '\\{' }]);
	});

	it('tokenizes double backslash \\\\', () => {
		expect(tokenize('\\\\')).toStrictEqual([{ type: 'command', value: '\\\\' }]);
	});

	it('tokenizes complex expression with mixed elements', () => {
		const tokens = tokenize('x^{2}+y');
		expect(tokens).toStrictEqual([
			{ type: 'text', value: 'x' },
			{ type: 'superscript', value: '^' },
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: '2' },
			{ type: 'group_end', value: '}' },
			{ type: 'text', value: '+' },
			{ type: 'text', value: 'y' },
		]);
	});

	it('tokenizes an empty string to an empty array', () => {
		expect(tokenize('')).toStrictEqual([]);
	});

	it('tokenizes subscript and superscript together', () => {
		const tokens = tokenize('x_i^2');
		expect(tokens).toStrictEqual([
			{ type: 'text', value: 'x' },
			{ type: 'subscript', value: '_' },
			{ type: 'text', value: 'i' },
			{ type: 'superscript', value: '^' },
			{ type: 'text', value: '2' },
		]);
	});

	it('tokenizes nested groups', () => {
		const tokens = tokenize('{a{b}}');
		expect(tokens).toStrictEqual([
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: 'a' },
			{ type: 'group_start', value: '{' },
			{ type: 'text', value: 'b' },
			{ type: 'group_end', value: '}' },
			{ type: 'group_end', value: '}' },
		]);
	});

	it('tokenizes a trailing backslash as an empty command', () => {
		// Lone backslash at end — no following char
		const tokens = tokenize('\\');
		expect(tokens).toStrictEqual([{ type: 'command', value: '\\' }]);
	});

	it('tokenizes consecutive whitespace as separate tokens', () => {
		const tokens = tokenize('a  b');
		expect(tokens).toHaveLength(4);
		expect(tokens[1]).toStrictEqual({ type: 'whitespace', value: ' ' });
		expect(tokens[2]).toStrictEqual({ type: 'whitespace', value: ' ' });
	});
});
