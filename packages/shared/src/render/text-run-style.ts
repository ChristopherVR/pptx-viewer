/**
 * Per-run inline-style builder for rendered text runs (framework-agnostic).
 *
 * Mirrors React's per-run span style (`text-segment-render.tsx`): it maps a
 * `TextSegment`'s `TextStyle` onto a neutral CSS record that every non-React
 * binding (Vue / Angular / Svelte / Vanilla) applies to its own run span.
 * Split out of `text-paragraphs` to keep each module focused and small.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import { resolveUnderlineDecorationStyle } from './text-decoration';
import type { RunFontSpec } from './text-metric-tracking';
import { resolveMetricTrackingPx, splitRunForMetrics } from './text-metric-tracking';

/** A plain CSS style map (keys are CSS properties; binding-agnostic). */
export type RunStyle = Record<string, string | number>;

/** Points-per-inch / CSS-px-per-inch ratio for hundredths-of-a-point → px. */
const PX_PER_POINT = 96 / 72;
/** Super/subscript glyphs render at ~65% of the run font size (matches React). */
const BASELINE_FONT_SCALE = 0.65;

/**
 * The authored `a:rPr/@spc` character spacing in CSS px (hundredths of a point).
 * The measured PowerPoint metric compensation layers on top of this, so callers
 * that re-derive a per-piece `letter-spacing` need the authored part on its own.
 */
export function authoredLetterSpacingPx(style: TextSegment['style']): number {
	const spc = style?.characterSpacing;
	return typeof spc === 'number' && spc !== 0 ? (spc / 100) * PX_PER_POINT : 0;
}

/** `letter-spacing` for a run piece: authored spacing plus its own tracking. */
export function pieceLetterSpacing(authoredPx: number, tracking: number): string | undefined {
	const spacing = authoredPx + tracking;
	return spacing === 0 ? undefined : `${spacing}px`;
}

/**
 * Split one styled run into the per-word / per-gap runs that make a LINE
 * measure what PowerPoint measured (see `splitRunForMetrics`).
 *
 * Every binding that renders one span per run gets exact wrapping by emitting
 * these instead of the single run, so this is the one place the "which pieces,
 * what spacing" decision lives: shared's `buildParagraphs` covers Vue, Svelte
 * and Vanilla, Angular's own paragraph builder calls it directly, and React
 * splits inside its span.
 *
 * Returns a single entry (the run unchanged) when there is nothing to split,
 * which is the common case for short labels and one-word runs.
 */
export function splitStyledRun(
	text: string,
	style: RunStyle,
	font: RunFontSpec,
	authoredPx: number,
): Array<{ text: string; style: RunStyle }> {
	const pieces = splitRunForMetrics(text, font);
	if (pieces.length <= 1) {
		return [{ text, style }];
	}
	return pieces.map((piece) => {
		const spacing = pieceLetterSpacing(authoredPx, piece.tracking);
		const pieceStyle: RunStyle = { ...style };
		if (spacing === undefined) {
			delete pieceStyle.letterSpacing;
		} else {
			pieceStyle.letterSpacing = spacing;
		}
		return { text: piece.text, style: pieceStyle };
	});
}

/**
 * Combine the authored `a:rPr/@spc` character spacing with the measured
 * PowerPoint metric compensation into one `letter-spacing`, or leave it
 * undeclared when neither applies.
 *
 * The compensation is derived from the run's own characters
 * (`resolveMetricTracking`); an earlier attempt used one flat constant for
 * every run and regressed short labels that PowerPoint keeps on one line
 * (issue #149).
 */
function resolveLetterSpacing(
	s: NonNullable<TextSegment['style']>,
	text: string,
	font: RunFontSpec,
): string | undefined {
	return pieceLetterSpacing(authoredLetterSpacingPx(s), resolveMetricTrackingPx(text, font));
}

/**
 * Layer the "extra" run properties that neither the boolean decoration set nor
 * `buildRunEffectStyle` cover: character spacing, super/subscript baseline
 * shift, highlight background, text outline stroke, underline colour, kerning,
 * and `a:rPr/@cap` caps. Mirrors React's `renderSingleSegment` span style so the
 * shared builder (Vue / Angular / Svelte / Vanilla) reaches run-prop parity.
 */
