/**
 * Pure decision helpers that replicate PowerPoint's own bounding-box
 * auto-fit: after a direct child of a `p:grpSp` moves or resizes, PowerPoint
 * re-wraps the group's `a:chOff`/`a:chExt` (and, mapped through the SAME
 * scale, its own `a:off`/`a:ext`) tightly around the new set of children,
 * instead of leaving the group's own box stale.
 *
 * ## Verified against real PowerPoint (COM automation)
 *
 * Seven ground-truth decks (built and edited through PowerPoint via COM)
 * settle the formula this module implements:
 *
 *  - **One child moved** (identity scale): the group's `a:chOff`/`a:chExt`
 *    become the tight bounding box - plain min/max, using each child's OWN
 *    (unrotated) `a:off`/`a:ext` - of ALL direct children's resulting
 *    `a:off`/`a:ext` (the moved child's NEW value, every untouched sibling's
 *    ORIGINAL value verbatim - see `group-xfrm-preservation.ts`, never
 *    re-derived). The group's own `a:off`/`a:ext` then follows by keeping
 *    the render SCALE (`ext / chExt`) fixed and translating so the point
 *    that was `chOff` now sits where the new tight `chOff` maps to.
 *  - **A ROTATED child, not moved**: NO effect on the group's own box.
 *    PowerPoint's tight bbox always uses a child's own (unrotated) `a:off`/
 *    `a:ext`, never its rotated screen-space extents - confirmed by a COM
 *    deck where rotating one child 30 degrees left the group's box
 *    byte-identical. Falls out for free here: {@link resolveGroupTightRewrap}
 *    only looks at `x`/`y`/`width`/`height` (via `isGroupChildUnchanged`),
 *    never `rotation`.
 *  - **The group ITSELF is rotated**, and a child moves: the tight bbox is
 *    unaffected (still plain min/max in the unrotated child space), but the
 *    group's new center is NOT simply the naive translated center:
 *    PowerPoint keeps the OLD center as the rotation pivot and rotates the
 *    naive new center around it. See {@link rewrapGroupOwnBox}.
 *  - **A NESTED group's own box changes**: this propagates to every
 *    ancestor. This module needs no special-casing for that: a nested
 *    group is, from its own parent's point of view, just another child
 *    whose `x`/`y`/`width`/`height` the parent already compares via
 *    `isGroupChildUnchanged`/`invertChildIntoGroupSpace` - see
 *    {@link resolveGroupChildBoxEmu}, which recurses into a group child
 *    FIRST to resolve its own rewrapped box before treating it as an
 *    ordinary child of its parent.
 *  - **The group is ALSO resized directly, in the SAME save as a child
 *    edit** (`combined-order-a.pptx`: a group scaled 1.5x/1.2x via
 *    `Shape.Width`/`Height`, then one child moved AND resized via
 *    `GroupItems`, all before one `SaveAs`): scale/anchor key off the
 *    group's CURRENT extent (`resolveXfrmEmu`, since it legitimately
 *    diverges from the immutable one here), and the translation is anchored
 *    on the new TOP-LEFT corner directly rather than derived by
 *    round-tripping through a center built from the already-rounded new
 *    `a:ext`: that round trip loses up to +/-0.5 EMU whenever the resize
 *    scale is not ext-preserving, and PowerPoint's combined result (`a:off`
 *    `x="4318001"`) sits exactly on the corner-anchored value, one EMU off
 *    the center-round-tripped one. See {@link rewrapGroupOwnBox}'s "old"
 *    anchor derivation.
 *
 * ## What is intentionally NOT covered
 *
 * A group resized directly (the user drags the group's own handle, no child
 * touched) is unaffected: {@link resolveGroupTightRewrap} returns
 * `undefined` whenever every direct child is unchanged, leaving
 * `buildGroupTransformXml`'s pre-existing "preserve verbatim" path (see
 * `group-xfrm-preservation.ts`) untouched, which is the OTHER COM-verified
 * ground truth for an UNROTATED group (chOff/chExt AND every child
 * byte-identical, only the group's own `a:ext` changes, `a:off` untouched).
 *
 * A ROTATED group's OWN plain resize (no child touched at all) was a
 * SEPARATE gap found while chasing the combined case above, not fixed by it:
 * COM ground truth (`rot-plain-resize.pptx`, a 30-degree group with
 * `Shape.Width *= 1.5`) showed `a:off` moving in a way neither the old center
 * nor a naive corner anchor predicted - this module's "old" anchor for the
 * combined case above is still only verified for an UNROTATED group. That
 * separate gap is now closed in `rotated-resize-anchor.ts`
 * (`resolveRotatedResizeOffset`), wired into `buildGroupTransformXml`'s
 * plain-resize path (no `rewrap`) and `PptxElementTransformUpdater.ts`: the
 * "moves in a way neither reading predicted" turned out to be a THIRD
 * reading - the anchor point the resize implicitly held in place (recovered
 * from the naive per-axis result, not assumed to be the center or a corner)
 * stays fixed on screen once rotated. See that module's doc for the
 * COM-verified formula across 25/90/180/-40 degrees.
 *
 * A group resized and a child edited via TWO SEPARATE interactive steps
 * that each triggered PowerPoint's LIVE bounding-box refresh in between
 * (`combined-order-b.pptx`: child moved first, THEN the group resized) is
 * also not reproduced: COM's live model re-fits the group's box the instant
 * the child moves, so the SUBSEQUENT resize scales off that already
 * re-fitted box. This module computes the rewrap once, from the FINAL
 * element state - matching this SDK's own editor, where every interactive
 * change converts through whatever scale is CURRENTLY rendering, so there
 * is only ever one live state to save, never two COM-style snapshots:
 * "order A" is what this architecture actually produces.
 *
 * @module group-tight-rewrap
 */
