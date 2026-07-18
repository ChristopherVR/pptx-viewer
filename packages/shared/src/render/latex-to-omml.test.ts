import { describe, expect, it } from 'vitest';

import { convertLatexToOmml, convertOmmlToLatex } from './latex-to-omml';

/** Helper: extract the m:oMath node from a convertLatexToOmml result. */
function getOmml(latex: string): Record<string, unknown> {
	const result = convertLatexToOmml(latex);
	const para = result['m:oMathPara'] as Record<string, unknown> | undefined;
	return (para?.['m:oMath'] as Record<string, unknown>) ?? {};
}

/** Helper: extract the text from a run node. */
function runText(run: unknown): string {
	if (!run || typeof run !== 'object') {
		return '';
	}
	const r = run as Record<string, unknown>;
	return String(r['m:t'] ?? '');
}

describe('convertLatexToOmml', () => {
	// ── Empty / whitespace ───────────────────────────────────────────────

	it('returns empty object for empty string', () => {
		expect(convertLatexToOmml('')).toStrictEqual({});
	});

	it('returns empty object for whitespace only', () => {
		expect(convertLatexToOmml('   ')).toStrictEqual({});
	});

	// ── Output wrapper ───────────────────────────────────────────────────

	it('wraps output in m:oMathPara / m:oMath', () => {
		const result = convertLatexToOmml('x');
		expect(result).toHaveProperty('m:oMathPara');
		const para = result['m:oMathPara'] as Record<string, unknown>;
		expect(para).toHaveProperty('m:oMath');
	});

	// ── Simple variable ──────────────────────────────────────────────────

	it("converts 'x' to OMML with m:r containing x", () => {
		const oMath = getOmml('x');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(run).toBeDefined();
		expect(runText(run)).toBe('x');
	});

	it('converts multiple letters to multiple runs', () => {
		const oMath = getOmml('ab');
		const runs = oMath['m:r'];
		expect(runs).toBeDefined();
		if (Array.isArray(runs)) {
			expect(runs).toHaveLength(2);
			expect(runText(runs[0])).toBe('a');
			expect(runText(runs[1])).toBe('b');
		}
	});

	// ── Greek letters ────────────────────────────────────────────────────

	it('converts \\alpha to m:r with Greek alpha character', () => {
		const oMath = getOmml('\\alpha');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('α');
	});

	it('converts \\Omega to m:r with Greek Omega character', () => {
		const oMath = getOmml('\\Omega');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('Ω');
	});

	it('converts \\pi to m:r with pi character', () => {
		const oMath = getOmml('\\pi');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('π');
	});

	// ── Operators ────────────────────────────────────────────────────────

	it('converts \\times to m:r with times character', () => {
		const oMath = getOmml('\\times');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('×');
	});

	it('converts \\infty to m:r with infinity character', () => {
		const oMath = getOmml('\\infty');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('∞');
	});

	// ── Fraction ─────────────────────────────────────────────────────────

	it('converts \\frac{a}{b} to m:f with numerator and denominator', () => {
		const oMath = getOmml('\\frac{a}{b}');
		const frac = oMath['m:f'] as Record<string, unknown>;
		expect(frac).toBeDefined();
		expect(frac).toHaveProperty('m:num');
		expect(frac).toHaveProperty('m:den');
	});

	it('fraction numerator contains the correct text', () => {
		const oMath = getOmml('\\frac{x}{y}');
		const frac = oMath['m:f'] as Record<string, unknown>;
		const num = frac['m:num'] as Record<string, unknown>;
		const run = num['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('x');
	});

	it('fraction denominator contains the correct text', () => {
		const oMath = getOmml('\\frac{x}{y}');
		const frac = oMath['m:f'] as Record<string, unknown>;
		const den = frac['m:den'] as Record<string, unknown>;
		const run = den['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('y');
	});

	// ── Superscript ──────────────────────────────────────────────────────

	it('converts x^2 to m:sSup', () => {
		const oMath = getOmml('x^2');
		const sup = oMath['m:sSup'] as Record<string, unknown>;
		expect(sup).toBeDefined();
		expect(sup).toHaveProperty('m:e');
		expect(sup).toHaveProperty('m:sup');
	});

	it('converts x^{10} to m:sSup with grouped exponent', () => {
		const oMath = getOmml('x^{10}');
		const sup = oMath['m:sSup'] as Record<string, unknown>;
		expect(sup).toBeDefined();
	});

	// ── Subscript ────────────────────────────────────────────────────────

	it('converts a_i to m:sSub', () => {
		const oMath = getOmml('a_i');
		const sub = oMath['m:sSub'] as Record<string, unknown>;
		expect(sub).toBeDefined();
		expect(sub).toHaveProperty('m:e');
		expect(sub).toHaveProperty('m:sub');
	});

	it('converts a_{mn} to m:sSub with grouped subscript', () => {
		const oMath = getOmml('a_{mn}');
		const sub = oMath['m:sSub'] as Record<string, unknown>;
		expect(sub).toBeDefined();
	});

	// ── Sub + Sup ────────────────────────────────────────────────────────

	it('converts x_{i}^{2} (braced) to m:sSubSup', () => {
		const oMath = getOmml('x_{i}^{2}');
		const subsup = oMath['m:sSubSup'] as Record<string, unknown>;
		expect(subsup).toBeDefined();
		expect(subsup).toHaveProperty('m:e');
		expect(subsup).toHaveProperty('m:sub');
		expect(subsup).toHaveProperty('m:sup');
	});

	it('converts x^{2}_{i} (braced, reversed) to m:sSubSup', () => {
		const oMath = getOmml('x^{2}_{i}');
		const subsup = oMath['m:sSubSup'] as Record<string, unknown>;
		expect(subsup).toBeDefined();
	});

	it('converts x_i^2 (unbraced) to nested m:sSub containing m:sSup', () => {
		const oMath = getOmml('x_i^2');
		const sub = oMath['m:sSub'] as Record<string, unknown>;
		expect(sub).toBeDefined();
	});

	it('converts x^2_i (unbraced, reversed) to nested m:sSup containing m:sSub', () => {
		const oMath = getOmml('x^2_i');
		const sup = oMath['m:sSup'] as Record<string, unknown>;
		expect(sup).toBeDefined();
	});

	// ── Square root ──────────────────────────────────────────────────────

	it('converts \\sqrt{x} to m:rad with degHide', () => {
		const oMath = getOmml('\\sqrt{x}');
		const rad = oMath['m:rad'] as Record<string, unknown>;
		expect(rad).toBeDefined();
		expect(rad).toHaveProperty('m:e');
		const radPr = rad['m:radPr'] as Record<string, unknown>;
		expect(radPr).toBeDefined();
	});

	it('converts \\sqrt[3]{x} to m:rad with degree', () => {
		const oMath = getOmml('\\sqrt[3]{x}');
		const rad = oMath['m:rad'] as Record<string, unknown>;
		expect(rad).toBeDefined();
		expect(rad).toHaveProperty('m:deg');
		expect(rad).toHaveProperty('m:e');
	});

	// ── Nary ─────────────────────────────────────────────────────────────

	it('converts \\sum_{i}^{n}{x} to m:nary', () => {
		const oMath = getOmml('\\sum_{i}^{n}{x}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		expect(nary).toBeDefined();
		expect(nary).toHaveProperty('m:naryPr');
		expect(nary).toHaveProperty('m:e');
	});

	it('nary has correct operator character for sum', () => {
		const oMath = getOmml('\\sum_{i}^{n}{x}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		const naryPr = nary['m:naryPr'] as Record<string, unknown>;
		const chr = naryPr['m:chr'] as Record<string, unknown>;
		expect(chr['@_val']).toBe('∑');
	});

	it('converts \\int to m:nary with integral character', () => {
		const oMath = getOmml('\\int{f}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		expect(nary).toBeDefined();
		const naryPr = nary['m:naryPr'] as Record<string, unknown>;
		const chr = naryPr['m:chr'] as Record<string, unknown>;
		expect(chr['@_val']).toBe('∫');
	});

	it('converts \\prod to m:nary with product character', () => {
		const oMath = getOmml('\\prod{x}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		const naryPr = nary['m:naryPr'] as Record<string, unknown>;
		const chr = naryPr['m:chr'] as Record<string, unknown>;
		expect(chr['@_val']).toBe('∏');
	});

	it('nary hides sub when no subscript provided', () => {
		const oMath = getOmml('\\sum^{n}{x}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		const naryPr = nary['m:naryPr'] as Record<string, unknown>;
		const subHide = naryPr['m:subHide'] as Record<string, unknown>;
		expect(subHide?.['@_val']).toBe('1');
	});

	it('nary hides sup when no superscript provided', () => {
		const oMath = getOmml('\\sum_{i}{x}');
		const nary = oMath['m:nary'] as Record<string, unknown>;
		const naryPr = nary['m:naryPr'] as Record<string, unknown>;
		const supHide = naryPr['m:supHide'] as Record<string, unknown>;
		expect(supHide?.['@_val']).toBe('1');
	});

	// ── Text command ─────────────────────────────────────────────────────

	it('converts \\text{hello} to m:r with normal flag', () => {
		const oMath = getOmml('\\text{hello}');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('hello');
		const rPr = run['m:rPr'] as Record<string, unknown>;
		const nor = rPr['m:nor'] as Record<string, unknown>;
		expect(nor['@_val']).toBe('1');
	});

	// ── Function names ───────────────────────────────────────────────────

	it('converts \\sin{x} to m:func', () => {
		const oMath = getOmml('\\sin{x}');
		const func = oMath['m:func'] as Record<string, unknown>;
		expect(func).toBeDefined();
		expect(func).toHaveProperty('m:fName');
		expect(func).toHaveProperty('m:e');
	});

	it('converts \\cos{x} to m:func', () => {
		const oMath = getOmml('\\cos{x}');
		const func = oMath['m:func'] as Record<string, unknown>;
		expect(func).toBeDefined();
	});

	it('converts \\log{x} to m:func', () => {
		const oMath = getOmml('\\log{x}');
		const func = oMath['m:func'] as Record<string, unknown>;
		expect(func).toBeDefined();
	});

	// ── Delimiters ───────────────────────────────────────────────────────

	it('converts \\left(x\\right) to m:d', () => {
		const oMath = getOmml('\\left(x\\right)');
		const delim = oMath['m:d'] as Record<string, unknown>;
		expect(delim).toBeDefined();
		expect(delim).toHaveProperty('m:e');
	});

	it('converts \\left[x\\right] with custom delimiters', () => {
		const oMath = getOmml('\\left[x\\right]');
		const delim = oMath['m:d'] as Record<string, unknown>;
		expect(delim).toBeDefined();
		const dPr = delim['m:dPr'] as Record<string, unknown>;
		expect(dPr).toBeDefined();
		const begChr = dPr['m:begChr'] as Record<string, unknown>;
		expect(begChr['@_val']).toBe('[');
	});

	// ── Unknown commands ─────────────────────────────────────────────────

	it('renders unknown commands as normal text runs', () => {
		const oMath = getOmml('\\xyz');
		const run = oMath['m:r'] as Record<string, unknown>;
		expect(runText(run)).toBe('xyz');
	});

	// ── Complex expressions ──────────────────────────────────────────────

	it('converts a fraction with superscript on top', () => {
		const result = convertLatexToOmml('\\frac{x^2}{y}');
		expect(result).toHaveProperty('m:oMathPara');
		const oMath = getOmml('\\frac{x^2}{y}');
		const frac = oMath['m:f'] as Record<string, unknown>;
		expect(frac).toBeDefined();
		const num = frac['m:num'] as Record<string, unknown>;
		expect(num['m:sSup']).toBeDefined();
	});

	it('preserves plain + and = as text runs', () => {
		const oMath = getOmml('a+b=c');
		const runs = oMath['m:r'];
		expect(runs).toBeDefined();
	});
});

describe('convertOmmlToLatex', () => {
	// ── Null / empty inputs ──────────────────────────────────────────────

	it('returns empty string for null input', () => {
		expect(convertOmmlToLatex(null as unknown as Record<string, unknown>)).toBe('');
	});

	it('returns empty string for undefined input', () => {
		expect(convertOmmlToLatex(undefined as unknown as Record<string, unknown>)).toBe('');
	});

	it('returns empty string for empty object', () => {
		expect(convertOmmlToLatex({})).toBe('');
	});

	it('returns empty string for non-object input', () => {
		expect(convertOmmlToLatex('text' as unknown as Record<string, unknown>)).toBe('');
	});

	// ── Simple run ───────────────────────────────────────────────────────

	it('converts a simple text run to the letter', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
		expect(convertOmmlToLatex(omml)).toBe('x');
	});

	it('converts a numeric run', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': '42' } } };
		expect(convertOmmlToLatex(omml)).toBe('42');
	});

	// ── Greek characters ─────────────────────────────────────────────────

	it('converts Greek alpha back to \\alpha', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'α' } } };
		expect(convertOmmlToLatex(omml).trim()).toBe('\\alpha');
	});

	it('converts Greek beta back to \\beta', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'β' } } };
		expect(convertOmmlToLatex(omml).trim()).toBe('\\beta');
	});

	it('converts Greek Omega back to \\Omega', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'Ω' } } };
		expect(convertOmmlToLatex(omml).trim()).toBe('\\Omega');
	});

	// ── Operators ────────────────────────────────────────────────────────

	it('converts times operator back to \\times', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': '×' } } };
		expect(convertOmmlToLatex(omml).trim()).toBe('\\times');
	});

	it('converts infinity back to \\infty', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': '∞' } } };
		expect(convertOmmlToLatex(omml).trim()).toBe('\\infty');
	});

	// ── Fraction ─────────────────────────────────────────────────────────

	it('converts fraction to \\frac{a}{b}', () => {
		const omml = {
			'm:oMath': {
				'm:f': {
					'm:num': { 'm:r': { 'm:t': 'a' } },
					'm:den': { 'm:r': { 'm:t': 'b' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('\\frac{a}{b}');
	});

	it('converts nested fraction', () => {
		const omml = {
			'm:oMath': {
				'm:f': {
					'm:num': { 'm:r': { 'm:t': '1' } },
					'm:den': {
						'm:f': {
							'm:num': { 'm:r': { 'm:t': 'a' } },
							'm:den': { 'm:r': { 'm:t': 'b' } },
						},
					},
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('\\frac{1}{\\frac{a}{b}}');
	});

	// ── Superscript ──────────────────────────────────────────────────────

	it('converts superscript to x^{2}', () => {
		const omml = {
			'm:oMath': {
				'm:sSup': {
					'm:e': { 'm:r': { 'm:t': 'x' } },
					'm:sup': { 'm:r': { 'm:t': '2' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('x^{2}');
	});

	// ── Subscript ────────────────────────────────────────────────────────

	it('converts subscript to a_{i}', () => {
		const omml = {
			'm:oMath': {
				'm:sSub': {
					'm:e': { 'm:r': { 'm:t': 'a' } },
					'm:sub': { 'm:r': { 'm:t': 'i' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('a_{i}');
	});

	// ── SubSup ───────────────────────────────────────────────────────────

	it('converts sub+sup to x_{i}^{2}', () => {
		const omml = {
			'm:oMath': {
				'm:sSubSup': {
					'm:e': { 'm:r': { 'm:t': 'x' } },
					'm:sub': { 'm:r': { 'm:t': 'i' } },
					'm:sup': { 'm:r': { 'm:t': '2' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('x_{i}^{2}');
	});

	// ── Radical ──────────────────────────────────────────────────────────

	it('converts square root to \\sqrt{x}', () => {
		const omml = {
			'm:oMath': {
				'm:rad': {
					'm:radPr': { 'm:degHide': { '@_val': '1' } },
					'm:e': { 'm:r': { 'm:t': 'x' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('\\sqrt{x}');
	});

	it('converts nth root to \\sqrt[n]{x}', () => {
		const omml = {
			'm:oMath': {
				'm:rad': {
					'm:deg': { 'm:r': { 'm:t': '3' } },
					'm:e': { 'm:r': { 'm:t': 'x' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('\\sqrt[3]{x}');
	});

	// ── Nary ─────────────────────────────────────────────────────────────

	it('converts summation to \\sum', () => {
		const omml = {
			'm:oMath': {
				'm:nary': {
					'm:naryPr': { 'm:chr': { '@_val': '∑' } },
					'm:sub': { 'm:r': { 'm:t': 'i' } },
					'm:sup': { 'm:r': { 'm:t': 'n' } },
					'm:e': { 'm:r': { 'm:t': 'x' } },
				},
			},
		};
		const result = convertOmmlToLatex(omml);
		expect(result).toContain('\\sum');
		expect(result).toContain('_{i}');
		expect(result).toContain('^{n}');
		expect(result).toContain('{x}');
	});

	it('converts integral to \\int', () => {
		const omml = {
			'm:oMath': {
				'm:nary': {
					'm:naryPr': { 'm:chr': { '@_val': '∫' } },
					'm:sub': { 'm:r': { 'm:t': '0' } },
					'm:sup': { 'm:r': { 'm:t': '1' } },
					'm:e': { 'm:r': { 'm:t': 'f' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toContain('\\int');
	});

	it('hides subscript when subHide=1', () => {
		const omml = {
			'm:oMath': {
				'm:nary': {
					'm:naryPr': {
						'm:chr': { '@_val': '∫' },
						'm:subHide': { '@_val': '1' },
					},
					'm:sub': { 'm:r': { 'm:t': '0' } },
					'm:sup': { 'm:r': { 'm:t': '1' } },
					'm:e': { 'm:r': { 'm:t': 'f' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).not.toContain('_{0}');
	});

	// ── Delimiter ────────────────────────────────────────────────────────

	it('converts delimiter to \\left[...\\right]', () => {
		const omml = {
			'm:oMath': {
				'm:d': {
					'm:dPr': {
						'm:begChr': { '@_val': '[' },
						'm:endChr': { '@_val': ']' },
					},
					'm:e': { 'm:r': { 'm:t': 'x' } },
				},
			},
		};
		const result = convertOmmlToLatex(omml);
		expect(result).toContain('\\left[');
		expect(result).toContain('\\right]');
	});

	it('uses default parens when no dPr delimiters specified', () => {
		const omml = {
			'm:oMath': {
				'm:d': { 'm:e': { 'm:r': { 'm:t': 'x' } } },
			},
		};
		const result = convertOmmlToLatex(omml);
		expect(result).toContain('\\left(');
		expect(result).toContain('\\right)');
	});

	// ── Function ─────────────────────────────────────────────────────────

	it('converts function application', () => {
		const omml = {
			'm:oMath': {
				'm:func': {
					'm:fName': { 'm:r': { 'm:t': 'sin' } },
					'm:e': { 'm:r': { 'm:t': 'x' } },
				},
			},
		};
		const result = convertOmmlToLatex(omml);
		expect(result).toContain('sin');
		expect(result).toContain('{x}');
	});

	// ── Normal text ──────────────────────────────────────────────────────

	it('converts normal text to \\text{}', () => {
		const omml = {
			'm:oMath': {
				'm:r': {
					'm:t': 'hello',
					'm:rPr': { 'm:nor': { '@_val': '1' } },
				},
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('\\text{hello}');
	});

	// ── oMathPara wrapper ────────────────────────────────────────────────

	it('navigates through m:oMathPara to find m:oMath', () => {
		const omml = { 'm:oMathPara': { 'm:oMath': { 'm:r': { 'm:t': 'z' } } } };
		expect(convertOmmlToLatex(omml)).toBe('z');
	});

	// ── Direct oMath node ────────────────────────────────────────────────

	it('treats the object itself as oMath if no wrapper found', () => {
		const omml = { 'm:r': { 'm:t': 'y' } };
		expect(convertOmmlToLatex(omml)).toBe('y');
	});

	// ── Empty run ────────────────────────────────────────────────────────

	it('skips empty text runs', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': '' } } };
		expect(convertOmmlToLatex(omml)).toBe('');
	});

	// ── Round-trips ──────────────────────────────────────────────────────

	it('round-trips a simple fraction back to LaTeX', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('\\frac{a}{b}'))).toBe('\\frac{a}{b}');
	});

	it('round-trips a square root', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('\\sqrt{x}'))).toBe('\\sqrt{x}');
	});

	it('reverses a superscript', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('x^{2}'))).toBe('x^{2}');
	});
});

describe('operator/construct interleaving order', () => {
	// The collapsed fast-xml-parser shape groups siblings by tag, so an
	// interleaved sequence (sSup, r, sSup, ...) is emitted with
	// `#pptx-order-N` position-marked keys (the same convention core's load
	// pipeline uses; the save-side builder strips the markers). Grouped-by-tag
	// sequences keep the compact shape.

	it('emits order-marked keys for a^{2}+b^{2}=c^{2}', () => {
		const oMath = getOmml('a^{2}+b^{2}=c^{2}');
		// sSup(a,2), '+', sSup(b,2), '=', sSup(c,2)
		expect(Object.keys(oMath)).toStrictEqual([
			'm:sSup#pptx-order-0',
			'm:r#pptx-order-1',
			'm:sSup#pptx-order-2',
			'm:r#pptx-order-3',
			'm:sSup#pptx-order-4',
		]);
	});

	it('round-trips a^{2}+b^{2}=c^{2} back to identical LaTeX', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('a^{2}+b^{2}=c^{2}'))).toBe('a^{2}+b^{2}=c^{2}');
	});

	it('round-trips interleaving inside a fraction argument', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('\\frac{a+b^{2}+c}{d}'))).toBe(
			'\\frac{a+b^{2}+c}{d}',
		);
	});

	it('round-trips a trig identity with interleaved functions and operators', () => {
		expect(convertOmmlToLatex(convertLatexToOmml('e^{x}+1=0'))).toBe('e^{x}+1=0');
	});

	it('keeps grouped-by-tag sequences in the compact merged shape (no markers)', () => {
		const hasMarkers = (latex: string): boolean =>
			Object.keys(getOmml(latex)).some((key) => key.includes('#pptx-order-'));
		expect(hasMarkers('a+b=c')).toBeFalsy();
		expect(hasMarkers('x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}')).toBeFalsy();
		expect(hasMarkers('\\frac{a}{b}')).toBeFalsy();
	});

	it('reverses standalone m:box nodes (e.g. from real OMML) transparently', () => {
		const omml = {
			'm:oMath': {
				'm:box': { 'm:e': { 'm:r': { 'm:t': 'x' } } },
			},
		};
		expect(convertOmmlToLatex(omml)).toBe('x');
	});
});
