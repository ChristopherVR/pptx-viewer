/**
 * `rewrapGroupOwnBox`, split out of `group-tight-rewrap.ts` to keep that
 * module under the repo's 300-LOC guideline. See that module's doc for the
 * broader tight-rewrap context (when this runs, and the COM ground truth
 * that settled it) - this file is purely the "given the new tight `chOff`/
 * `chExt`, what does the group's own `a:off`/`a:ext` become" half of it.
 *
 * ## A ROTATED group ALSO resized directly, in the SAME save as a child edit
 *
 * `group-tight-rewrap.ts`'s existing "rotate the naive translated delta
 * around the old centre" step was COM-verified only for an UNROTATED group
 * (`combined-order-a.pptx`); a ROTATED group needs one more step first.
 * COM ground truth (`s1-combined-{25,90}.pptx`: a group rotated 25 or 90
 * degrees, `Shape.Width *= 1.5` / `Height *= 1.2`, then one child moved AND
 * resized via `GroupItems`, one `SaveAs`) shows PowerPoint does NOT pivot the
 * naive delta around the group's ORIGINAL (pre-resize) corner: it first
 * applies its own plain-resize anchor rule ({@link resolveRotatedResizeOffset},
 * `rotated-resize-anchor.ts` - "as if only the group's own resize had
 * happened, no child touched") to get an intermediate box, THEN re-wraps
 * around THAT intermediate box's centre. Composing the two is byte-exact at
 * 90 degrees; at 25 degrees it lands `off.x` and `ext.cy` 1 EMU off (`off.y`
 * and `ext.cx` exact) - see `group-tight-rewrap.test.ts`'s
 * `s1-combined-25`/`s1-combined-90` cases.
 *
 * ## Order matters, and only ONE order is reachable from this architecture
 *
 * A fresh COM sweep (8 angles x {child moved, child resized, child moved+
 * resized}, each built two ways: `Group.Width`/`Height` set FIRST then the
 * child's `Left`/`Top`/`Width`/`Height` ("grp1st"), and the reverse
 * ("chd1st")) shows the two orders are NOT sub-EMU-close: they diverge by up
 * to ~71,000 EMU (about 0.08 inch, plainly visible), because COM live-refits
 * the group's bounding box the INSTANT a child moves or resizes, so whichever
 * property is set LAST composes against an already-refit intermediate box.
 * This is `group-tight-rewrap.ts`'s own documented "combined-order-b" case
 * ("A group resized and a child edited via TWO SEPARATE interactive steps
 * that each triggered PowerPoint's LIVE bounding-box refresh... is also not
 * reproduced... this module computes the rewrap once, from the FINAL element
 * state... 'order A' is what this architecture actually produces") - this
 * sweep is its first exhaustive, multi-angle confirmation, not a new gap: a
 * save path driven by one final element tree (this SDK's own architecture)
 * cannot recover which order a user's two separate actions happened in, so
 * "chd1st" is not a target this formula can chase. "grp1st" - the group's own
 * resize committing before the child edit's tight-rewrap runs - is exactly
 * what {@link rewrapGroupOwnBox} already implements (`selfResizeAnchor`
 * first, then the tight-rewrap against ITS result), and is the only order a
 * single-final-state save can faithfully replay.
 *
 * ## The residual, precisely characterized
 *
 * Restricted to the reachable "grp1st" order, the same sweep (24 cases: 8
 * angles x 3 child-edit combos) is BYTE-EXACT in 9/24 cases; the rest are 1-2
 * EMU (<=2/914400 inch) off on one or more of `off.x`/`off.y`/`ext.cx`/
 * `ext.cy`, with no consistent sign or axis - see
 * `group-tight-rewrap.test.ts`'s `grp1st` sweep for the full table (COM value
 * pinned in a comment on every row). This was investigated further while
 * closing the SAME "1 EMU" class of gap in
 * `rotated-resize-anchor.ts`/`group-child-rotated-resize.ts` (both closed - a
 * both-axes resize needs a SEQUENTIAL, not simultaneous, per-axis
 * composition; see `rotated-resize-anchor.ts`'s module doc). Findings here
 * specifically, all against the full 24-case sweep unless noted:
 *
 *  - `resolveRotatedResizeOffset` now performs that sequential composition
 *    internally, so the `selfResizeAnchor` call below already benefits from
 *    it - but it does NOT change any of the 24 numbers at all (verified
 *    identical before/after). The sequential fix closes a "both axes changed
 *    in ONE `resolveRotatedResizeOffset` call" gap; this residual survives a
 *    SECOND, separate rotation composition afterward (the tight-rewrap step
 *    below), so it is not the same bug.
 *  - Decomposing the tight-rewrap step ITSELF into two further sequential
 *    single-axis corrections (mirroring the self-resize fix, one more level
 *    up) was tried, in all 4 orderings of {self-resize width/height} x
 *    {tight-rewrap x/y} - all 4 give IDENTICAL results (this part IS
 *    order-independent) but only 6/24 exact: WORSE than the bespoke
 *    "translate then rotate the naive center around the pivot" derivation
 *    below. Rejected.
 *  - An "unrounded pivot" variant (carry every intermediate center as a
 *    float through the whole chain, rounding only once at the very end) was
 *    also tried and was WORSE (5/24) - it reproduces `combined-order-a.pptx`'s
 *    UNROTATED exact value WRONG (`4318000` vs the byte-exact `4318001`)
 *    while still not fixing the rotated cases. Rejected; the existing
 *    corner-anchored, rounded-pivot derivation below is correct.
 *  - float32 (single-precision) trig for every `cos`/`sin` in the pipeline
 *    was also tried: no change at all (still 9/24 on the reachable order).
 *    Rejected as a hypothesis.
 *
 * `ext.cy` being off by 1-2 EMU in several cases (not just `off.x`/`off.y`)
 * is notable: `ext.cy` is a pure `chExt * scale` multiply with no rotation
 * term in this implementation at all, yet only drifts when the group is ALSO
 * rotated - which points at PowerPoint computing this specific combined case
 * via some rotated-frame intermediate (e.g. refitting an axis-aligned box in
 * on-screen/rotated space, then converting back) rather than the
 * unrotated-local-box-plus-pivot model this module implements, not at a
 * simple rounding-order fix in EMU reachable from black-box outputs alone.
 * This is not re-derived here: it remains the one documented residual (see
 * `docs/guide/limitations.md`). `resolveRotatedResizeOffset` itself no-ops
 * (returns `undefined`) when the group is unrotated or neither extent axis
 * actually changed, so it is always safe to try: an unrotated group's
 * combined resize+child-edit, or a rotated group with a child edit but no
 * self-resize, both fall through to the pre-existing behaviour unchanged
 * (and both are byte-exact).
 *
 * @module group-tight-rewrap-own-box
 */
