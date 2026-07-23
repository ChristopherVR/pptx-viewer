/**
 * Per-run inline-style builder for rendered text runs (framework-agnostic).
 *
 * Mirrors React's per-run span style (`text-segment-render.tsx`): it maps a
 * `TextSegment`'s `TextStyle` onto a neutral CSS record that every non-React
 * binding (Vue / Angular / Svelte / Vanilla) applies to its own run span.
 * Split out of `text-paragraphs` to keep each module focused and small.
 */

import type { TextSegment } from 'pptx-viewer-core';

import { resolveUnderlineDecorationStyle } from './text-decoration';

/** A plain CSS style map (keys are CSS properties; binding-agnostic). */
export type RunStyle = Record<string, string | number>;

/** Points-per-inch / CSS-px-per-inch ratio for hundredths-of-a-point → px. */
const PX_PER_POINT = 96 / 72;
/** Super/subscript glyphs render at ~65% of the run font size (matches React). */
const BASELINE_FONT_SCALE = 0.65;

/**
 * Layer the "extra" run properties that neither the boolean decoration set nor
 * `buildRunEffectStyle` cover: character spacing, super/subscript baseline
 * shift, highlight background, text outline stroke, underline colour, kerning,
 * and `a:rPr/@cap` caps. Mirrors React's `renderSingleSegment` span style so the
 * shared builder (Vue / Angular / Svelte / Vanilla) reaches run-prop parity.
 */
function applyExtraRunProps(style: RunStyle, s: NonNullable<TextSegment['style']>): void {
	// Character spacing (`a:rPr/@spc`, hundredths of a point) → letter-spacing px.
	if (typeof s.characterSpacing === 'number' && s.characterSpacing !== 0) {
		style.letterSpacing = `${(s.characterSpacing / 100) * PX_PER_POINT}px`;
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
}

/** Per-run inline style derived from a TextSegment's style. */
export function segmentStyleToCss(seg: TextSegment): RunStyle {
	const s = seg.style ?? {};
	const style: RunStyle = {};
	if (s.fontFamily) {
		style.fontFamily = s.fontFamily;
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
		style.fontSize = `${s.fontSize * scale}px`;
	}
	if (baselineShift) {
		style.verticalAlign = baselineShift;
	}
	if (s.color) {
		style.color = s.color;
	}
	if (s.bold) {
		style.fontWeight = 'bold';
	}
	if (s.italic) {
		style.fontStyle = 'italic';
	}
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
	applyExtraRunProps(style, s);
	return style;
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
