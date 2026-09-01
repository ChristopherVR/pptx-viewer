import { stripXmlOrderSuffix } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { convertLatexToOmml } from './latex-to-omml';
import { convertOmmlToLatex } from './omml-to-latex';
import { convertOmmlToMathMl } from './omml-to-mathml';

type Rec = Record<string, unknown>;

const r = (t: string, nor = false): Rec =>
	nor ? { 'm:r': { 'm:rPr': { 'm:nor': { '@_val': '1' } }, 'm:t': t } } : { 'm:r': { 'm:t': t } };
const v = (val: string): Rec => ({ '@_val': val });

/**
 * Framework-neutral structural skeleton: content tags in document order (order
 * markers stripped, arrays flattened), property nodes dropped, run text kept.
 * Two OMML trees with the same skeleton hold the same constructs and text.
 */
function skeleton(node: unknown): unknown {
	if (!node || typeof node !== 'object') {
		return node;
	}
	const out: unknown[] = [];
	for (const [key, value] of Object.entries(node as Rec)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const tag = stripXmlOrderSuffix(key);
		if (tag === 'm:t') {
			out.push(['#', String(value)]);
			continue;
		}
		if (tag.endsWith('Pr')) {
			continue;
		}
		for (const item of Array.isArray(value) ? value : [value]) {
			out.push([tag, skeleton(item)]);
		}
	}
	return out;
}

function oMath(content: Rec): Rec {
	return { 'm:oMathPara': { 'm:oMath': content } };
}

/** OMML -> LaTeX -> OMML keeps every construct and every character. */
function expectOmmlRoundTrip(content: Rec): string {
	const latex = convertOmmlToLatex(oMath(content));
	const back = convertLatexToOmml(latex);
	expect({ latex, skeleton: skeleton(back) }).toStrictEqual({
		latex,
		skeleton: skeleton(oMath(content)),
	});
	return latex;
}

/** LaTeX -> OMML -> LaTeX reaches a fixed point after one trip. */
function expectLatexStable(latex: string): void {
	const once = convertOmmlToLatex(convertLatexToOmml(latex));
	const twice = convertOmmlToLatex(convertLatexToOmml(once));
	expect(twice).toBe(once);
	expect(once.length).toBeGreaterThan(0);
}

