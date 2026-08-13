/**
 * Per-run facts a rendered paragraph carries besides its text and CSS: the
 * run's HYPERLINK and its inline EQUATION (framework-agnostic).
 *
 * Both are authored on the run (`a:r > a:rPr > a:hlinkClick` /
 * `a:hlinkMouseOver`, and an `m:oMath` sibling that core stamps onto its own
 * segment), and both need a different ELEMENT around the run - an `<a>` and a
 * MathML host - rather than a different style, which is why they are modelled
 * separately from {@link RunStyle} instead of being folded into it.
 *
 * Before this existed, `buildParagraphs` returned `{ text, style }` only, so a
 * hyperlinked run rendered as plain text in Vue, Svelte and Vanilla (the link
 * was silently dropped) and Angular compensated with a text-prefix walk that
 * re-attached the metadata to shared's runs by matching their characters. This
 * module is that walk's replacement: resolve once, in the builder, for all five.
 */

import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { isPpactionUrl, resolveHyperlinkHref } from './hyperlink-security';
import { sanitizeMathMl } from './mathml-sanitize';
import { convertOmmlToMathMl } from './omml-to-mathml';
import type { OmmlNode } from './omml-to-mathml';

/** A run's resolved hyperlink target. */
export interface RunHyperlink {
	/**
	 * The URL to hand a click handler. For an internal `ppaction://hlinksldjump`
	 * the resolved slide index is appended as a `slideIndex` query parameter, so
	 * the target survives a callback whose only argument is the URL (see
	 * `parsePpactionUrl`, which reads it back off).
	 */
	url: string;
	/**
	 * A safe, renderable `href` for a plain `<a>`, or `undefined` when the target
	 * is an internal `ppaction://` action or fails the URL safety check. A
	 * binding with no click handler renders the run as text in that case, which
	 * is what every binding did for every link before this field existed.
	 */
	href?: string;
	/** `a:hlinkClick/@tooltip`, for the anchor's `title`. */
	tooltip?: string;
	/** Resolved target slide for an internal slide jump. */
	targetSlideIndex?: number;
	/**
	 * True when the target came from `a:hlinkMouseOver` rather than
	 * `a:hlinkClick`: PowerPoint follows it on hover, not on click, so a binding
	 * that renders a plain anchor should not make it look clickable.
	 */
	onHover?: boolean;
}

/** An inline equation run (`m:oMath`), rendered as MathML rather than text. */
export interface RunEquation {
	/** The raw OMML node, for `convertOmmlToMathMl`. */
	xml: Record<string, unknown>;
	/** Display number for a numbered equation, without its parentheses. */
	number?: string;
}

/**
 * Resolve a run style's hyperlink into a renderable descriptor, or `undefined`
 * when the run carries none.
 *
 * `a:hlinkClick` wins over `a:hlinkMouseOver` when a run authors both, matching
 * PowerPoint: the click target is the one a reader reaches deliberately.
 */
export function resolveRunHyperlink(style: TextStyle | undefined): RunHyperlink | undefined {
	const clicked = style?.hyperlink;
	const raw = clicked || style?.hyperlinkMouseOver;
	if (!raw) {
		return undefined;
	}
	const target = style?.hyperlinkTargetSlideIndex;
	// The slide index rides the URL because `onHyperlinkClick(url)` is the
	// callback shape every binding already exposes.
	const url =
		typeof target === 'number' && isPpactionUrl(raw)
			? `${raw}${raw.includes('?') ? '&' : '?'}slideIndex=${target}`
			: raw;
	const link: RunHyperlink = { url };
	const href = resolveHyperlinkHref(raw);
	if (href !== undefined) {
		link.href = href;
	}
	if (style?.hyperlinkTooltip) {
		link.tooltip = style.hyperlinkTooltip;
	}
	if (typeof target === 'number') {
		link.targetSlideIndex = target;
	}
	if (!clicked) {
		link.onHover = true;
	}
	return link;
}

/**
 * The sanitised MathML markup for an inline equation run, or `''` when the OMML
 * converts to nothing (a binding then renders its own "unsupported" chip).
 *
 * Here rather than in each binding because the pair (convert, then sanitise) is
 * a security-relevant order: the markup is injected as HTML, so skipping the
 * sanitiser is an injection, and four bindings were each spelling the pair out
 * by hand at their own call site.
 */
export function runEquationMathMl(equation: RunEquation): string {
	const mathml = convertOmmlToMathMl(equation.xml as OmmlNode);
	return mathml ? sanitizeMathMl(mathml) : '';
}

/** Resolve a segment's inline equation, or `undefined` when it carries none. */
export function resolveRunEquation(seg: TextSegment): RunEquation | undefined {
	if (!seg.equationXml) {
		return undefined;
	}
	const equation: RunEquation = { xml: seg.equationXml };
	if (seg.equationNumber) {
		equation.number = seg.equationNumber;
	}
	return equation;
}

/**
 * Whether a text body is nothing BUT equations: at least one `m:oMath` segment
 * and no visible prose around it.
 *
 * Vue, Svelte and Vanilla hand an equation-bearing element wholesale to their
 * standalone equation renderer, which lays the maths out centred in the box.
 * That is right for an inserted equation shape and wrong for a sentence with a
 * formula in the middle of it, which it reduced to the formula alone. This is
 * the test that keeps the wholesale path for the first case and lets the second
 * render through `buildParagraphs`, where the equation is now a run in place.
 */
export function isEquationOnlyText(segments: readonly TextSegment[] | undefined): boolean {
	if (!segments || segments.length === 0) {
		return false;
	}
	let sawEquation = false;
	for (const seg of segments) {
		if (seg.equationXml) {
			sawEquation = true;
			continue;
		}
		// Paragraph/line separators are structure, not prose: an equation on its
		// own line still counts as equation-only.
		if (seg.isParagraphBreak || seg.isLineBreak) {
			continue;
		}
		if (seg.text.trim().length > 0) {
			return false;
		}
	}
	return sawEquation;
}
