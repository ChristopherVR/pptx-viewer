import { describe, expect, it } from 'vitest';

import { countParagraphWords, LINE_BREAK_CHAR } from './app-properties-word-count';

/**
 * Every expectation below is the `<Words>` value PowerPoint 16.0 wrote to
 * `docProps/app.xml` after `SaveAs` of a one-text-box deck authored through
 * COM (`TextRange.Text = ...`), so the table is ground truth, not a guess.
 */
const MEASURED: Array<[string, number]> = [
	['one two three', 3],
	[`one${LINE_BREAK_CHAR}two`, 3],
	[`a${LINE_BREAK_CHAR}${LINE_BREAK_CHAR}b`, 4],
	['hello, world-wide  foo.bar - x', 8],
	['1 2.5 3,000 $4 50%', 7],
	['a\tb c', 4],
	['a\t\tb', 4],
	['a \t b', 4],
	['\t', 1],
	['   ', 1],
	['a !) b', 3],
	['你好世界', 4],
	['ab 你好 cd', 4],
	["don't stop-me now! (really) e.g. U.S.A. a/b a_b a@b.com", 28],
	['', 0],
];

describe('countParagraphWords', () => {
	it.each(MEASURED)('counts %j as %i word(s), as PowerPoint does', (text, expected) => {
		expect(countParagraphWords(text)).toBe(expected);
	});
});
