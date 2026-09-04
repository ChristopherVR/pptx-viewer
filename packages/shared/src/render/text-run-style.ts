/**
 * Per-run inline-style builder for rendered text runs (framework-agnostic).
 *
 * Maps a `TextSegment`'s `TextStyle` onto a neutral CSS record that every
 * binding applies to its own run span. React included: its `text-segment-render`
 * now starts from this record and re-resolves only the handful of properties it
 * derives more precisely (colour/size/family fallbacks, PANOSE substitution,
 * the `@baseline` percentage, the `@kern` threshold, per-run BiDi), each of
 * which is documented there as a gap in this module rather than a preference.
 * Split out of `text-paragraphs` to keep each module focused and small; this
 * module itself later split its letter-spacing/split helpers into
 * `text-run-spacing.ts`, its hollow-text fill decision into
 * `text-run-hollow.ts`, and its nested-decoration / underline-variant helpers
 * into `text-run-decoration.ts`, for the same reason.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily, parsePanoseString } from 'pptx-viewer-core';

import { HYPERLINK_COLOR } from '../constants';
import { normalizeHexColor } from './fill-style';
import type { RunFontSpec } from './text-metric-tracking';
import { resolveMetricTrackingPx } from './text-metric-tracking';
import { hollowTextFillStyle } from './text-run-hollow';
import { authoredLetterSpacingPx, pieceLetterSpacing } from './text-run-spacing';

/** A plain CSS style map (keys are CSS properties; binding-agnostic). */
export type RunStyle = Record<string, string | number>;

/** Super/subscript glyphs render at ~65% of the run font size (matches React). */
const BASELINE_FONT_SCALE = 0.65;

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
 * Resolve `a:rPr/@kern` to a CSS `font-kerning` keyword.
 *
 * OOXML `@kern` is a MINIMUM FONT SIZE (hundredths of a point) above which
 * kerning applies, not an on/off flag: `kern="1200"` means "kern this run
 * only if it renders at 12pt or larger". `0` disables kerning outright
 * regardless of size. Reducing it to a boolean (any non-zero value enables
 * kerning) was shared's own behaviour before this function existed - React's
 * `text-segment-render.tsx` already read the threshold correctly, so Vue,
 * Angular, Svelte and Vanilla (which render `run.style` from shared verbatim)
 * disagreed with React on any run below its authored threshold.
 *
 * @param kerning    `a:rPr/@kern`, in hundredths of a point (or `undefined`
 *                   when the run authors none, which leaves kerning unset).
 * @param fontSizePx The run's resolved font size in CSS px (already reflects
 *                   `a:normAutofit/@fontScale` and any super/sub shrink).
 * @returns `'normal'` / `'none'`, or `undefined` when the run authors no `@kern`.
 */
export function resolveFontKerning(
	kerning: number | undefined,
	fontSizePx: number | undefined,
): 'normal' | 'none' | undefined {
	if (typeof kerning !== 'number') {
		return undefined;
	}
	if (kerning === 0) {
		return 'none';
	}
	const fontSizePt = (fontSizePx ?? 0) * (72 / 96);
	return fontSizePt >= kerning / 100 ? 'normal' : 'none';
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
	// Kerning (`a:rPr/@kern`) is a THRESHOLD, not a boolean: see `resolveFontKerning`.
	const fontKerning = resolveFontKerning(s.kerning, font.fontSizePx);
	if (fontKerning !== undefined) {
		style.fontKerning = fontKerning;
	}
	// Highlight (`a:highlight`) → background. Suppressed automatically when a
	// gradient/pattern text fill later sets the `background` shorthand.
	// Every colour here goes through `normalizeHexColor`: core hands back a bare
	// `AABBCC` for some producers, and `-webkit-text-stroke: 1px AABBCC` is
	// invalid CSS, so the whole declaration is dropped and the outline vanishes.
	if (s.highlightColor) {
		style.backgroundColor = normalizeHexColor(s.highlightColor, 'transparent');
	}
	// Underline colour (`a:uFill` / `a:uLn`) → text-decoration-color.
	if (s.underlineColor) {
		style.textDecorationColor = normalizeHexColor(s.underlineColor);
	}
	// Text outline (`a:rPr > a:ln`) → -webkit-text-stroke, stroke painted first.
	if (s.textOutlineWidth) {
		style.WebkitTextStroke = s.textOutlineColor
			? `${s.textOutlineWidth}px ${normalizeHexColor(s.textOutlineColor, '#000000')}`
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
		// React reference on the same deck. The run's own `a:latin/@panose` (when
		// authored) picks the right generic fallback class - a serif face with no
		// entry in the substitution map must not fall back to sans, and vice
		// versa. This used to call `getSubstituteFontFamily` with no panose
		// argument at all, so a run that overrode the body's own font (the only
		// case this branch fires for; an inherited font already goes through the
		// body's own panose-aware call in `buildTextBlockStyle`) substituted
		// without it in Vue, Angular, Svelte and Vanilla, while React re-resolved
		// the same font WITH panose immediately afterwards and painted a
		// different fallback face.
		style.fontFamily = getSubstituteFontFamily(s.fontFamily, parsePanoseString(s.latinFontPanose));
	} else if (s.scriptFallbackFont) {
		// D2-G2: a theme can name a script-specific typeface
		// (`<a:font script="Hans" typeface="..."/>`) that outranks the generic
		// `a:ea`/`a:cs` face for a run whose text is dominantly that script.
		// Core precomputes this whole-run fallback at parse time
		// (`resolveScriptFallbackFont`) but never applied it; wiring it in here
		// only fires when the run authors NO font of its own (an explicit
		// `a:latin`/`a:ea`/`a:cs` on the run always wins), so it never overrides
		// an intentional authored choice - a cheaper whole-run approximation of
		// full per-character `byScript` routing, which fixes the common case (a
		// run entirely in one non-Latin script).
		style.fontFamily = getSubstituteFontFamily(s.scriptFallbackFont);
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
	} else if (s.hyperlink) {
		// PowerPoint paints a hyperlink in the theme's `hlink` colour. Core
		// resolves that into `s.color` for nearly every deck, so this only fires
		// where the cascade produced nothing - but without it such a run rendered
		// in the body colour and was indistinguishable from the prose around it.
		style.color = HYPERLINK_COLOR;
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
	// A hyperlink is underlined unless the run says otherwise, which is
	// PowerPoint's default and React's long-standing behaviour; the other four
	// bindings rendered a link as undecorated prose.
	if (s.underline || s.hyperlink) {
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
