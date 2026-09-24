/**
 * COM-derived `p:animEffect/@_filter` values for the entrance/exit presets
 * that are a single filter-reveal behaviour (no `p:animScale`/`p:animRot`/
 * position `p:anim`), i.e. the vast majority of the catalogue. Method: for
 * each id, `Slide.TimeLine.MainSequence.AddEffect(shape, <MsoAnimEffect
 * id>, msoAnimateLevelNone, msoAnimTriggerOnPageClick)`, `SaveAs` to
 * `.pptx`, and read the saved `ppt/slides/slide1.xml`'s
 * `p:animEffect/@_filter` for that shape's effect (cross-checked against the
 * pre-existing `pptx-viewer-shared` ground truth in
 * `animation-preset-ground-truth.ts`, which this table agrees with for every
 * id it also covers). `undefined` for a covered id means PowerPoint really
 * writes a bare `p:animEffect` with no `filter` attribute at all (a plain
 * reveal, e.g. Flash Once, Stretch, Swivel, Zoom): still a REAL, verified
 * shape, not a placeholder. Ids 2 (Fly), 26 (Bounce), 30 (Float) and 31
 * (Grow & Turn) are handled by their own dedicated tables instead, because
 * they carry additional `p:anim`/`p:animScale`/`p:animRot` children this
 * simple filter-only shape cannot express.
 *
 * @module services/animation-behavior-simple-filters
 */

/** One simple filter-reveal preset: `undefined` filter means "no @_filter attribute". */
export interface SimpleFilterEntry {
	filter?: string;
	/** `true` skips the `p:animEffect` node entirely (Appear/Disappear: pure visibility toggle). */
	noAnimEffect?: boolean;
}

/**
 * Filter shared by BOTH entrance and exit at the same id (COM-verified: the
 * requested class only changes `presetClass`/`@_transition`/the visibility
 * `p:set`'s to/hidden target, never the filter string itself, except id 12
 * below).
 */
const SHARED_SIMPLE_FILTER_BY_ID: Readonly<Record<number, SimpleFilterEntry>> = {
	1: { noAnimEffect: true }, // Appear / Disappear
	3: { filter: 'blinds(horizontal)' }, // Blinds
	4: { filter: 'box(in)' }, // Box
	5: { filter: 'checkerboard(across)' }, // Checkerboard
	6: { filter: 'circle(in)' }, // Circle
	8: { filter: 'diamond(in)' }, // Diamond
	9: { filter: 'dissolve' }, // Dissolve
	10: { filter: 'fade' }, // Fade
	11: {}, // Flash Once: bare animEffect, no filter
	13: { filter: 'plus(in)' }, // Plus
	14: { filter: 'randombar(horizontal)' }, // Random Bars
	16: { filter: 'barn(inVertical)' }, // Split
	17: {}, // Stretch: bare animEffect, no filter
	18: { filter: 'strips(downLeft)' }, // Strips
	19: {}, // Swivel: 2D fallback is a bare animEffect, no filter
	20: { filter: 'wedge' }, // Wedge
	21: { filter: 'wheel(1)' }, // Wheel
	22: { filter: 'wipe(down)' }, // Wipe
	23: {}, // Zoom: bare animEffect, no filter (no animScale on the 2D fallback)
	24: {}, // Random Effects: bare animEffect, no filter (PowerPoint picks one at runtime)
	25: { filter: 'fade' }, // Boomerang (COM's 2D fallback degrades to a plain fade)
};

/** Peek (id 12) is the one id whose filter differs between entrance and exit. */
const ENTR_ONLY_OVERRIDE: Readonly<Record<number, SimpleFilterEntry>> = {
	12: { filter: 'wipe(up)' }, // Peek In
};
const EXIT_ONLY_OVERRIDE: Readonly<Record<number, SimpleFilterEntry>> = {
	12: { filter: 'wipe(down)' }, // Peek Out
};

/** Preset ids handled by their own dedicated (non-simple-filter) tables. */
export const SPECIAL_ENTR_EXIT_IDS: ReadonlySet<number> = new Set([2, 26, 30, 31]);

/** Look up the simple filter entry for an entrance/exit preset id, if this table covers it. */
export function getSimpleFilterEntry(
	presetClass: 'entr' | 'exit',
	presetId: number,
): SimpleFilterEntry | undefined {
	if (SPECIAL_ENTR_EXIT_IDS.has(presetId)) {
		return undefined;
	}
	const override =
		presetClass === 'entr' ? ENTR_ONLY_OVERRIDE[presetId] : EXIT_ONLY_OVERRIDE[presetId];
	return override ?? SHARED_SIMPLE_FILTER_BY_ID[presetId];
}
