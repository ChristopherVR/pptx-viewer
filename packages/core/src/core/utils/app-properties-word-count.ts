/**
 * The word count PowerPoint records in `docProps/app.xml` (`<Words>`) for one
 * paragraph of text.
 *
 * PowerPoint's counter is NOT a split on whitespace. Measured over COM
 * (PowerPoint 16.0: author a text box through `TextRange.Text`, `SaveAs`, read
 * `app.xml`), each of these is one word:
 *
 * - a run of letters and digits, joined across an apostrophe or hyphen between
 *   two of them (`don't`, `world-wide`) and across `.` or `,` between two
 *   digits (`2.5`, `3,000`);
 * - a run of punctuation (`--`, `...`, `!)`), so `foo.bar` is three words and
 *   `$4` / `50%` are two;
 * - every Han, Hiragana or Katakana character on its own;
 * - every tab and every line break (`a:br`);
 * - whitespace that does not trail a word or punctuation run, that is
 *   whitespace opening the paragraph or following a tab or line break (a
 *   paragraph of three spaces counts one word).
 *
 * @module app-properties-word-count
 */

/** The character standing in for an `a:br` line break in paragraph text. */
export const LINE_BREAK_CHAR = '\v';

type TokenKind = 'word' | 'ideograph' | 'punct' | 'space' | 'control' | 'none';

const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const DIGIT_CHAR = /\p{N}/u;
const IDEOGRAPH_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SPACE_CHAR = /\s/u;
const WORD_JOINERS = new Set(["'", '’', '-']);
const NUMBER_JOINERS = new Set(['.', ',']);

function isWordChar(char: string | undefined): boolean {
	return char !== undefined && WORD_CHAR.test(char) && !IDEOGRAPH_CHAR.test(char);
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && DIGIT_CHAR.test(char);
}

/** True when `chars[index]` joins the word characters on either side of it. */
function isJoiner(chars: readonly string[], index: number): boolean {
	const char = chars[index]!;
	const before = chars[index - 1];
	const after = chars[index + 1];
	if (WORD_JOINERS.has(char)) {
		return isWordChar(before) && isWordChar(after);
	}
	return NUMBER_JOINERS.has(char) && isDigit(before) && isDigit(after);
}

function classify(chars: readonly string[], index: number): Exclude<TokenKind, 'none'> {
	const char = chars[index]!;
	if (char === '\t' || char === LINE_BREAK_CHAR) {
		return 'control';
	}
	if (IDEOGRAPH_CHAR.test(char)) {
		return 'ideograph';
	}
	if (WORD_CHAR.test(char) || isJoiner(chars, index)) {
		return 'word';
	}
	return SPACE_CHAR.test(char) ? 'space' : 'punct';
}

/**
 * Count the words PowerPoint records for one paragraph's text, with each
 * `a:br` spelled {@link LINE_BREAK_CHAR}.
 */
export function countParagraphWords(text: string): number {
	const chars = Array.from(text);
	let count = 0;
	let previous: TokenKind = 'none';
	for (let index = 0; index < chars.length; index++) {
		const kind = classify(chars, index);
		if (kind === 'space') {
			// Whitespace trailing a word or punctuation run belongs to it; any
			// other whitespace is a word of its own.
			if (previous === 'none' || previous === 'control') {
				count++;
			}
			previous = 'space';
			continue;
		}
		if (kind === 'ideograph' || kind === 'control' || kind !== previous) {
			count++;
		}
		previous = kind;
	}
	return count;
}
