/**
 * SmartArt DiagramML interpreter - composite `dgm:alg/@ar` (aspect ratio)
 * handling, scoped to a `userS`-declared hub role.
 *
 * A `composite` algorithm's own `<dgm:param type="ar" val="...">` (ECMA-376
 * CT_AlgorithmData, "aspect ratio") establishes an internal working
 * rectangle a `userS`-anchored hub slot's own `w`/`h` size fact is a
 * fraction of, DISTINCT from the raw allocated box: PowerPoint fits a
 * rectangle of that aspect ratio inside the allocated box (the limiting
 * dimension keeps its full extent, the other shrinks to match), then reads
 * the hub's `w`/`h` `dgm:constr` `fact` against THAT working rectangle's own
 * width/height, not the outer box's.
 *
 * COM-verified against `radial-cluster--hier5.pptx` (`Name0`'s own
 * `<dgm:alg type="composite"><dgm:param type="ar" val="1.00"/></dgm:alg>`,
 * diagram box `867x533`): `textCenter`'s own choose-selected `w` fact for
 * this fixture's 3-satellite branch is `0.21`. Reading it against the raw
 * box width (`0.21 * 867 = 182.07px`) misses the cached hub size (`112px`)
 * by 62%; reading it against the `ar=1` working rectangle's own width
 * (`min(867, 533) = 533`, since the box is wider than square: `0.21 * 533 =
 * 111.93px`) matches the cached `112px` within 0.07px (0.06%) - far too
 * precise to be coincidental for a COM-authored fixture.
 *
 * **Deliberately scoped to a `userS`-referenced role only**
 * ({@link isUserSizeHubRole}), not every `w`/`h` in an `ar`-declaring
 * composite: an unscoped version (every child slot's `w`/`h` read against
 * the working rectangle) was implemented and full-corpus-measured first -
 * it fixed `radial-cluster` the same way, but ALSO regressed 4 unrelated
 * fixtures with no `userS` construct at all (`interconnected-rings--hier5
 * .pptx` `0.0634 -> 0.1257`, nearly doubling; `ascending-picture-accent-
 * process--hier5.pptx`, `descending-block-list--hier5.pptx`, `radial-
 * picture-list--fallback-n4.pptx`, all smaller upticks) - root-caused to a
 * pixel/ratio inconsistency: a SIBLING slot's `l`/`t` can cross-reference
 * the resized role's own `r`/`b` (far edge) through `smartart-constraint-
 * solver.ts`'s pure RATIO-space graph walk, which has no box to apply the
 * `ar` adjustment to at all - only the DIRECT `dimOf` call for the resized
 * role's own `w`/`h` did, so the two diverged. Gating on `userS` (a role
 * other descendant nodes are ALREADY declared to size themselves relative
 * to, `radial-cluster`'s own motivating construct) excludes every regressed
 * fixture outright (none declares a `userS` constraint at all) while still
 * reaching `radial-cluster`'s hub - verified via a full 229-fixture regen:
 * 0 fixtures worse, `radial-cluster` alone better (`matched` intact at
 * `5/5`, `maxDeltaFraction` `0.5535 -> 0.5141`).
 *
 * Position-type constraints (`l`/`t`/`ctrX`/`ctrY`) are deliberately NOT
 * routed through this at all, hub role included: a centre-based position
 * fact (`ctrX`/`ctrY`) happens to resolve identically whether read against
 * the raw box or the (symmetrically centred) working rectangle, since the
 * two share the same centre, but an edge-based one (`l`/`t`) would need the
 * working rectangle's own inset accounted for as well - unverified, left
 * out of scope. See `smartart-layout-interpreter-composite-slots.ts`'s
 * `readSlots` for where this is wired in.
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { BoundingBox } from './smartart-layout-types';

/**
 * The `ar` (aspect ratio, width/height) an algorithm's own `dgm:param`
 * declares, or `undefined` when absent, non-numeric, or non-positive (every
 * pre-existing composite with no `ar` param, the overwhelmingly common
 * case, is unaffected).
 */
export function readAlgorithmAspectRatio(
	node: PptxSmartArtLayoutNode | undefined,
): number | undefined {
	const raw = node?.algorithm?.parameters?.find((param) => param.type === 'ar')?.value;
	if (raw === undefined) {
		return undefined;
	}
	const ar = Number.parseFloat(raw);
	return Number.isFinite(ar) && ar > 0 ? ar : undefined;
}

/**
 * Fit a rectangle of aspect ratio `ar` (width/height) inside `box`, keeping
 * the limiting dimension at its full extent. Returns `box` itself (same
 * values, cheap to compare) when `ar` is `undefined` or `box` already has
 * that exact ratio - every caller with no `ar` to honour keeps its
 * pre-existing box-relative sizing unchanged.
 */
export function fitAspectRatioBox(box: BoundingBox, ar: number | undefined): BoundingBox {
	if (ar === undefined || box.height <= 0 || box.width <= 0) {
		return box;
	}
	const boxAr = box.width / box.height;
	if (boxAr > ar) {
		// Box is relatively WIDER than the target ratio: height is the limiting
		// dimension, width shrinks to match.
		return { width: box.height * ar, height: box.height };
	}
	if (boxAr < ar) {
		// Box is relatively TALLER than the target ratio: width is the limiting
		// dimension, height shrinks to match.
		return { width: box.width, height: box.width / ar };
	}
	return box;
}

/**
 * True when some `dgm:constr type="userS"` anywhere in the layout declares
 * `role` as its `refForName` target - i.e. another descendant node's own
 * size is ALREADY declared (elsewhere) as a fraction of `role`'s own size
 * (`radial-cluster`'s own `userS for="des" ptType="node" refType="w"
 * refFor="ch" refForName="textCenter" fact="0.67"`). See this module's own
 * doc comment for why the `ar`-fit working rectangle is scoped to exactly
 * this role, not every `w`/`h` in an `ar`-declaring composite.
 */
export function isUserSizeHubRole(role: string, index: ConstraintIndex): boolean {
	for (const entries of index.entries.values()) {
		for (const { constraint } of entries) {
			if (constraint.type === 'userS' && constraint.referenceForName === role) {
				return true;
			}
		}
	}
	return false;
}
