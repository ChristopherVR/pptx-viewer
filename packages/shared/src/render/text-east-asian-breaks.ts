/**
 * East Asian line breaking the browser cannot be asked for in CSS: PowerPoint's
 * hanging punctuation (`a:pPr/@hangingPunct`) and its kinsoku switch
 * (`a:pPr/@eaLnBrk`).
 *
 * Ground truth (PowerPoint COM, Slide.Export of 20pt Yu Gothic paragraphs in
 * boxes a fraction of an em too narrow for the next character):
 *
 *  - `hangingPunct="1"` keeps an overflowing `、` `。` `，` `．` on the line,
 *    drawn past the right margin. NOTHING else hangs: closing brackets
 *    (`）` `」` `』` `】` `〉` `》`), `！` `？` `：` `・`, the prolonged-sound
 *    mark and small kana all wrap exactly as with `hangingPunct="0"`, pulling
 *    the preceding character down with them.
 *  - `eaLnBrk="0"` switches the kinsoku rules off: a line may then start with
 *    `」`, `。`, `、` or a small kana, i.e. East Asian text breaks between any
 *    two characters. Latin words still break only between words.
 *
 * Only Safari implements CSS `hanging-punctuation`, and CSS `line-break:
 * anywhere` / `word-break: break-all` also split Latin words, so both are done
 * in the run text instead, as pieces every binding already renders:
 *
 *  - A hanging character becomes a zero-inline-size `inline-block` (so the
 *    line breaker never counts it), glued to the character before it with a
 *    WORD JOINER (so it cannot be pushed to the next line on its own), and
 *    followed by an ordinary space whose `word-spacing` makes it exactly the
 *    punctuation's own advance. Mid-line that space restores the advance, so
 *    nothing moves; at a line end it is trailing white space, which CSS hangs
 *    or collapses, so the punctuation paints past the margin, as in PowerPoint.
 *    (A negative margin does not work: Chromium decides a break before
 *    applying an inline's end margin.)
 *  - With kinsoku off, a ZERO WIDTH SPACE between two East Asian characters
 *    is a break opportunity no kinsoku rule can veto (UAX #14 LB8 outranks the
 *    "no break before closing punctuation" rules).
 *
 * @module text-east-asian-breaks
 */

import type { RunFontSpec } from './text-metric-tracking';
import type { RunStyle } from './text-run-style';

/** Which of the two behaviours a paragraph asks for. */
export interface EastAsianBreakOptions {
	/** `a:pPr/@hangingPunct="1"`. */
	hangingPunctuation: boolean;
	/** `a:pPr/@eaLnBrk="0"`: break between any two East Asian characters. */
	breakAnywhere: boolean;
}

/** One piece of a run after the East Asian pass. */
export interface EastAsianPiece {
	text: string;
	/** Characters of the SOURCE text this piece stands for (inserted ones excluded). */
	sourceLength: number;
	/** Style to lay over the run's own; absent for plain text. */
	style?: RunStyle;
	/**
	 * The space after a hanging character. It must survive the trailing-space
	 * trim (`paragraph-trailing-space`): it IS the character's advance.
	 */
	hangingSpace?: true;
}

/** The characters PowerPoint lets hang (COM-verified, see the module doc). */
const HANGING = new Set(['\u3001', '\u3002', '\uFF0C', '\uFF0E', '\uFF61', '\uFF64']);

/**
 * Characters that may not start a line under kinsoku; a hanging character
 * directly followed by one keeps its ordinary layout (the pair wraps together).
 */
const NO_START = new Set([...'）」』】〕〉》］｝〙〗〟’”'].concat([...HANGING]));

const WORD_JOINER = '\u2060';
const ZERO_WIDTH_SPACE = '\u200B';

/** Resolve a paragraph's flags; `undefined` when neither behaviour applies. */
export function resolveEastAsianBreakOptions(props: {
	hangingPunctuation?: boolean;
	eaLineBreak?: boolean;
}): EastAsianBreakOptions | undefined {
	const hangingPunctuation = props.hangingPunctuation === true;
	const breakAnywhere = props.eaLineBreak === false;
	return hangingPunctuation || breakAnywhere ? { hangingPunctuation, breakAnywhere } : undefined;
}

