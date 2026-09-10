/**
 * SmartArt DiagramML interpreter - order-based composite slot de-duplication.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` (the repo's
 * per-file line budget): {@link representativeSlotsPerPoint} is a helper for
 * `arrangeByOrder`, the "one arranged point per positioned slot, in document
 * order" fallback used when neither `arrangeByPresentationOf` nor
 * `arrangeByChooseAwareSlots` resolves the composite (see that module's own
 * doc comment).
 *
 * `hexagon-cluster--hier5.pptx` (and the whole "transition-nested repeated
 * template" family sharing its authoring idiom: `bubble-picture-list`,
 * `circle-process`, `theme-picture-accent`, ...) declares, per top-level
 * point, FOUR separate positioned roles under one `dgm:choose` count-branch:
 * `textN` (the real, text-bearing hexagon), `textaccentN`/`imageN`/
 * `imageaccentN` (decorative accent/picture-placeholder hexagons for the
 * SAME point, positioned by their own `for="ch" forName="textaccentN"`-style
 * constraints declared on the SAME composite root). `readSlots` (called once,
 * composite-root-wide) returns all four PER POINT as separate `SlottedDims`
 * entries with no data-anchor of their own - `arrangeByOrder` previously
 * zipped `slotted[i]` <-> `nodes[i]` positionally, so for 3 real points it
 * consumed `text1, textaccent1, image1` (point 1's own four roles) instead of
 * `text1, text2, text3` (one representative role per point) - point 2's
 * label rendered inside point 1's tiny accent box, point 3's inside point
 * 1's picture box. Confirmed against `hexagon-cluster--hier5.pptx`'s cached
 * drawing: `Node Three` (point 2) belongs in a 234x202 hexagon at
 * `x=469,y=341`, not the 27x24 accent-sized box the old zip produced.
 */

import { PRIMARY_ALG } from './smartart-layout-interpreter-arrangement-kind';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';

/** `true` for a slot whose own `dgm:alg type="tx"` marks it as the REAL,
 * text-bearing role for its point (as opposed to a `sp`-typed accent/picture
 * placeholder sharing the same point) - see `PRIMARY_ALG`. */
function isTextRole(entry: SlottedDims): boolean {
	return PRIMARY_ALG[entry.node.algorithm?.type ?? ''] === 'text';
}

/**
 * When `slotted` carries MORE positioned entries than there are points, and
 * splits evenly into `pointCount` equal-sized runs (the repeated
 * per-point-template shape described above), collapse each run down to ONE
 * representative slot: the run's own text role when it has one, else its
 * first non-`hideGeom` member, else its first member outright. Returns
 * `slotted` UNCHANGED whenever it does not already carry (a whole multiple
 * of) more entries than points - the ordinary "one slot per point" case
 * every other composite relies on, so this is a no-op there.
 */
export function representativeSlotsPerPoint(
	slotted: SlottedDims[],
	pointCount: number,
): SlottedDims[] {
	if (pointCount <= 0 || slotted.length <= pointCount) {
		return slotted;
	}
	const groupSize = slotted.length / pointCount;
	if (!Number.isInteger(groupSize) || groupSize <= 1) {
		return slotted;
	}
	const result: SlottedDims[] = [];
	for (let i = 0; i < pointCount; i++) {
		const group = slotted.slice(i * groupSize, (i + 1) * groupSize);
		const preferred =
			group.find((entry) => isTextRole(entry) && !entry.node.shape?.hideGeometry) ??
			group.find((entry) => !entry.node.shape?.hideGeometry) ??
			group[0];
		result.push(preferred);
	}
	return result;
}
