/**
 * Hollow / outline-only text (`a:rPr > a:noFill`) fill decision.
 *
 * Split out of `text-run-style` to keep that module focused and small: this
 * piece has no dependency on `RunStyle` or any other run-style plumbing, so it
 * stands on its own rather than adding to the per-run CSS builder's size.
 */

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
 * {@link segmentStyleToCss} (in `text-run-style.ts`), while React's
 * `text-segment-render` assembles its own `React.CSSProperties` (per-word
 * metric tracking, script-font spans). Both merge the SAME object, which is
 * what stops the fifth binding drifting - React had no hollow-text branch at
 * all and painted the inherited colour.
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
