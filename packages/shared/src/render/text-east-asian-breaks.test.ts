import { describe, expect, it } from 'vitest';

import {
	followingText,
	isEastAsianChar,
	resolveEastAsianBreakOptions,
	splitEastAsianBreaks,
	splitEastAsianRunPieces,
} from './text-east-asian-breaks';

const FONT = { fontFamily: 'Yu Gothic', fontSizePx: 40 };
const HANG = { hangingPunctuation: true, breakAnywhere: false };
const ANYWHERE = { hangingPunctuation: false, breakAnywhere: true };
const WJ = '\u2060';
const ZW = '\u200B';

describe('resolveEastAsianBreakOptions', () => {
	it('is undefined unless hangingPunct is on or eaLnBrk is off', () => {
		expect(resolveEastAsianBreakOptions({})).toBeUndefined();
		expect(resolveEastAsianBreakOptions({ eaLineBreak: true })).toBeUndefined();
		expect(resolveEastAsianBreakOptions({ hangingPunctuation: false })).toBeUndefined();
		expect(resolveEastAsianBreakOptions({ hangingPunctuation: true })).toStrictEqual(HANG);
		expect(resolveEastAsianBreakOptions({ eaLineBreak: false })).toStrictEqual(ANYWHERE);
	});
});

describe('splitEastAsianBreaks: hangingPunct', () => {
	it('turns 、 and 。 into zero-size inline blocks glued to the previous character', () => {
		const pieces = splitEastAsianBreaks('あいう、えお。', HANG, FONT);
		expect(pieces.map((piece) => piece.text)).toStrictEqual([
			`あいう${WJ}`,
			'、',
			' ',
			`えお${WJ}`,
			'。',
			' ',
		]);
		expect(pieces[1].style).toStrictEqual({ display: 'inline-block', inlineSize: '0px' });
		expect(pieces[2].hangingSpace).toBeTruthy();
		expect(pieces[2].style?.wordSpacing).toMatch(/px$/u);
	});

	it('keeps the source length of every piece, inserted characters excluded', () => {
		const pieces = splitEastAsianBreaks('あいう、えお。', HANG, FONT);
		expect(pieces.reduce((sum, piece) => sum + piece.sourceLength, 0)).toBe(7);
	});

	it("gives the space the mark's advance when nothing can be measured (1em - 0.25em)", () => {
		const [, , space] = splitEastAsianBreaks('あ。い', HANG, { fontSizePx: 40 });
		// No canvas under vitest's node environment: the font-size fallback.
		expect(space.style?.wordSpacing).toBe('30px');
	});

	it('hangs only the marks PowerPoint hangs (COM: never a closing bracket or ！？)', () => {
		for (const ch of [
			'）',
			'」',
			'』',
			'】',
			'〉',
			'》',
			'！',
			'？',
			'：',
			'・',
			'ー',
			'ッ',
			'.',
			',',
		]) {
			expect(splitEastAsianBreaks(`あい${ch}う`, HANG, FONT)).toHaveLength(1);
		}
		for (const ch of ['、', '。', '，', '．']) {
			expect(splitEastAsianBreaks(`あい${ch}う`, HANG, FONT)).toHaveLength(4);
		}
	});

	it('leaves a mark followed by a closing bracket alone (the pair wraps together)', () => {
		expect(splitEastAsianBreaks('あい。」う', HANG, FONT)).toHaveLength(1);
	});

	it('leaves Latin text untouched', () => {
		const text = 'Hello world, this is a test. (Latin text) wraps normally.';
		expect(splitEastAsianBreaks(text, HANG, FONT)).toStrictEqual([
			{ text, sourceLength: text.length },
		]);
		expect(splitEastAsianBreaks(text, ANYWHERE, FONT)).toStrictEqual([
			{ text, sourceLength: text.length },
		]);
	});
});

describe('splitEastAsianBreaks: eaLnBrk="0"', () => {
	it('puts a break opportunity between East Asian characters, before 」 and 。 too', () => {
		const [piece] = splitEastAsianBreaks('用」ッ。', ANYWHERE, FONT);
		expect(piece.text).toBe(`用${ZW}」${ZW}ッ${ZW}。`);
		expect(piece.sourceLength).toBe(4);
	});

	it('never splits a Latin word, only its boundary with East Asian text', () => {
		const [piece] = splitEastAsianBreaks('語English', ANYWHERE, FONT);
		expect(piece.text).toBe(`語${ZW}English`);
	});

	it('still hangs 。 when hangingPunct is also on (no break inserted before it)', () => {
		const pieces = splitEastAsianBreaks(
			'天気です。明日',
			{ hangingPunctuation: true, breakAnywhere: true },
			FONT,
		);
		expect(pieces[0].text).toBe(`天${ZW}気${ZW}で${ZW}す${WJ}`);
		expect(pieces[1].text).toBe('。');
		expect(pieces[3].text).toBe(`明${ZW}日`);
	});
});