function applyExtraRunProps(
	style: RunStyle,
	s: NonNullable<TextSegment['style']>,
	text: string,
	font: RunFontSpec,
): void {
	const letterSpacing = resolveLetterSpacing(s, text, font);
	if (letterSpacing !== undefined) {
		style.letterSpacing = letterSpacing;
	}
	// Kerning (`a:rPr/@kern`): 0 disables kerning, any other value enables it.
	if (typeof s.kerning === 'number') {
		style.fontKerning = s.kerning === 0 ? 'none' : 'normal';
	}
	// Highlight (`a:highlight`) → background. Suppressed automatically when a
	// gradient/pattern text fill later sets the `background` shorthand.
	if (s.highlightColor) {
		style.backgroundColor = s.highlightColor;
	}
	// Underline colour (`a:uFill` / `a:uLn`) → text-decoration-color.
	if (s.underlineColor) {
		style.textDecorationColor = s.underlineColor;
	}
	// Text outline (`a:rPr > a:ln`) → -webkit-text-stroke, stroke painted first.
	if (s.textOutlineWidth) {
		style.WebkitTextStroke = s.textOutlineColor
			? `${s.textOutlineWidth}px ${s.textOutlineColor}`
			: `${s.textOutlineWidth}px currentColor`;
		style.paintOrder = 'stroke fill';
	}
	// Caps (`a:rPr/@cap`): all → uppercase, small → small-caps.
	if (s.textCaps === 'all') {
		style.textTransform = 'uppercase';
	} else if (s.textCaps === 'small') {
		style.fontVariantCaps = 'small-caps';
	}
	// Hollow / outline-only text (`a:rPr > a:noFill`), applied LAST so it wins
	// over the `color` set above. See {@link hollowTextFillStyle}.
	const hollow = hollowTextFillStyle(s, {
		color: typeof style.color === 'string' ? style.color : undefined,
		textStroke: typeof style.WebkitTextStroke === 'string' ? style.WebkitTextStroke : undefined,
	});
	if (hollow) {
		Object.assign(style, hollow);
	}
}

/** The run properties {@link hollowTextFillStyle} decides from. */
export interface HollowTextFillInput {
	/** `a:rPr > a:noFill`: the glyph interior is not painted. */
	textFillNone?: boolean;
	/** `a:rPr > a:ln/@w` in px, if the run carries an outline. */
	textOutlineWidth?: number;
	/** The outline's own colour, if it declared one. */
	textOutlineColor?: string;
}

/** What the run is ALREADY painting, before the hollow decision is applied. */
export interface HollowTextPaintedStyle {
	/** The colour the cascade resolved for this run. */
	color?: string;
	/** The `-webkit-text-stroke` already emitted, if any. */
	textStroke?: string;
}

/** The CSS a hollow run needs, to be merged over its existing run style. */
export interface HollowTextFillStyle {
	color: string;
	WebkitTextFillColor: string;
	/** Re-pinned outline; present only when the stroke was `currentColor`. */
	WebkitTextStroke?: string;
}

/**
 * Hollow / outline-only text (`a:rPr > a:noFill`): the glyph INTERIOR is not
 * painted, which is what makes standard WordArt outline text readable - the
 * `a:ln` stroke draws the letterform and the fill is left empty.
 *
 * A hollow run always still carries a `color`, because the parsed run style
 * merges the resolved theme / placeholder / master cascade underneath the run's
 * own properties, and that inherited colour fills the slot `a:noFill`
 * deliberately left empty. So this must be applied OVER the run's resolved
 * colour, never instead of resolving one.
 *
 * `-webkit-text-fill-color` is the property that actually does this and every
 * current engine ships it (Chromium, WebKit and Gecko, prefix included).
 * `color: transparent` is the fallback for anything that does not: it loses
 * `currentColor` for the stroke, so it is only the second choice, but
 * transparent-and-outlined beats solid-and-wrong.
 *
 * A decision function rather than a mutation, because the bindings do not all
 * build their run style the same way: four of them go through
 * {@link segmentStyleToCss}, while React's `text-segment-render` assembles its
 * own `React.CSSProperties` (per-word metric tracking, script-font spans). Both
 * merge the SAME object, which is what stops the fifth binding drifting - React
 * had no hollow-text branch at all and painted the inherited colour.
 *
 * @param s       - The run's `a:noFill` / outline properties.
 * @param painted - What the caller has already put on the run.
 * @returns The CSS to merge, or `undefined` when the run is not hollow.
 */
export function hollowTextFillStyle(
	s: HollowTextFillInput,
	painted: HollowTextPaintedStyle = {},
): HollowTextFillStyle | undefined {
	if (!s.textFillNone) {
		return undefined;
	}
	const hollow: HollowTextFillStyle = {
		color: 'transparent',
		WebkitTextFillColor: 'transparent',
	};
	// An outline with no colour of its own is `currentColor`, which the
	// `color: transparent` fallback is about to erase, taking the letterform
	// with it. Pin it to the concrete colour this run resolved to first.
	if (painted.textStroke !== undefined && !s.textOutlineColor) {
		hollow.WebkitTextStroke = `${s.textOutlineWidth}px ${painted.color ?? 'currentColor'}`;
	}
	return hollow;
}

/**
 * Per-run inline style derived from a TextSegment's style.
 *
 * `fontScale` is the body's `a:normAutofit/@fontScale` (see
 * `resolveAutoFitFontScale`). It has to be applied HERE and not only on the
 * text body, because a run that authors its own `sz` overrides the body's
 * font-size, so scaling the body alone left every authored run at full size.
 *
 * `context` only feeds the metric measurement behind `letter-spacing`; the
 * emitted style still declares nothing the run did not author. It is optional:
 * without it the run is measured with its own text and against the default
 * font, which is what it renders with anyway when it inherits nothing.
 */
