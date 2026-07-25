/**
 * `text-build-spans` - framework-agnostic spec for rendering a staged text
 * build (by paragraph / word / letter).
 *
 * `expandTextBuildAnimations` splits one animation into per-paragraph,
 * per-word or per-character sub-animations keyed `<elementId>::p0` /
 * `::w0-3` / `::c0-7`. Something then has to split the RENDERED text the same
 * way and attach each sub-animation to its own span, or the build has no
 * visible effect and the whole box fades as one.
 *
 * React did that inline in JSX, which left the other four bindings with no
 * by-letter animation at all. This module returns the split as plain data so
 * every binding can render it with its own primitives - the same shape as
 * `notesSegmentsToSpans`.
 *
 * @module render/text-build-spans
 */

import { TEXT_BUILD_ID_SEP } from './animation-timeline-text-build';
import type { ElementAnimationState } from './animation-timeline-types';

/** A styled run of text, as the bindings' paragraph models already hold it. */
export interface TextBuildRun<TStyle> {
	text: string;
	style?: TStyle;
}

/** One rendered piece of a staged text build. */
export interface TextBuildSpan<TStyle = unknown> {
	/**
	 * The sub-animation id (`<elementId>::c0-3`), or `undefined` for the
	 * whitespace between words, which is emitted verbatim and never animated.
	 */
	animId?: string;
	/** The text this span renders. */
	text: string;
	/** True when the sub-animation says the piece is not visible yet. */
	hidden: boolean;
	/** The CSS `animation` shorthand to apply, when one is running. */
	cssAnimation?: string;
	/**
	 * The style of the run this piece came from, passed straight through. A
	 * build splits the text but must not flatten its formatting: without this a
	 * bold or coloured run turns plain for the duration of the animation.
	 */
	style?: TStyle;
}

/** How a paragraph's text is split for its build. */
export type TextBuildGranularity = 'paragraph' | 'word' | 'char';

/** The spec for one paragraph of a staged text build. */
export interface TextBuildSpec<TStyle = unknown> {
	granularity: TextBuildGranularity;
	/** For a paragraph-level build, the single wrapper's id. */
	animId?: string;
	hidden?: boolean;
	cssAnimation?: string;
	/** For word/char builds, the pieces in render order. */
	spans?: TextBuildSpan<TStyle>[];
}

/**
 * Flatten runs into `[character, style]` pairs so a split can carry each
 * character's own formatting through.
 */
function charactersWithStyle<TStyle>(
	runs: ReadonlyArray<TextBuildRun<TStyle>>,
): Array<{ ch: string; style?: TStyle }> {
	const out: Array<{ ch: string; style?: TStyle }> = [];
	for (const run of runs) {
		for (const ch of run.text) {
			out.push({ ch, style: run.style });
		}
	}
	return out;
}

function stateSpan<TStyle>(
	animId: string,
	text: string,
	states: ReadonlyMap<string, ElementAnimationState>,
	style?: TStyle,
): TextBuildSpan<TStyle> {
	const state = states.get(animId);
	return {
		animId,
		text,
		hidden: state?.visible === false,
		cssAnimation: state?.cssAnimation,
		style,
	};
}

/**
 * Resolve how a paragraph should be split, or `undefined` when no staged build
 * targets it (the overwhelmingly common case - callers render normally then).
 *
 * Detection mirrors the ids `expandTextBuildAnimations` emits: a paragraph
 * build registers `::p<i>`, a word build `::w<i>-0`, a char build `::c<i>-0`.
 *
 * @param elementId - The owning element's id.
 * @param paraIndex - Index of this paragraph within the element's text.
 * @param runs      - The paragraph's styled runs, in order.
 * @param states    - Live sub-element animation states for the slide.
 */
export function buildTextBuildSpec<TStyle>(
	elementId: string,
	paraIndex: number,
	runs: ReadonlyArray<TextBuildRun<TStyle>>,
	states: ReadonlyMap<string, ElementAnimationState> | undefined,
): TextBuildSpec<TStyle> | undefined {
	if (!states || states.size === 0) {
		return undefined;
	}

	const paraKey = `${elementId}${TEXT_BUILD_ID_SEP}p${paraIndex}`;
	const paraState = states.get(paraKey);
	if (paraState) {
		return {
			granularity: 'paragraph',
			animId: paraKey,
			hidden: paraState.visible === false,
			cssAnimation: paraState.cssAnimation,
		};
	}

	const characters = charactersWithStyle(runs);

	if (states.has(`${elementId}${TEXT_BUILD_ID_SEP}w${paraIndex}-0`)) {
		const spans: TextBuildSpan<TStyle>[] = [];
		let wordIndex = 0;
		let current: { text: string; style?: TStyle } | null = null;
		// Whitespace stays its own unanimated piece so the paragraph wraps and
		// spaces exactly as it does unanimated. A word that straddles a run
		// boundary keeps the style of the run it started in.
		const flush = (): void => {
			if (!current) {
				return;
			}
			spans.push(
				stateSpan(
					`${elementId}${TEXT_BUILD_ID_SEP}w${paraIndex}-${wordIndex}`,
					current.text,
					states,
					current.style,
				),
			);
			wordIndex++;
			current = null;
		};
		for (const { ch, style } of characters) {
			if (/\s/u.test(ch)) {
				flush();
				spans.push({ text: ch, hidden: false, style });
				continue;
			}
			current =
				current === null ? { text: ch, style } : { text: current.text + ch, style: current.style };
		}
		flush();
		return { granularity: 'word', spans };
	}

	if (states.has(`${elementId}${TEXT_BUILD_ID_SEP}c${paraIndex}-0`)) {
		const spans = characters.map((entry, index) =>
			stateSpan(
				`${elementId}${TEXT_BUILD_ID_SEP}c${paraIndex}-${index}`,
				entry.ch,
				states,
				entry.style,
			),
		);
		return { granularity: 'char', spans };
	}

	return undefined;
}

/**
 * The inline style a {@link TextBuildSpan} (or a paragraph-level spec) needs.
 * Returned as a plain record so each binding can apply it however it applies
 * styles; `display: inline` keeps the wrapper from breaking text layout.
 */
export function textBuildSpanStyle(span: {
	hidden?: boolean;
	cssAnimation?: string;
}): Record<string, string> {
	const style: Record<string, string> = { display: 'inline' };
	if (span.hidden) {
		style.visibility = 'hidden';
	}
	if (span.cssAnimation) {
		style.animation = span.cssAnimation;
	}
	return style;
}