import { resolveRotatedResizeOffset } from '../../utils/rotated-resize-anchor';
import { resolveXfrmEmu } from '../../utils/xfrm-emu-resolution';
import type { GroupChildSpaceOwner } from './group-xfrm-preservation';

/** A group's fully re-wrapped own box: its new `a:chOff`/`a:chExt` and `a:off`/`a:ext`, all in EMU. */
export interface GroupTightRewrapOwnBox {
	readonly chOffXEmu: number;
	readonly chOffYEmu: number;
	readonly chExtWidthEmu: number;
	readonly chExtHeightEmu: number;
	readonly offXEmu: number;
	readonly offYEmu: number;
	readonly extWidthEmu: number;
	readonly extHeightEmu: number;
}

/** The group fields {@link rewrapGroupOwnBox} needs: its OWN immutable captured box plus rotation. */
export interface GroupOwnBoxAnchor extends GroupChildSpaceOwner {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly xEmu?: number;
	readonly yEmu?: number;
	readonly rotation?: number;
}

/**
 * Recompute a group's own `a:off`/`a:ext` so it keeps rendering its
 * (unmoved) content at the same screen position/scale while its `a:chOff`/
 * `a:chExt` move to `tightBox`.
 *
 * Derivation (COM-verified, see `group-tight-rewrap.ts`'s module doc): the
 * group's box is defined in an UNROTATED reference frame; `rotation` spins it
 * around ITS OWN center for rendering. PowerPoint keeps the OLD center as
 * that rotation's pivot: the new box's center is first mapped through the
 * OLD (unrotated) `off`/`chOff`/scale, then rotated around the OLD center to
 * get the NEW center. At `rotation = 0` this reduces to `newOff = oldOff +
 * (newChOff - oldChOff) * scale`.
 */
