/**
 * hidden-slide-cue.ts: the one contract every binding uses to mark a slide the
 * author hid (`p:sld/@show="0"`, parsed by core into `PptxSlide.hidden`) in a
 * thumbnail rail or a slide sorter.
 *
 * Hiding a slide only removes it from the SHOW (see `presentation-show-order`);
 * the slide stays in the deck, the rail and the sorter. That makes the cue the
 * only way a user can tell the difference between a slide that will present and
 * one that will silently be skipped, so it has to be present, legible and
 * announced, in every binding, or the feature is invisible where it is missing.
 *
 * Three separate signals, on purpose:
 *
 * 1. `marker` -> `data-pptx-slide-hidden="true"` on the tile. A neutral,
 *    framework-agnostic hook so a spec can assert the state without knowing
 *    which binding rendered it, and without depending on class names that are
 *    Tailwind in two bindings and hand-written CSS in three.
 * 2. `slashGradient` -> a diagonal line struck through the slide number. This
 *    is PowerPoint's own cue and, unlike dimming, it is a SHAPE: colour alone
 *    is not an accessible signal, and a dimmed tile is indistinguishable from a
 *    dark thumbnail. Shipped as one shared gradient string rather than five
 *    hand-drawn slashes so the mark is literally identical everywhere.
 * 3. `labelId` -> the id of a "Hidden" text node the tile points at with
 *    `aria-describedby`. Deliberately NOT folded into the tile's `aria-label`:
 *    "Go to slide {{n}}" is the accessible name the whole e2e suite and every
 *    binding's parity spec pins, so the state ships as a DESCRIPTION, which
 *    assistive tech announces after the name and which no name matcher sees.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */

/**
 * Attribute a rail or sorter tile carries while its slide is hidden.
 *
 * Present-or-absent rather than `="false"`, so `[data-pptx-slide-hidden]` is a
 * valid CSS/locator selector on its own.
 */
export const HIDDEN_SLIDE_ATTRIBUTE = 'data-pptx-slide-hidden';

/**
 * The dictionary key for the single word shown and announced for the state.
 * Reused from the sorter rather than duplicated per surface: one string to
 * translate, and one string a user learns to recognise.
 */
export const HIDDEN_SLIDE_LABEL_KEY = 'pptx.slideSorter.hidden';

/**
 * The diagonal slash struck through a hidden slide's number, as a CSS
 * `background-image`.
 *
 * Derived from `currentColor` so it inherits whatever the number is painted in
 * and stays visible in both the light and the dark chrome themes.
 *
 * Two details are load-bearing, both found by looking at it rather than by
 * reasoning about it. The stops are tight, because at the 10px number size the
 * rails use a thicker line reads as a smudge. And the line is drawn at 60% of
 * the text colour, so the fully-opaque digit sitting on top of it stays the
 * darker of the two: at full strength the slash merged with a narrow glyph like
 * "1" and turned "slide 1, hidden" into "slide ?, hidden".
 */
export const HIDDEN_SLIDE_SLASH_GRADIENT =
	'linear-gradient(to top right, transparent 47%, color-mix(in srgb, currentColor 60%, transparent) 47%, color-mix(in srgb, currentColor 60%, transparent) 53%, transparent 53%)';

/** Opacity a hidden slide's thumbnail is dimmed to, alongside the slash. */
export const HIDDEN_SLIDE_DIM_OPACITY = 0.5;

/** Everything a binding needs to mark one tile. Inert when the slide is visible. */
export interface HiddenSlideCue {
	/** Whether the slide is hidden, for `v-if` / `@if` / `{#if}` gating. */
	readonly hidden: boolean;
	/**
	 * `id` for the "Hidden" text node, and the value the tile passes to
	 * `aria-describedby`. `undefined` when the slide is visible, so a binding can
	 * bind it straight through and have the attribute omitted.
	 */
	readonly labelId: string | undefined;
	/** Value for {@link HIDDEN_SLIDE_ATTRIBUTE}; `undefined` omits the attribute. */
	readonly marker: 'true' | undefined;
}

/**
 * The id of a tile's "Hidden" description node.
 *
 * `surface` distinguishes the rail from the sorter: both can be mounted at once
 * (the sorter is an overlay ON TOP of the rail), and two nodes sharing an id
 * would leave `aria-describedby` pointing at whichever the browser found first.
 */
export function hiddenSlideLabelId(surface: string, slideIndex: number): string {
	return `pptx-hidden-slide-${surface}-${slideIndex}`;
}

/**
 * Resolve the cue for one tile.
 *
 * Takes the flag rather than the slide so a binding can pass its own view model,
 * and so nothing here has to re-derive a state core already parsed.
 */
export function hiddenSlideCue(
	hidden: boolean | undefined,
	surface: string,
	slideIndex: number,
): HiddenSlideCue {
	if (!hidden) {
		return { hidden: false, labelId: undefined, marker: undefined };
	}
	return { hidden: true, labelId: hiddenSlideLabelId(surface, slideIndex), marker: 'true' };
}
