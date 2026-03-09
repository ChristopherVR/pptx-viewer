import { describe, it, expect } from 'vitest';
import { OmmlLatexConverter } from './OmmlLatexConverter';

describe('OmmlLatexConverter', () => {
	const converter = new OmmlLatexConverter();

	it('should convert a simple fraction m:f', () => {
		const omml = {
			'm:f': {
				'm:num': { 'm:r': { 'm:t': 'a' } },
				'm:den': { 'm:r': { 'm:t': 'b' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\frac{a}{b}');
	});

	it('should convert superscript m:sSup', () => {
		const omml = {
			'm:sSup': {
				'm:e': { 'm:r': { 'm:t': 'x' } },
				'm:sup': { 'm:r': { 'm:t': '2' } },
			},
		};
		expect(converter.convert(omml)).toBe('x^{2}');
	});

	it('should convert subscript m:sSub', () => {
		const omml = {
			'm:sSub': {
				'm:e': { 'm:r': { 'm:t': 'a' } },
				'm:sub': { 'm:r': { 'm:t': 'n' } },
			},
		};
		expect(converter.convert(omml)).toBe('a_{n}');
	});

	it('should convert combined sub+sup m:sSubSup', () => {
		const omml = {
			'm:sSubSup': {
				'm:e': { 'm:r': { 'm:t': 'x' } },
				'm:sub': { 'm:r': { 'm:t': 'i' } },
				'm:sup': { 'm:r': { 'm:t': 'n' } },
			},
		};
		expect(converter.convert(omml)).toBe('x_{i}^{n}');
	});

	it('should convert square root m:rad without degree', () => {
		const omml = {
			'm:rad': {
				'm:deg': {},
				'm:e': { 'm:r': { 'm:t': 'x' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\sqrt{x}');
	});

	it('should convert nth root m:rad with degree', () => {
		const omml = {
			'm:rad': {
				'm:deg': { 'm:r': { 'm:t': '3' } },
				'm:e': { 'm:r': { 'm:t': 'y' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\sqrt[3]{y}');
	});

	it('should convert inline text m:r with m:t', () => {
		const omml = {
			'm:r': { 'm:t': 'hello' },
		};
		expect(converter.convert(omml)).toBe('hello');
	});

	it('should return empty string for empty/null input', () => {
		expect(converter.convert({})).toBe('');
	});

	it('should return empty string for null-like OMML', () => {
		expect(converter.convert({ 'm:rPr': {} })).toBe('');
	});

	it('should convert overline m:bar (top position)', () => {
		const omml = {
			'm:bar': {
				'm:barPr': { 'm:pos': { '@_val': 'top' } },
				'm:e': { 'm:r': { 'm:t': 'x' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\overline{x}');
	});

	it('should convert underline m:bar (bot position)', () => {
		const omml = {
			'm:bar': {
				'm:barPr': { 'm:pos': { '@_val': 'bot' } },
				'm:e': { 'm:r': { 'm:t': 'x' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\underline{x}');
	});

	it('should convert a matrix m:m', () => {
		const omml = {
			'm:m': {
				'm:mr': [
					{ 'm:e': [{ 'm:r': { 'm:t': 'a' } }, { 'm:r': { 'm:t': 'b' } }] },
					{ 'm:e': [{ 'm:r': { 'm:t': 'c' } }, { 'm:r': { 'm:t': 'd' } }] },
				],
			},
		};
		expect(converter.convert(omml)).toBe('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
	});

	it('should convert a delimiter m:d (parentheses)', () => {
		const omml = {
			'm:d': {
				'm:dPr': {
					'm:begChr': { '@_val': '(' },
					'm:endChr': { '@_val': ')' },
				},
				'm:e': { 'm:r': { 'm:t': 'x+y' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\left(x+y\\right)');
	});

	it('should convert m:limLow (lower limit)', () => {
		const omml = {
			'm:limLow': {
				'm:e': { 'm:r': { 'm:t': 'lim' } },
				'm:lim': { 'm:r': { 'm:t': 'x\\to 0' } },
			},
		};
		expect(converter.convert(omml)).toBe('lim_{x\\to 0}');
	});

	it('should convert underbrace via m:groupChr', () => {
		const omml = {
			'm:groupChr': {
				'm:groupChrPr': {
					'm:chr': { '@_val': '\u23DF' },
					'm:pos': { '@_val': 'bot' },
				},
				'm:e': { 'm:r': { 'm:t': 'abc' } },
			},
		};
		expect(converter.convert(omml)).toBe('\\underbrace{abc}');
	});

	it('should fall back to text collection when structured rendering yields nothing', () => {
		const omml = {
			'some:wrapper': {
				'm:t': 'fallback text',
			},
		};
		expect(converter.convert(omml)).toBe('fallback text');
	});
});