import type { GroupPptxElement, PptxElement } from '../../types';
import { rewrapGroupOwnBox } from './group-tight-rewrap-own-box';
import type { GroupChildSpaceOwner, GroupChildSpaceResult } from './group-xfrm-preservation';
import {
	hasCapturedChildSpace,
	invertChildIntoGroupSpace,
	isGroupChildUnchanged,
} from './group-xfrm-preservation';

export { rewrapGroupOwnBox } from './group-tight-rewrap-own-box';
export type { GroupOwnBoxAnchor } from './group-tight-rewrap-own-box';

/** A group's fully re-wrapped own box: its new `a:chOff`/`a:chExt` and `a:off`/`a:ext`, all in EMU. */
export interface GroupTightRewrapResult {
	readonly chOffXEmu: number;
	readonly chOffYEmu: number;
	readonly chExtWidthEmu: number;
	readonly chExtHeightEmu: number;
	readonly offXEmu: number;
	readonly offYEmu: number;
	readonly extWidthEmu: number;
	readonly extHeightEmu: number;
}

/** Plain min/max bounding box of a set of already-resolved child `a:off`/`a:ext` EMU. */
function computeTightChildBox(
	children: readonly GroupChildSpaceResult[],
): Pick<GroupTightRewrapResult, 'chOffXEmu' | 'chOffYEmu' | 'chExtWidthEmu' | 'chExtHeightEmu'> {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const child of children) {
		minX = Math.min(minX, child.xEmu);
		minY = Math.min(minY, child.yEmu);
		maxX = Math.max(maxX, child.xEmu + child.widthEmu);
		maxY = Math.max(maxY, child.yEmu + child.heightEmu);
	}
	return {
		chOffXEmu: minX,
		chOffYEmu: minY,
		chExtWidthEmu: maxX - minX,
		chExtHeightEmu: maxY - minY,
	};
}

/**
 * Resolve one direct child's `a:off`/`a:ext` EMU as a value of `owner` (a
 * group), recursing into a GROUP child first so an edit several levels down
 * is visible to its immediate parent as an ordinary "this child changed"
 * signal - see the module doc. The single entry point both
 * {@link resolveGroupTightRewrap} and the save-path callers
 * (`PptxHandlerRuntimeSaveShapeXml.ts`, `PptxElementTransformUpdater.ts`)
 * use in place of a bare `invertChildIntoGroupSpace` call, so a nested
 * group's own tight-rewrap is never bypassed as an opaque, unchanged box.
 */
export function resolveGroupChildBoxEmu(
	child: PptxElement,
	owner: GroupChildSpaceOwner,
	emuPerPx: number,
): GroupChildSpaceResult | undefined {
	if (child.type === 'group') {
		const nestedRewrap = resolveGroupTightRewrap(child, emuPerPx);
		if (nestedRewrap) {
			return {
				xEmu: nestedRewrap.offXEmu,
				yEmu: nestedRewrap.offYEmu,
				widthEmu: nestedRewrap.extWidthEmu,
				heightEmu: nestedRewrap.extHeightEmu,
			};
		}
	}
	return invertChildIntoGroupSpace(child, owner, emuPerPx);
}

/**
 * Whether `group` needs its own `a:chOff`/`a:chExt`/`a:off`/`a:ext`
 * re-wrapped, and if so, what to. `undefined` means "nothing under this
 * group changed" (or it has no captured child space at all): the caller
 * falls back to the pre-existing "preserve verbatim" path. A direct child
 * counts as changed via `isGroupChildUnchanged` (a leaf), or - for a group
 * child - via ITS OWN recursive rewrap being non-`undefined` (its subtree
 * changed, so its box moved from this group's view too, even if untouched).
 */
export function resolveGroupTightRewrap(
	group: GroupPptxElement,
	emuPerPx: number,
): GroupTightRewrapResult | undefined {
	if (!hasCapturedChildSpace(group)) {
		return undefined;
	}
	const childResults: GroupChildSpaceResult[] = [];
	let anyChanged = false;
	for (const child of group.children) {
		const nestedRewrap =
			child.type === 'group' ? resolveGroupTightRewrap(child, emuPerPx) : undefined;
		if (nestedRewrap !== undefined || !isGroupChildUnchanged(child, group, emuPerPx)) {
			anyChanged = true;
		}
		const emu = nestedRewrap
			? {
					xEmu: nestedRewrap.offXEmu,
					yEmu: nestedRewrap.offYEmu,
					widthEmu: nestedRewrap.extWidthEmu,
					heightEmu: nestedRewrap.extHeightEmu,
				}
			: invertChildIntoGroupSpace(child, group, emuPerPx);
		if (emu) {
			childResults.push(emu);
		}
	}
	if (!anyChanged || childResults.length === 0) {
		return undefined;
	}
	const tightBox = computeTightChildBox(childResults);
	return { ...tightBox, ...rewrapGroupOwnBox(group, tightBox, emuPerPx) };
}