export function rewrapGroupOwnBox(
	owner: GroupOwnBoxAnchor,
	tightBox: Pick<
		GroupTightRewrapOwnBox,
		'chOffXEmu' | 'chOffYEmu' | 'chExtWidthEmu' | 'chExtHeightEmu'
	>,
	emuPerPx: number,
): Pick<GroupTightRewrapOwnBox, 'offXEmu' | 'offYEmu' | 'extWidthEmu' | 'extHeightEmu'> {
	// The group's OWN raw captured EMU for POSITION, NEVER `resolveXfrmEmu`:
	// a NESTED group's `.x`/`.y` are relative-to-its-immediate-parent
	// RENDER-frame pixels while `.xEmu`/`.yEmu` are its absolute original
	// `a:off` EMU - comparing them would discard the correct anchor (see
	// `group-xfrm-preservation.ts`). A plain resize never moves a group's own
	// top-left either way (COM ground truth: `a:off` unchanged, only `a:ext`
	// changes), so the raw captured EMU is the right position anchor at any
	// depth (px conversion is only a fallback for a fabricated group).
	const oldOffXEmu = owner.xEmu ?? Math.round(owner.x * emuPerPx);
	const oldOffYEmu = owner.yEmu ?? Math.round(owner.y * emuPerPx);
	// UNLIKE position, the group's own EXTENT legitimately changes when the
	// group itself was resized directly in the SAME save as a child edit
	// (`combined-order-a.pptx`, COM-measured): the tight re-wrap then uses
	// the group's CURRENT post-resize ext as the scale basis, not the stale
	// immutable one. `resolveXfrmEmu` is the same "prefer the immutable EMU
	// unless the current pixel value has diverged" check
	// `PptxElementTransformUpdater` uses for every ordinary element, and is
	// safe here (unlike for position) because a group's own `.width`/
	// `.height` are always in the SAME frame as its own `.widthEmu`/
	// `.heightEmu` - just before vs. after a possible resize.
	const oldExtWidthEmu = resolveXfrmEmu(owner.width, owner.widthEmu, emuPerPx);
	const oldExtHeightEmu = resolveXfrmEmu(owner.height, owner.heightEmu, emuPerPx);
	const oldChOffXEmu = owner.chOffXEmu ?? 0;
	const oldChOffYEmu = owner.chOffYEmu ?? 0;
	const oldChExtWidthEmu = owner.chExtWidthEmu ?? 0;
	const oldChExtHeightEmu = owner.chExtHeightEmu ?? 0;

	// When the group is ROTATED and was ALSO resized directly in this same
	// save (its current extent, just resolved above, differs from its
	// immutable captured one), the pivot this re-wrap anchors on is not the
	// group's ORIGINAL (pre-resize) corner: PowerPoint applies its own
	// plain-resize anchor rule first (as if no child had been touched), THEN
	// re-wraps around THAT result. See this module's doc for the COM ground
	// truth. `resolveRotatedResizeOffset` no-ops (returns `undefined`) when
	// unrotated or when neither extent axis changed, so this is always safe
	// to attempt and falls through to the ORIGINAL corner otherwise -
	// unchanged from the pre-existing (COM-verified) unrotated behaviour.
	const selfResizeAnchor = resolveRotatedResizeOffset({
		rotationDeg: owner.rotation,
		oldOffXEmu: owner.xEmu,
		oldOffYEmu: owner.yEmu,
		oldExtWidthEmu: owner.widthEmu,
		oldExtHeightEmu: owner.heightEmu,
		newExtWidthEmu: oldExtWidthEmu,
		newExtHeightEmu: oldExtHeightEmu,
		naiveOffXEmu: oldOffXEmu,
		naiveOffYEmu: oldOffYEmu,
	});
	const pivotOffXEmu = selfResizeAnchor ? selfResizeAnchor.offXEmu : oldOffXEmu;
	const pivotOffYEmu = selfResizeAnchor ? selfResizeAnchor.offYEmu : oldOffYEmu;

	// Matches `invertChildIntoGroupSpace`'s scale convention exactly (the
	// group's OWN current extent over its captured chExt), so a child's
	// contribution to `tightBox` and the group's own re-derived box always
	// agree on how big one child-space unit renders.
	const scaleX = oldChExtWidthEmu > 0 ? oldExtWidthEmu / oldChExtWidthEmu : 1;
	const scaleY = oldChExtHeightEmu > 0 ? oldExtHeightEmu / oldChExtHeightEmu : 1;

	const extWidthEmu = Math.round(tightBox.chExtWidthEmu * scaleX);
	const extHeightEmu = Math.round(tightBox.chExtHeightEmu * scaleY);

	// The new TOP-LEFT corner, mapped through the OLD (unrotated) off/chOff/
	// scale - where it would sit if the group had never been rotated.
	// Anchored on the corner rather than derived by round-tripping through a
	// center built from the ALREADY-ROUNDED `extWidthEmu`/`extHeightEmu`:
	// that round trip loses up to +/-0.5 EMU whenever `scaleX`/`scaleY` is
	// not an exact ext-preserving ratio - i.e. when the group was ALSO
	// resized directly (`combined-order-a.pptx`'s off.x is 4318001, not the
	// 4318000 a center-based round trip gives). Deriving the center from
	// this corner-anchored offset instead agrees with a direct center
	// derivation whenever the ext rounds losslessly (identity scale, both
	// other ground-truth decks below), and is exact when it does not.
	const naiveNewOffXEmu = pivotOffXEmu + (tightBox.chOffXEmu - oldChOffXEmu) * scaleX;
	const naiveNewOffYEmu = pivotOffYEmu + (tightBox.chOffYEmu - oldChOffYEmu) * scaleY;
	const naiveNewCenterX = naiveNewOffXEmu + extWidthEmu / 2;
	const naiveNewCenterY = naiveNewOffYEmu + extHeightEmu / 2;

	const oldCenterX = pivotOffXEmu + oldExtWidthEmu / 2;
	const oldCenterY = pivotOffYEmu + oldExtHeightEmu / 2;
	const rotationRadians = ((owner.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(rotationRadians);
	const sin = Math.sin(rotationRadians);
	const dx = naiveNewCenterX - oldCenterX;
	const dy = naiveNewCenterY - oldCenterY;
	// Rotate the naive center around the OLD center (the fixed pivot) to get
	// the group's actual new center; at rotation 0 this is a no-op (dx, dy).
	const newCenterX = oldCenterX + dx * cos - dy * sin;
	const newCenterY = oldCenterY + dx * sin + dy * cos;

	return {
		offXEmu: Math.round(newCenterX - extWidthEmu / 2),
		offYEmu: Math.round(newCenterY - extHeightEmu / 2),
		extWidthEmu,
		extHeightEmu,
	};
}
