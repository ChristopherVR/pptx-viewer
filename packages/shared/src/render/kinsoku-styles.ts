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

	// East Asian line break: when eaLineBreak is true (the default in most CJK
	// presentations), allow standard CJK line breaks between characters. When
	// false, use strict mode to prevent breaks at kinsoku characters.
	if (textStyle.eaLineBreak === true) {
		result.lineBreak = 'normal';
		result.wordBreak = 'break-all';
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