describe('splitEastAsianBreaks: the character after the text (run boundaries)', () => {
	const BOTH = { hangingPunctuation: true, breakAnywhere: true };

	it('with kinsoku off, a closing bracket in the next run may start a line (COM: XBREAK)', () => {
		const [piece] = splitEastAsianBreaks('まみむめ', ANYWHERE, FONT, '」やゆよわ');
		expect(piece.text).toBe(`ま${ZW}み${ZW}む${ZW}め${ZW}`);
		expect(piece.sourceLength).toBe(4);
	});

	it('adds no break before a following space, Latin word boundary, or paragraph end', () => {
		expect(splitEastAsianBreaks('語', ANYWHERE, FONT, ' next')[0].text).toBe('語');
		expect(splitEastAsianBreaks('語', ANYWHERE, FONT)[0].text).toBe('語');
		expect(splitEastAsianBreaks('abc', ANYWHERE, FONT, 'def')[0].text).toBe('abc');
	});

	it('does not hang a run-final mark when the next run opens with a closing bracket', () => {
		// COM XHANG_BRACKET: `ばびぶべ。` + `」ぼぱぴ` breaks as ばびぶ | べ。」ぼ.
		expect(splitEastAsianBreaks('ばびぶべ。', HANG, FONT, '」ぼぱぴ')).toHaveLength(1);
		expect(splitEastAsianBreaks('ばびぶべ。', HANG, FONT, 'ざじ')).toHaveLength(3);
	});

	it('hangs the mark before a bracket once kinsoku is off (COM: はひふへ。 | 」ほまみ)', () => {
		const pieces = splitEastAsianBreaks('はひふへ。」ほ', BOTH, FONT);
		expect(pieces.map((piece) => piece.text)).toStrictEqual([
			`は${ZW}ひ${ZW}ふ${ZW}へ${WJ}`,
			'。',
			' ',
			`」${ZW}ほ`,
		]);
	});

	it('adds no break before a hanging mark that opens the next run', () => {
		expect(splitEastAsianBreaks('らりるれ', BOTH, FONT, '。を')[0].text).toBe(
			`ら${ZW}り${ZW}る${ZW}れ`,
		);
	});
});

describe('followingText', () => {
	it('is the next non-empty text, or the given `next` after the last', () => {
		const pieces = [{ text: 'a' }, { text: '' }, { text: 'b' }];
		expect(followingText(pieces, 0, 'z')).toBe('b');
		expect(followingText(pieces, 2, 'z')).toBe('z');
		expect(followingText(pieces, 2)).toBeUndefined();
	});

	it('stops at an inline equation', () => {
		const runs = [{ text: 'a' }, { text: '', equation: {} }, { text: 'b' }];
		expect(followingText(runs, 0, 'z')).toBeUndefined();
	});
});

describe('splitEastAsianRunPieces', () => {
	it("carries each piece's own style and lays the hanging layout on top", () => {
		const out = splitEastAsianRunPieces(
			[{ text: 'あ。', style: { color: 'red', letterSpacing: '0.1px' } }],
			HANG,
			FONT,
		);
		expect(out[0].style).toStrictEqual({ color: 'red', letterSpacing: '0.1px' });
		expect(out[1].style).toStrictEqual({
			color: 'red',
			letterSpacing: '0.1px',
			display: 'inline-block',
			inlineSize: '0px',
		});
		expect(out[2].hangingSpace).toBeTruthy();
	});

	it('looks ahead into the next piece, and past the last into `next`', () => {
		const pieces = [
			{ text: 'がぎぐげ。', style: {} },
			{ text: '」', style: {} },
		];
		expect(splitEastAsianRunPieces(pieces, HANG, FONT).map((p) => p.text)).toStrictEqual([
			'がぎぐげ。',
			'」',
		]);
		expect(
			splitEastAsianRunPieces([{ text: 'がぎ。', style: {} }], HANG, FONT, '」').map((p) => p.text),
		).toStrictEqual(['がぎ。']);
	});

	it('returns the pieces unchanged without options', () => {
		const pieces = [{ text: 'あ。', style: {} }];
		expect(splitEastAsianRunPieces(pieces, undefined, FONT)).toStrictEqual([
			{ text: 'あ。', style: {}, sourceLength: 2 },
		]);
	});
});

describe('isEastAsianChar', () => {
	it('recognises kana, kanji, hangul and fullwidth forms, not Latin', () => {
		for (const ch of ['あ', 'ア', '漢', '한', '，', '」']) {
			expect(isEastAsianChar(ch)).toBeTruthy();
		}
		for (const ch of ['a', ',', ' ', '1']) {
			expect(isEastAsianChar(ch)).toBeFalsy();
		}
	});
});
