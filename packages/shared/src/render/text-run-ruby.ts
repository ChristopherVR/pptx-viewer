/**
 * `text-run-ruby`: the phonetic guide (`a:ruby`, furigana / pinyin) as a
 * framework-neutral run field.
 *
 * Core has always parsed a ruby run in full (`rubyText`, `rubyAlignment`,
 * `rubyFontSize`, `rubyStyle`) and has always saved it back, but the annotation
 * was RENDERED in React alone: `buildParagraphs` never read `seg.rubyText`, so
 * the guide simply vanished in Vue, Angular, Svelte and Vanilla (the base text
 * still painted, which is why nothing looked broken).
 *
 * This module resolves the annotation into a `{ text, style }` descriptor that
 * rides the run, so each binding renders the same `<ruby>` / `<rt>` markup from
 * the same decision.
 *
 * @module render/text-run-ruby
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import { normalizeHexColor } from './fill-style';
import type { RunFontSpec } from './text-metric-tracking';
import type { RunStyle } from './text-run-style';

/** A run's phonetic guide, ready to render as `<rt>` above the base text. */
export interface RunRuby {
	/** The annotation itself (`a:ruby/a:rt`), e.g. the furigana reading. */
	text: string;
	/** Inline style for the `<rt>` element (size, family, alignment, colour). */
	style: RunStyle;
}

/**
 * Ruby annotations render at half the base size when `a:rubyPr` declares none.
 * PowerPoint's own default, and what React has always used.
 */
const RUBY_SIZE_RATIO = 0.5;

/**
 * `a:rubyPr/@algn` -> CSS `text-align` for the annotation over its base.
 *
 * The three distributed values (`dist`, `distCat`, `distLetter`) all spread the
 * annotation across the base's width, which is `justify` in CSS; anything else
 * (including the omitted attribute) centres, as PowerPoint does.
 */
function rubyTextAlign(alignment: string | undefined): string {
	if (alignment === 'l') {
		return 'left';
	}
	if (alignment === 'r') {
		return 'right';
	}
	if (alignment === 'dist' || alignment === 'distCat' || alignment === 'distLetter') {
		return 'justify';
	}
	return 'center';
}

/**
 * Resolve a segment's phonetic guide, or `undefined` when it carries none.
 *
 * @param segment    The authored segment (already field-substituted upstream).
 * @param baseFontSizePx The rendered size of the base text, in px.
 * @param blockFont  What a run inheriting no font of its own takes from the body.
 * @param baseColor  The base run's resolved colour, used when the annotation
 *                   declares none.
 * @returns The annotation and its `<rt>` style, or `undefined`.
 */
export function resolveRunRuby(
	segment: TextSegment,
	baseFontSizePx: number,
	blockFont: RunFontSpec,
	baseColor?: string,
): RunRuby | undefined {
	const text = segment.rubyText;
	if (typeof text !== 'string' || text.length === 0) {
		return undefined;
	}
	const authoredFamily = segment.rubyStyle?.fontFamily ?? segment.style?.fontFamily;
	const baseSize = Number.isFinite(baseFontSizePx) ? baseFontSizePx : DEFAULT_TEXT_FONT_SIZE;
	const style: RunStyle = {
		fontSize: `${segment.rubyFontSize ?? baseSize * RUBY_SIZE_RATIO}px`,
		fontFamily: authoredFamily
			? getSubstituteFontFamily(authoredFamily)
			: (blockFont.fontFamily ?? DEFAULT_FONT_FAMILY),
		textAlign: rubyTextAlign(segment.rubyAlignment),
	};
	const color = segment.rubyStyle?.color;
	if (color) {
		style.color = normalizeHexColor(color, baseColor);
	}
	return { text, style };
}
