/**
 * `animation-timeline-build-level` — groups paragraph indices for a
 * by-paragraph text build according to `p:bldP/@bldLvl`.
 *
 * @module render/animation-timeline-build-level
 */

/**
 * Default `p:bldP/@bldLvl` (ECMA-376 S19.5.6 CT_TLBuildParagraph): when the
 * attribute is absent, PowerPoint's own default is "By 1st Level Paragraphs".
 */
export const DEFAULT_BUILD_LEVEL = 1;

/**
 * Group paragraph indices (in original document order) into the click steps a
 * "By Nth Level Paragraphs" build produces.
 *
 * `buildLevel` (1-based) says which outline levels get their own click: a
 * paragraph at 0-based outline `level` OPENS a new step when
 * `level < buildLevel`, otherwise it attaches to (plays with) the most recent
 * step opened by a shallower-or-equal paragraph. The very first paragraph
 * always opens a step, even if its own level is `>= buildLevel`, matching
 * PowerPoint's own behaviour of showing whatever comes first on the first
 * advance.
 *
 * With the default `buildLevel = 1` (0-based top-level paragraphs, i.e.
 * `level = 0`), every top-level bullet gets its own click and its nested
 * sub-bullets (level 1+) reveal together with it, which is PowerPoint's "By
 * 1st Level Paragraphs" default. Before this existed, every paragraph got its
 * own click regardless of nesting, so a sub-bullet needed an extra click
 * separate from its parent.
 *
 * @param levels - 0-based outline level per paragraph, in document order.
 * @param buildLevel - `p:bldP/@bldLvl`, or {@link DEFAULT_BUILD_LEVEL} when absent.
 * @returns Groups of paragraph indices, in document order; each group's first
 *          index is the paragraph whose click reveals the whole group.
 */
export function groupParagraphsByBuildLevel(
	levels: readonly number[],
	buildLevel: number = DEFAULT_BUILD_LEVEL,
): number[][] {
	const groups: number[][] = [];
	for (let i = 0; i < levels.length; i++) {
		const level = levels[i] ?? 0;
		const opensGroup = groups.length === 0 || level < buildLevel;
		if (opensGroup) {
			groups.push([i]);
		} else {
			groups[groups.length - 1].push(i);
		}
	}
	return groups;
}
