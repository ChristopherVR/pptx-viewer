/**
 * Compute CSS properties for East Asian (kinsoku) line-breaking rules.
 *
 * These properties enforce CJK typographic rules based on OOXML paragraph
 * properties `eaLineBreak` and `latinLineBreak`. (`hangingPunctuation`, and
 * the kinsoku-off half of `eaLineBreak`, are run-text pieces built by
 * `text-east-asian-breaks`, not CSS.)
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

	// East Asian line break (`eaLnBrk`). With it on (the default in every
	// PowerPoint master) PowerPoint applies its kinsoku rules, and those are
	// CSS `strict` (COM: neither a small kana nor the prolonged-sound mark `ー`
	// may start a line; `normal` lets both through). It says
	// NOTHING about Latin words: mapping it to `break-all` (as this once did)
	// split every Latin paragraph mid-word ("electro / nic"). Only `latinLnBrk`
	// licenses mid-word breaks in Latin text (below).
	//
	// With it off, PowerPoint drops kinsoku entirely (COM: a line may start
	// with `」`, `。` or a small kana). No CSS value does that without also
	// splitting Latin words, so the break opportunities are inserted into the
	// run text instead (`text-east-asian-breaks`); this map only keeps an
	// over-long word from overflowing. `a:pPr/@hangingPunct` is realised there
	// too: CSS `hanging-punctuation` is Safari-only, and its `last` value hangs
	// closing brackets, which PowerPoint never does.
	if (textStyle.eaLineBreak === true) {
		result.lineBreak = 'strict';
		result.wordBreak = 'normal';
		result.overflowWrap = 'break-word';
	} else if (textStyle.eaLineBreak === false) {
		result.overflowWrap = 'break-word';
	}

	// Latin line break: when true, allow breaking within Latin words (useful for
	// mixed CJK/Latin content where Latin text should also wrap).
	if (textStyle.latinLineBreak === true) {
		result.wordBreak = 'break-all';
		result.overflowWrap = 'break-word';
	}

	return result;
}
