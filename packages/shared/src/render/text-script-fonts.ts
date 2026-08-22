/**
 * Per-script (`a:ea` / `a:cs` / `a:sym`) font fallback for one run, as a pure
 * decision function every binding maps onto its own nested-span markup.
 *
 * OOXML authors up to four typefaces per run (`a:latin`, `a:ea`, `a:cs`,
 * `a:sym`), and PowerPoint paints each Unicode script category in ITS OWN
 * font, not the run's `a:latin` face. This was React-only
 * (`renderScriptAwareText` in `text-segment-render.tsx`): the other four
 * bindings applied only `a:latin` to the whole run, so CJK, Arabic, Hebrew and
 * Thai text rendered in the wrong typeface (or the browser's serif default)
 * in Vue, Angular, Svelte and Vanilla.
 *
 * `resolveScriptFontSet` resolves the four faces (PANOSE-substituted, with the
 * run falling back to the text body's own declaration); `splitRunByScriptFont`
 * segments a run's text by script and returns, per piece, the CSS a binding
 * spreads onto a nested span. A binding does nothing but map that descriptor:
 * render `text` plain when a piece carries no `style` override, or a nested
 * span with `style` when it does.
 */

import type { TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily, parsePanoseString } from 'pptx-viewer-core';

import type { RunStyle } from './text-run-style';
import {
	hasDistinctScriptFonts,
	resolveFontForScript,
	segmentByScript,
} from './unicode-script-detection';

/** Resolved per-script font faces for one run, already PANOSE-substituted. */
export interface ScriptFontSet {
	latin: string;
	eastAsia: string;
	complexScript: string;
	symbol: string;
}

/** The `a:ea` / `a:cs` / `a:sym` typeface + PANOSE fields a run or body may carry. */
export type ScriptFontFields = Pick<
	TextStyle,
	| 'eastAsiaFont'
	| 'complexScriptFont'
	| 'symbolFont'
	| 'eastAsiaFontPanose'
	| 'complexScriptFontPanose'
	| 'symbolFontPanose'
>;

/** Substitute one script's font, or fall back to the run's own latin face. */
function substituteScriptFont(
	name: string | undefined,
	panose: string | undefined,
	baseFontFamily: string,
): string {
	return name ? getSubstituteFontFamily(name, parsePanoseString(panose)) : baseFontFamily;
}

/**
 * Resolve the four per-script faces for a run.
 *
 * Every entry goes through the SAME PANOSE substitution as the run's own
 * `a:latin`, for two reasons. The obvious one: a bare `a:ea` name emitted on
 * the inner script span overrides the parent's fallback chain, so a deck
 * whose east-Asian font is not installed drops to the browser's default -
 * which for CJK is a serif, where PowerPoint substitutes a sans. The subtle
 * one: {@link hasDistinctScriptFonts} compares by STRING, so leaving `ea` bare
 * while `latin` carries a substitution chain made an identical typeface look
 * distinct and produced a needless nested span in the first place.
 *
 * `runFields` is checked first (`a:rPr > a:ea` etc.), then `blockFields` (the
 * text body's own declaration), matching how a run inherits any property it
 * does not author itself.
 *
 * @param runFields       The run's own per-script fields, if it authored any.
 * @param blockFields     The text body's per-script fields, as a fallback.
 * @param baseFontFamily  The run's already-resolved `a:latin` face (post
 *                        substitution), used both as the `latin` entry and as
 *                        the fallback for any script the deck names no font for.
 */
export function resolveScriptFontSet(
	runFields: ScriptFontFields | undefined,
	blockFields: ScriptFontFields | undefined,
	baseFontFamily: string,
): ScriptFontSet {
	return {
		latin: baseFontFamily,
		eastAsia: substituteScriptFont(
			runFields?.eastAsiaFont || blockFields?.eastAsiaFont,
			runFields?.eastAsiaFontPanose ?? blockFields?.eastAsiaFontPanose,
			baseFontFamily,
		),
		complexScript: substituteScriptFont(
			runFields?.complexScriptFont || blockFields?.complexScriptFont,
			runFields?.complexScriptFontPanose ?? blockFields?.complexScriptFontPanose,
			baseFontFamily,
		),
		symbol: substituteScriptFont(
			runFields?.symbolFont || blockFields?.symbolFont,
			runFields?.symbolFontPanose ?? blockFields?.symbolFontPanose,
			baseFontFamily,
		),
	};
}

/** One script-tagged piece of a run's text, ready for a binding's nested span. */
export interface ScriptFontPiece {
	text: string;
	/**
	 * CSS for a nested span wrapping `text`, or `undefined` when this piece
	 * needs no span at all (its script's font equals the run's own, so plain
	 * text renders identically). When present it carries the `fontFamily`
	 * override plus the run's own decoration subset, repeated because
	 * `text-decoration-*` does not inherit into a nested span (see
	 * `nestedTextDecorationStyle`).
	 */
	style?: RunStyle;
}

/**
 * Split a run's text into per-script pieces, or `undefined` when it needs no
 * split at all (the common case: `fonts` names no script distinctly from
 * `latin`, so every character already renders in the run's own face).
 *
 * @param text             The run's (or one word-piece's) text.
 * @param fonts            This run's resolved per-script faces.
 * @param baseFontFamily   The run's own `a:latin` face, to compare against.
 * @param nestedDecoration This run's decoration subset, repeated onto any
 *                         piece that needs a span (see {@link ScriptFontPiece.style}).
 */
export function splitRunByScriptFont(
	text: string,
	fonts: ScriptFontSet,
	baseFontFamily: string,
	nestedDecoration?: RunStyle,
): ScriptFontPiece[] | undefined {
	if (!text || !hasDistinctScriptFonts(fonts)) {
		return undefined;
	}
	const scriptRuns = segmentByScript(text);
	if (scriptRuns.length === 0) {
		return undefined;
	}
	if (scriptRuns.length === 1) {
		const font = resolveFontForScript(scriptRuns[0].script, fonts);
		if (font && font !== baseFontFamily) {
			return [{ text, style: { ...nestedDecoration, fontFamily: font } }];
		}
		return undefined;
	}
	return scriptRuns.map((run): ScriptFontPiece => {
		const font = resolveFontForScript(run.script, fonts);
		if (!font || font === baseFontFamily) {
			return { text: run.text };
		}
		return { text: run.text, style: { ...nestedDecoration, fontFamily: font } };
	});
}