describe('convertOmmlToLatex: constructs the forward renderer supports', () => {
	it('matrix: bare m:m becomes \\begin{matrix}', () => {
		const matrix = {
			'm:m': { 'm:mr': [{ 'm:e': [r('a'), r('b')] }, { 'm:e': [r('c'), r('d')] }] },
		};
		const latex = expectOmmlRoundTrip(matrix);
		expect(latex).toBe('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
	});

	it('matrix: delimited m:m picks pmatrix / bmatrix / vmatrix from m:d', () => {
		const inner = { 'm:m': { 'm:mr': [{ 'm:e': [r('1'), r('0')] }, { 'm:e': [r('0'), r('1')] }] } };
		const paren = { 'm:d': { 'm:e': inner } };
		expect(expectOmmlRoundTrip(paren)).toBe('\\begin{pmatrix}1 & 0 \\\\ 0 & 1\\end{pmatrix}');
		const bracket = {
			'm:d': { 'm:dPr': { 'm:begChr': v('['), 'm:endChr': v(']') }, 'm:e': inner },
		};
		expect(expectOmmlRoundTrip(bracket)).toBe('\\begin{bmatrix}1 & 0 \\\\ 0 & 1\\end{bmatrix}');
		const bars = {
			'm:d': { 'm:dPr': { 'm:begChr': v('|'), 'm:endChr': v('|') }, 'm:e': inner },
		};
		expect(expectOmmlRoundTrip(bars)).toBe('\\begin{vmatrix}1 & 0 \\\\ 0 & 1\\end{vmatrix}');
	});

	it('accents map to \\hat, \\tilde, \\vec, \\dot, \\ddot, \\bar', () => {
		const cases: Array<[string, string]> = [
			['̂', '\\hat{x}'],
			['̃', '\\tilde{x}'],
			['⃗', '\\vec{x}'],
			['̇', '\\dot{x}'],
			['̈', '\\ddot{x}'],
			['̅', '\\bar{x}'],
			['̄', '\\bar{x}'],
		];
		for (const [chr, expected] of cases) {
			const acc = { 'm:acc': { 'm:accPr': { 'm:chr': v(chr) }, 'm:e': r('x') } };
			expect(expectOmmlRoundTrip(acc)).toBe(expected);
		}
	});

	it('accent without m:chr defaults to \\hat; unknown accents become \\overset', () => {
		expect(convertOmmlToLatex(oMath({ 'm:acc': { 'm:e': r('x') } }))).toBe('\\hat{x}');
		const odd = { 'm:acc': { 'm:accPr': { 'm:chr': v('⃑') }, 'm:e': r('x') } };
		const latex = convertOmmlToLatex(oMath(odd));
		expect(latex).toBe('\\overset{⃑}{x}');
		expect(convertOmmlToLatex(convertLatexToOmml(latex))).toBe(latex);
	});

	it('bar: m:barPr/m:pos chooses \\overline vs \\underline', () => {
		const over = { 'm:bar': { 'm:barPr': { 'm:pos': v('top') }, 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(over)).toBe('\\overline{x}');
		const under = { 'm:bar': { 'm:barPr': { 'm:pos': v('bot') }, 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(under)).toBe('\\underline{x}');
		expect(convertOmmlToLatex(oMath({ 'm:bar': { 'm:e': r('x') } }))).toBe('\\overline{x}');
	});

	it('limLow / limUpp become \\underset / \\overset', () => {
		const low = { 'm:limLow': { 'm:e': r('x'), 'm:lim': r('n') } };
		expect(expectOmmlRoundTrip(low)).toBe('\\underset{n}{x}');
		const upp = { 'm:limUpp': { 'm:e': r('x'), 'm:lim': r('n') } };
		expect(expectOmmlRoundTrip(upp)).toBe('\\overset{n}{x}');
	});

	it('groupChr becomes \\underbrace / \\overbrace, with limLow/limUpp labels', () => {
		const under = { 'm:groupChr': { 'm:groupChrPr': { 'm:chr': v('⏟') }, 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(under)).toBe('\\underbrace{x}');
		const over = {
			'm:groupChr': { 'm:groupChrPr': { 'm:chr': v('⏞'), 'm:pos': v('top') }, 'm:e': r('x') },
		};
		expect(expectOmmlRoundTrip(over)).toBe('\\overbrace{x}');
		const labelled = { 'm:limLow': { 'm:e': under, 'm:lim': r('n') } };
		expect(expectOmmlRoundTrip(labelled)).toBe('\\underbrace{x}_{n}');
		const labelledTop = { 'm:limUpp': { 'm:e': over, 'm:lim': r('n') } };
		expect(expectOmmlRoundTrip(labelledTop)).toBe('\\overbrace{x}^{n}');
		expect(convertOmmlToLatex(oMath({ 'm:groupChr': { 'm:e': r('x') } }))).toBe('\\underbrace{x}');
	});

	it('sPre becomes {}_{sub}^{sup}{base}', () => {
		const pre = { 'm:sPre': { 'm:sub': r('Z'), 'm:sup': r('A'), 'm:e': r('X') } };
		expect(expectOmmlRoundTrip(pre)).toBe('{}_{Z}^{A}{X}');
	});

	it('eqArr becomes \\begin{aligned} rows separated by \\\\, keeping & marks', () => {
		const arr = {
			'm:eqArr': {
				'm:e': [
					{ 'm:r': [{ 'm:t': 'a' }, { 'm:t': '&' }, { 'm:t': '=' }, { 'm:t': 'b' }] },
					r('c'),
				],
			},
		};
		expect(expectOmmlRoundTrip(arr)).toBe('\\begin{aligned}a&=b \\\\ c\\end{aligned}');
	});

	it('cases: m:d{ eqArr } with a lone opening brace becomes \\begin{cases}', () => {
		const cases = {
			'm:d': {
				'm:dPr': { 'm:begChr': v('{'), 'm:endChr': v('') },
				'm:e': { 'm:eqArr': { 'm:e': [r('a'), r('b')] } },
			},
		};
		expect(expectOmmlRoundTrip(cases)).toBe('\\begin{cases}a \\\\ b\\end{cases}');
	});

	it('borderBox becomes \\boxed; box stays a transparent group', () => {
		expect(expectOmmlRoundTrip({ 'm:borderBox': { 'm:e': r('x') } })).toBe('\\boxed{x}');
		expect(convertOmmlToLatex(oMath({ 'm:box': { 'm:e': r('x') } }))).toBe('x');
	});

	it('phantom variants round-trip', () => {
		expect(expectOmmlRoundTrip({ 'm:phant': { 'm:e': r('x') } })).toBe('\\phantom{x}');
		const h = {
			'm:phant': { 'm:phantPr': { 'm:zeroAsc': v('1'), 'm:zeroDesc': v('1') }, 'm:e': r('x') },
		};
		expect(expectOmmlRoundTrip(h)).toBe('\\hphantom{x}');
		const vp = { 'm:phant': { 'm:phantPr': { 'm:zeroWid': v('1') }, 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(vp)).toBe('\\vphantom{x}');
	});

	it('func: PowerPoint-style m:func with a limLow name becomes \\lim_{...}', () => {
		const lim = {
			'm:func': {
				'm:fName': {
					'm:limLow': {
						'm:e': r('lim', true),
						'm:lim': { 'm:r': [{ 'm:t': 'x' }, { 'm:t': '→' }, { 'm:t': '0' }] },
					},
				},
				'm:e': r('f'),
			},
		};
		expect(expectOmmlRoundTrip(lim)).toBe('\\lim_{x\\to 0}{f}');
		const sin = {
			'm:func': {
				'm:fName': { 'm:sSup': { 'm:e': r('sin', true), 'm:sup': r('2') } },
				'm:e': r('x'),
			},
		};
		expect(expectOmmlRoundTrip(sin)).toBe('\\sin^{2}{x}');
	});

	it('func: names outside the known set use \\operatorname', () => {
		const custom = { 'm:func': { 'm:fName': r('sgn', true), 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(custom)).toBe('\\operatorname{sgn}{x}');
	});

	it('delimiters: braces and angle brackets are spelled as commands', () => {
		const braces = {
			'm:d': { 'm:dPr': { 'm:begChr': v('{'), 'm:endChr': v('}') }, 'm:e': r('x') },
		};
		expect(expectOmmlRoundTrip(braces)).toBe('\\left\\{x\\right\\}');
		const angles = {
			'm:d': { 'm:dPr': { 'm:begChr': v('⟨'), 'm:endChr': v('⟩') }, 'm:e': r('x') },
		};
		expect(expectOmmlRoundTrip(angles)).toBe('\\left\\langle x\\right\\rangle ');
		const open = { 'm:d': { 'm:dPr': { 'm:begChr': v(''), 'm:endChr': v('|') }, 'm:e': r('x') } };
		expect(expectOmmlRoundTrip(open)).toBe('\\left.x\\right|');
	});

	it('delimiters: several m:e arguments are joined with the separator', () => {
		const pair = { 'm:d': { 'm:dPr': { 'm:sepChr': v(',') }, 'm:e': [r('a'), r('b')] } };
		expect(convertOmmlToLatex(oMath(pair))).toBe('\\left(a,b\\right)');
	});

	it('nary: limLoc undOvr survives as \\limits', () => {
		const sum = {
			'm:nary': {
				'm:naryPr': { 'm:chr': v('∑'), 'm:limLoc': v('undOvr') },
				'm:sub': r('i'),
				'm:sup': r('n'),
				'm:e': r('x'),
			},
		};
		expect(expectOmmlRoundTrip(sum)).toBe('\\sum\\limits_{i}^{n}{x}');
	});

	it('fraction types: lin and noBar keep their m:fPr through the trip', () => {
		const lin = { 'm:f': { 'm:fPr': { 'm:type': v('lin') }, 'm:num': r('a'), 'm:den': r('b') } };
		expect(expectOmmlRoundTrip(lin)).toBe('\\sfrac{a}{b}');
		const noBar = {
			'm:f': { 'm:fPr': { 'm:type': v('noBar') }, 'm:num': r('n'), 'm:den': r('k') },
		};
		expect(expectOmmlRoundTrip(noBar)).toBe('{n \\atop k}');
		const binom = { 'm:d': { 'm:e': noBar } };
		expect(expectOmmlRoundTrip(binom)).toBe('\\binom{n}{k}');
	});

	it('script bases wider than one atom are braced so the script stays attached', () => {
		const wide = {
			'm:sSup': { 'm:e': { 'm:r': [{ 'm:t': 'a' }, { 'm:t': 'b' }] }, 'm:sup': r('2') },
		};
		expect(expectOmmlRoundTrip(wide)).toBe('{ab}^{2}');
		const delimited = { 'm:sSup': { 'm:e': { 'm:d': { 'm:e': r('x') } }, 'm:sup': r('n') } };
		expect(expectOmmlRoundTrip(delimited)).toBe('\\left(x\\right)^{n}');
	});

	it('run text escapes LaTeX syntax characters and keeps spaces', () => {
		const braceRun = oMath({ 'm:r': [{ 'm:t': '{' }, { 'm:t': '_' }, { 'm:t': ' ' }] });
		const latex = convertOmmlToLatex(braceRun);
		expect(latex).toBe('\\{\\_\\ ');
		expect(skeleton(convertLatexToOmml(latex))).toStrictEqual(skeleton(braceRun));
		expect(convertOmmlToLatex(oMath(r('a b', true)))).toBe('\\text{a b}');
	});

	it('reads m:t stored as a #text object or a number', () => {
		expect(convertOmmlToLatex(oMath({ 'm:r': { 'm:t': { '#text': 'x' } } }))).toBe('x');
		expect(convertOmmlToLatex(oMath({ 'm:r': { 'm:t': 7 } }))).toBe('7');
	});
});

describe('convertOmmlToLatex: graceful fallback', () => {
	it('never returns empty for an unknown construct that holds text', () => {
		const exotic = {
			'm:weird': {
				'm:weirdPr': { 'm:x': v('1') },
				'm:e': { 'm:r': [{ 'm:t': 'a' }, { 'm:t': 'b' }] },
			},
		};
		expect(convertOmmlToLatex(oMath(exotic))).toBe('ab');
	});

	it('keeps text around an unknown construct in document order', () => {
		const mixed = {
			'm:r#pptx-order-0': { 'm:t': '1' },
			'm:weird#pptx-order-1': { 'm:e': r('2') },
			'm:r#pptx-order-2': { 'm:t': '3' },
		};
		expect(convertOmmlToLatex(oMath(mixed))).toBe('123');
	});

	it('joins several m:oMath paragraphs instead of dropping all but the first', () => {
		const multi = { 'm:oMathPara': { 'm:oMath': [r('a'), r('b')] } };
		expect(convertOmmlToLatex(multi)).toBe('a b');
	});
});

describe('latex -> omml -> latex stability', () => {
	const sources = [
		'\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}',
		'\\begin{bmatrix}1 & 0 \\\\ 0 & 1\\end{bmatrix}',
		'\\begin{cases}x & x>0 \\\\ 0 & x\\leq 0\\end{cases}',
		'\\begin{aligned}a&=b \\\\ c&=d\\end{aligned}',
		'\\hat{x}+\\vec{v}-\\bar{y}',
		'\\overline{AB}\\underline{z}',
		'\\underset{n\\to\\infty}{\\text{lim}}{a_{n}}',
		'\\underbrace{a+b}_{n}\\overbrace{c}^{m}',
		'{}_{Z}^{A}{X}',
		'\\boxed{E=mc^{2}}',
		'\\phantom{x}\\hphantom{y}\\vphantom{z}',
		'\\lim_{x\\to 0}{f}',
		'\\sin^{2}{\\theta }+\\cos^{2}{\\theta }=1',
		'\\operatorname{sgn}{x}',
		'\\sum\\limits_{i=1}^{n}{a_{i}}',
		'\\left\\{x\\right\\}\\left\\langle y\\right\\rangle ',
		'\\binom{n}{k}{a \\atop b}\\sfrac{c}{d}',
		'\\left(a+b\\right)^{n}',
		'x=\\frac{-b\\pm \\sqrt{b^{2}-4ac}}{2a}',
	];
	for (const source of sources) {
		it(`is stable for ${source}`, () => {
			expectLatexStable(source);
		});
	}

	it('every construct the forward renderer supports still renders after a trip', () => {
		for (const source of sources) {
			const omml = convertLatexToOmml(convertOmmlToLatex(convertLatexToOmml(source)));
			if (!source.includes('phantom')) {
				expect({ source, mathml: convertOmmlToMathMl(omml) }).not.toStrictEqual({
					source,
					mathml: '',
				});
			}
		}
	});
});