/** Whether `ch` is an East Asian (CJK / kana / hangul / fullwidth) character. */
export function isEastAsianChar(ch: string): boolean {
	const cp = ch.codePointAt(0) ?? 0;
	return (
		(cp >= 0x1100 && cp <= 0x11ff) ||
		(cp >= 0x2e80 && cp <= 0x9fff) ||
		(cp >= 0xa960 && cp <= 0xa97f) ||
		(cp >= 0xac00 && cp <= 0xd7ff) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe30 && cp <= 0xfe4f) ||
		(cp >= 0xff00 && cp <= 0xffef) ||
		(cp >= 0x20000 && cp <= 0x3ffff)
	);
}

let measureContext: CanvasRenderingContext2D | null | undefined;

function measure(text: string, font: RunFontSpec): number | undefined {
	if (measureContext === undefined) {
		try {
			measureContext =
				typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
		} catch {
			measureContext = null;
		}
	}
	if (!measureContext || !font.fontSizePx) {
		return undefined;
	}
	const family = font.fontFamily || 'sans-serif';
	measureContext.font = `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${font.fontSizePx}px ${family}`;
	const width = measureContext.measureText(text).width;
	return width > 0 ? width : undefined;
}

/**
 * The extra `word-spacing` that makes a space exactly as wide as `ch`. Falls
 * back to font-size fractions (a fullwidth mark is 1em, a halfwidth one
 * 0.5em, a space about 0.25em) when nothing can be measured.
 */
function hangSpaceWordSpacing(ch: string, font: RunFontSpec): string {
	const size = font.fontSizePx ?? 16;
	const glyph = measure(ch, font) ?? (ch >= '\uFF61' ? size / 2 : size);
	const space = measure(' ', font) ?? size / 4;
	return `${Math.round((glyph - space) * 1000) / 1000}px`;
}

/**
 * Split `text` into the pieces that realise `options` (see the module doc).
 * Returns the text as one plain piece when nothing applies, which is every
 * run without East Asian punctuation or with both behaviours off.
 */
export function splitEastAsianBreaks(
	text: string,
	options: EastAsianBreakOptions | undefined,
	font: RunFontSpec,
): EastAsianPiece[] {
	if (!options || !text) {
		return [{ text, sourceLength: text.length }];
	}
	const chars = [...text];
	const pieces: EastAsianPiece[] = [];
	let current = '';
	let currentSource = 0;
	const flush = () => {
		if (current) {
			pieces.push({ text: current, sourceLength: currentSource });
		}
		current = '';
		currentSource = 0;
	};
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i];
		const next = chars[i + 1];
		const hangs =
			options.hangingPunctuation && HANGING.has(ch) && (next === undefined || !NO_START.has(next));
		if (hangs) {
			current += WORD_JOINER;
			flush();
			pieces.push({
				text: ch,
				sourceLength: ch.length,
				style: { display: 'inline-block', inlineSize: '0px' },
			});
			pieces.push({
				text: ' ',
				sourceLength: 0,
				style: { wordSpacing: hangSpaceWordSpacing(ch, font) },
				hangingSpace: true,
			});
			continue;
		}
		current += ch;
		currentSource += ch.length;
		if (
			options.breakAnywhere &&
			next !== undefined &&
			(isEastAsianChar(ch) || isEastAsianChar(next)) &&
			!/\s/u.test(ch) &&
			!/\s/u.test(next) &&
			!(options.hangingPunctuation && HANGING.has(next))
		) {
			current += ZERO_WIDTH_SPACE;
		}
	}
	flush();
	return pieces.length > 0 ? pieces : [{ text, sourceLength: text.length }];
}

/**
 * {@link splitEastAsianBreaks} over a run already split into styled pieces
 * (`splitStyledRun`): each piece's own style carries over, with a hanging
 * piece's extra layout merged on top. The input comes back untouched when
 * `options` is absent.
 */
export function splitEastAsianRunPieces(
	pieces: ReadonlyArray<{ text: string; style: RunStyle }>,
	options: EastAsianBreakOptions | undefined,
	font: RunFontSpec,
): Array<{ text: string; style: RunStyle; sourceLength: number; hangingSpace?: true }> {
	return pieces.flatMap((piece) =>
		splitEastAsianBreaks(piece.text, options, font).map((part) => ({
			text: part.text,
			style: part.style ? { ...piece.style, ...part.style } : piece.style,
			sourceLength: part.sourceLength,
			...(part.hangingSpace ? { hangingSpace: part.hangingSpace } : {}),
		})),
	);
}
