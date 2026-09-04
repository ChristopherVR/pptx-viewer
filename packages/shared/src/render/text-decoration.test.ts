import { describe, expect, it } from 'vitest';

import {
	resolveUnderlineDecorationStyle,
	resolveUnderlineLineDecoration,
	splitWordsForUnderline,
} from './text-decoration';

describe('resolveUnderlineDecorationStyle', () => {
	it('double strike wins over the underline style', () => {
		expect(resolveUnderlineDecorationStyle(true, 'wavy')).toStrictEqual({
			textDecorationStyle: 'double',
		});
	});

	it('returns undefined for none / empty underline', () => {
		expect(resolveUnderlineDecorationStyle(false, undefined)).toBeUndefined();
		expect(resolveUnderlineDecorationStyle(false, 'none')).toBeUndefined();
		expect(resolveUnderlineDecorationStyle(false, 'notARealStyle')).toBeUndefined();
	});

	it('maps single and double underlines', () => {
		expect(resolveUnderlineDecorationStyle(false, 'sng')).toStrictEqual({
			textDecorationStyle: 'solid',
			textDecorationThickness: '1px',
		});
		expect(resolveUnderlineDecorationStyle(false, 'dbl')).toStrictEqual({
			textDecorationStyle: 'double',
			textDecorationThickness: '1px',
		});
	});

	it('uses thickness for heavy variants', () => {
		expect(resolveUnderlineDecorationStyle(false, 'heavy')!.textDecorationThickness).toBe('3px');
		expect(resolveUnderlineDecorationStyle(false, 'dottedHeavy')!.textDecorationThickness).toBe(
			'3px',
		);
	});

	it('uses underline offset for compound dash / dot patterns', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDash')!.textUnderlineOffset).toBe('2px');
		expect(resolveUnderlineDecorationStyle(false, 'dotDotDash')!.textUnderlineOffset).toBe('3px');
		expect(resolveUnderlineDecorationStyle(false, 'wavyDbl')).toStrictEqual({
			textDecorationStyle: 'wavy',
			textDecorationThickness: '2px',
			textUnderlineOffset: '1px',
		});
	});

	// D2-G3: `u="words"` used to hit the `default: undefined` branch (no
	// explicit style/thickness declared at all); it must now resolve to an
	// intentional single continuous underline rather than an incidental one.
	it("maps 'words' (underline words only) to a single continuous underline as the fallback", () => {
		expect(resolveUnderlineDecorationStyle(false, 'words')).toStrictEqual({
			textDecorationStyle: 'solid',
			textDecorationThickness: '1px',
		});
	});
});

describe('splitWordsForUnderline', () => {
	it('returns an empty array for empty text', () => {
		expect(splitWordsForUnderline('')).toStrictEqual([]);
	});

	it('splits into alternating word/whitespace pieces, marking only words for underline', () => {
		expect(splitWordsForUnderline('Two Words')).toStrictEqual([
			{ text: 'Two', underline: true },
			{ text: ' ', underline: false },
			{ text: 'Words', underline: true },
		]);
	});

	it('handles a single word with no whitespace', () => {
		expect(splitWordsForUnderline('Word')).toStrictEqual([{ text: 'Word', underline: true }]);
	});

	it('handles multiple spaces and leading/trailing whitespace as their own pieces', () => {
		expect(splitWordsForUnderline('  a  b  ')).toStrictEqual([
			{ text: '  ', underline: false },
			{ text: 'a', underline: true },
			{ text: '  ', underline: false },
			{ text: 'b', underline: true },
			{ text: '  ', underline: false },
		]);
	});

	it('treats a tab as whitespace (not underlined)', () => {
		expect(splitWordsForUnderline('a\tb')).toStrictEqual([
			{ text: 'a', underline: true },
			{ text: '\t', underline: false },
			{ text: 'b', underline: true },
		]);
	});
});

describe('resolveUnderlineLineDecoration', () => {
	it('returns undefined when the run has no underline at all', () => {
		expect(
			resolveUnderlineLineDecoration({ widthEmu: 38100, prstDash: 'dash' }, false),
		).toBeUndefined();
	});

	it('returns undefined when the run authors no uLn', () => {
		expect(resolveUnderlineLineDecoration(undefined, true)).toBeUndefined();
	});

	it('converts uLn width (EMU) to a px thickness', () => {
		// 38100 EMU = 4px at 9525 EMU/px.
		expect(resolveUnderlineLineDecoration({ widthEmu: 38100 }, true)).toStrictEqual({
			textDecorationThickness: '4px',
		});
	});

	it('maps a known prstDash to the closest CSS decoration style', () => {
		expect(resolveUnderlineLineDecoration({ prstDash: 'lgDash' }, true)).toStrictEqual({
			textDecorationStyle: 'dashed',
		});
		expect(resolveUnderlineLineDecoration({ prstDash: 'sysDot' }, true)).toStrictEqual({
			textDecorationStyle: 'dotted',
		});
	});

	it('combines width and dash, and ignores an unrecognised dash token', () => {
		expect(
			resolveUnderlineLineDecoration({ widthEmu: 9525, prstDash: 'dash' }, true),
		).toStrictEqual({
			textDecorationThickness: '1px',
			textDecorationStyle: 'dashed',
		});
		expect(
			resolveUnderlineLineDecoration({ widthEmu: 9525, prstDash: 'notARealDash' }, true),
		).toStrictEqual({ textDecorationThickness: '1px' });
	});
});