export interface RunStyleContext {
	/** What the run actually renders, if not `seg.text` (field substitution). */
	text?: string;
	/** What the run inherits from the text body when it declares no font. */
	blockFont?: RunFontSpec;
}

export function segmentStyleToCss(
	seg: TextSegment,
	fontScale = 1,
	context: RunStyleContext = {},
): RunStyle {
	const s = seg.style ?? {};
	const style: RunStyle = {};
	if (s.fontFamily) {
		// PANOSE substitution, exactly as React's `renderSingleSegment` does it.
		// Emitting the bare authored name instead looks harmless and is not: the
		// fallback chain is what supplies the metric-compatible stand-in (Carlito
		// for Calibri, Liberation Sans for Arial), so without it a machine that
		// lacks the authored font drops to the browser's default sans - different
		// glyph widths, different line breaks, a visibly different slide from the
		// React reference on the same deck.
		style.fontFamily = getSubstituteFontFamily(s.fontFamily);
	}
	// Super/subscript (`a:rPr/@baseline`) shifts the run and shrinks the glyph.
	const baselineShift =
		typeof s.baseline === 'number' && s.baseline !== 0
			? s.baseline > 0
				? 'super'
				: 'sub'
			: undefined;
	// px, not pt - the parsed value is the CSS px size (matches React + the inline
	// editor). Appending `pt` inflates every run by ~1.33×.
	if (typeof s.fontSize === 'number') {
		const scale = baselineShift ? BASELINE_FONT_SCALE : 1;
		style.fontSize = `${s.fontSize * fontScale * scale}px`;
	}
	if (baselineShift) {
		style.verticalAlign = baselineShift;
	}
	if (s.color) {
		style.color = s.color;
	}
	// Declared unconditionally, exactly as React's `renderSingleSegment` does, and
	// that is the whole point: the text BLOCK also carries a `font-weight` /
	// `font-style` derived from the element's resolved text style, so a run that
	// merely omits `b` / `i` inherits the block's value instead of falling back to
	// regular. On a real deck a bold heading in the first paragraph therefore
	// turned every following paragraph of the same shape bold, which reflows the
	// text and pushes it out of its box.
	style.fontWeight = s.bold ? 'bold' : 'normal';
	style.fontStyle = s.italic ? 'italic' : 'normal';
	const deco: string[] = [];
	if (s.underline) {
		deco.push('underline');
	}
	if (s.strikethrough) {
		deco.push('line-through');
	}
	if (deco.length > 0) {
		style.textDecoration = deco.join(' ');
	}
	applyExtraRunProps(
		style,
		s,
		context.text ?? seg.text ?? '',
		resolveRunFont(style, s, context.blockFont),
	);
	return style;
}

/**
 * The font a run will actually paint with: its own declarations where it made
 * them, the text body's where it did not. Bold and italic are always the run's
 * own, because {@link segmentStyleToCss} declares both unconditionally.
 *
 * Exported so a caller that re-measures pieces of a run (see
 * `splitRunForMetrics`) resolves the font exactly the way the run style did,
 * rather than keeping a second copy of the fallback rules.
 */
export function resolveRunFont(
	style: RunStyle,
	s: NonNullable<TextSegment['style']>,
	blockFont?: RunFontSpec,
): RunFontSpec {
	return {
		fontFamily: (style.fontFamily as string | undefined) ?? blockFont?.fontFamily,
		fontSizePx:
			typeof style.fontSize === 'string'
				? Number.parseFloat(style.fontSize)
				: blockFont?.fontSizePx,
		bold: Boolean(s.bold),
		italic: Boolean(s.italic),
	};
}

/**
 * Layer the underline-style / double-strike *variant* decoration CSS
 * (`text-decoration-style` / `-thickness` / `text-underline-offset`) onto a run
 * style. Kept separate from {@link segmentStyleToCss} so that helper's contract
 * (boolean `textDecoration` only) stays stable for its other consumers; this is
 * applied additively by `buildParagraphs` when building each run, mirroring
 * React's segment renderer (`text-segment-render.tsx`), which applies
 * `resolveUnderlineDecorationStyle` over the boolean underline.
 */
export function applyUnderlineVariant(style: RunStyle, seg: TextSegment): void {
	const s = seg.style;
	if (!s) {
		return;
	}
	const isDoubleStrike = Boolean(s.strikethrough && s.strikeType === 'dblStrike');
	// Only the underline path needs an explicit style token; a plain solid
	// underline (or no underline) leaves the boolean `textDecoration` untouched.
	const deco = resolveUnderlineDecorationStyle(
		isDoubleStrike,
		s.underline ? s.underlineStyle : undefined,
	);
	if (!deco) {
		return;
	}
	if (deco.textDecorationStyle !== undefined) {
		style.textDecorationStyle = deco.textDecorationStyle;
	}
	if (deco.textDecorationThickness !== undefined) {
		style.textDecorationThickness = deco.textDecorationThickness;
	}
	if (deco.textUnderlineOffset !== undefined) {
		style.textUnderlineOffset = deco.textUnderlineOffset;
	}
}
