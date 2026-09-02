/**
 * Compute CSS properties for East Asian (kinsoku) line-breaking rules.
 *
 * These properties enforce CJK typographic rules based on OOXML paragraph
 * properties: `eaLineBreak`, `hangingPunctuation`, and `latinLineBreak`.
 * Returns a plain CSS style map (binding-agnostic); each binding maps the
 * keys onto its own style binding.
 */

import type { TextStyle } from 'pptx-viewer-core';

/** A plain CSS style map (keys are CSS properties; binding-agnostic). */
export type KinsokuStyle = Record<string, string | number>;

/**
 * Compute the kinsoku line-break CSS style map for a TextStyle.
 *
 * @param textStyle - The TextStyle containing paragraph-level flags.
 * @returns A style map with line-breaking rules (empty when no style given).
 */
export function getKinsokuLineBreakStyles(textStyle: TextStyle | undefined): KinsokuStyle {
	if (!textStyle) {
		return {};
	}

	const result: KinsokuStyle = {};

	// East Asian line break (ECMA-376 21.1.2.2.7 `eaLnBrk`): when true, an East
	// Asian word may be broken between characters, which is exactly what the
	// browser's default `word-break: normal` already does for CJK runs. It says
	// NOTHING about Latin words: `eaLnBrk="1"` is the default in every
	// PowerPoint master, so mapping it to `break-all` (as this once did) split
	// every Latin paragraph mid-word ("electro / nic"). Only `latinLnBrk`
	// licenses mid-word breaks in Latin text (below). When false, use strict
	// mode to prevent breaks at kinsoku characters.
	if (textStyle.eaLineBreak === true) {
		result.lineBreak = 'normal';
		result.wordBreak = 'normal';
		result.overflowWrap = 'break-word';
	} else if (textStyle.eaLineBreak === false) {
		result.lineBreak = 'strict';
		result.overflowWrap = 'break-word';
	}

	// Hanging punctuation: when enabled, CJK punctuation at the end of a line is
	// allowed to "hang" past the text box edge rather than forcing a line break.
	if (textStyle.hangingPunctuation === true) {
		result.hangingPunctuation = 'last';
	} else if (textStyle.hangingPunctuation === false) {
		result.hangingPunctuation = 'none';
	}

	// Latin line break: when true, allow breaking within Latin words (useful for
	// mixed CJK/Latin content where Latin text should also wrap).
	if (textStyle.latinLineBreak === true) {
		result.wordBreak = 'break-all';
		result.overflowWrap = 'break-word';
	}

	return result;
}
