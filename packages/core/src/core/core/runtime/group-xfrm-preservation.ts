/**
 * Pure decision helpers for resolving a `p:grpSp`'s child coordinate space
 * (`a:chOff`/`a:chExt`) and each direct child's `a:off`/`a:ext` on save.
 *
 * ## Why the normalized space used to lose precision (and data)
 *
 * `PptxHandlerRuntimeGroupParsing.ts` resolves every child's `a:off`/`a:ext`
 * (authored in the group's CHILD coordinate space, `a:chOff`/`a:chExt`) into
 * the group's own PARENT-space pixels via `transformGroupChild`
 * (`group-shape-geometry.ts`), but leaves each child's `xEmu`/`yEmu`/
 * `widthEmu`/`heightEmu` as the RAW, untransformed child-space integers.
 * Historically, `save-group-shape-xml.ts` re-emitted a group's ORIGINAL
 * `a:chOff`/`a:chExt` and its children's ORIGINAL `a:off`/`a:ext` only when
 * the ENTIRE subtree was byte-unchanged since load, and unconditionally
 * reset to a fresh `chOff 0,0` / `chExt == ext` space (re-quantizing every
 * child directly from its current pixel value) the moment ANYTHING in the
 * group had moved - even a single sibling shape three levels away. The
 * result rendered identically but discarded the source authoring
 * convention for a group nobody had actually touched.
 *
 * ## The fix: invert the parse-time mapping instead of discarding it
 *
 * A group's `a:chOff`/`a:chExt` describe a fixed child coordinate SYSTEM -
 * an authoring choice, unrelated to how big the group currently renders.
 * {@link invertChildIntoGroupSpace} inverts `transformGroupChild`: given the
 * group's captured `a:chOff`/`a:chExt` (see {@link hasCapturedChildSpace})
 * and its OWN IMMUTABLE source extent (`widthEmu`/`heightEmu`, captured once
 * at parse time from ITS OWN `a:ext` and never mutated by an edit), it
 * re-derives a child's exact original EMU verbatim when nothing about that
 * child has changed, and otherwise computes the child-space EMU its CURRENT
 * relative-to-group pixel geometry maps to.
 *
 * `a:chOff`/`a:chExt` are therefore ALWAYS preserved verbatim once captured
 * (see {@link hasCapturedChildSpace}), independent of whether anything in
 * the subtree changed; only a group with NO captured space at all (created
 * in the editor) or a degenerate one (`chExt` of zero on an axis)
 * legitimately falls back to a fresh `chOff 0,0` / `chExt == ext` space. See
 * `save-group-transform-xml.ts`'s `buildGroupTransformXml` and
 * `applyGroupChildTransform`, and `PptxElementTransformUpdater.ts`, for
 * where these helpers plug in.
 *
 * ## Verified against real PowerPoint (COM automation)
 *
 * Two ground-truth decks (built and re-saved through PowerPoint via COM,
 * see this fix's commit for the scripts) settle the two cases this module
 * targets:
 *
 *  - **A group resized directly, no child touched**: PowerPoint keeps
 *    `a:chOff`/`a:chExt` AND every child's own `a:off`/`a:ext` byte-for-byte
 *    verbatim, only rewriting the group's OWN `a:off`/`a:ext` to the new
 *    size. The render-time scale (`ext / chExt`) changes as a result - the
 *    children visually scale with the group, exactly as "children scale
 *    within the child space" describes - but their AUTHORED numbers do not.
 *    This is why {@link isGroupChildUnchanged} and
 *    {@link invertChildIntoGroupSpace} deliberately use the group's
 *    IMMUTABLE `widthEmu`/`heightEmu` as the scale denominator, NEVER a
 *    "current" resolved extent: using the group's current (post-resize)
 *    pixel extent instead would make an untouched child look "changed"
 *    (the scale shifted) and needlessly re-quantize it, contradicting this
 *    ground truth.
 *  - **One child moved, the group itself untouched**: PowerPoint ALSO
 *    recomputes the group's own bounding box (both its `a:off`/`a:ext` and,
 *    in this case, `a:chOff`/`a:chExt`) to tightly re-wrap the new set of
 *    children - a `p:grpSp`'s box has no slack, PowerPoint auto-fits it on
 *    every edit. THIS module computes each child's own resulting
 *    `a:off`/`a:ext` (the MOVED child's value by inverting the SAME
 *    parse-time mapping PowerPoint used to place it, through the preserved
 *    child space; every unmoved sibling's exact original value verbatim -
 *    see {@link invertChildIntoGroupSpace}), which never changes regardless
 *    of any re-wrap. The auto-fit itself - computing the group's OWN new
 *    `a:chOff`/`a:chExt`/`a:off`/`a:ext` as the tight bounding box of those
 *    same per-child results, propagated through every enclosing ancestor -
 *    is `group-tight-rewrap.ts`'s `resolveGroupTightRewrap`, verified
 *    byte-exact against real PowerPoint including a rotated child, a
 *    rotated group, and nested groups.
 *
 * A NESTED group's own `x`/`y`/`width`/`height` are expressed relative to
 * its immediate parent's origin and already scaled by every ancestor above
 * it (see `PptxHandlerRuntimeGroupParsing.ts`'s "Convert children to
 * group-relative coordinates" step), a different frame than its own
 * immutable `widthEmu`/`heightEmu` (its OWN source `a:ext`) - but that
 * immutable extent is exactly what THIS module needs for computing ITS OWN
 * children's scale (see above: always the immutable source, never a
 * resolved "current" one), so no frame conversion is needed there at any
 * depth. The frame mismatch only affects resolving a NESTED group's OWN
 * `a:off`/`a:ext` (its placement WITHIN its immediate parent): the ENCLOSING
 * group's own {@link invertChildIntoGroupSpace} call, treating the nested
 * group as one of its children, already inverts that parent's `chOff`/scale
 * correctly and produces the nested group's own resolved `a:off`/`a:ext` as
 * its ordinary result; the caller threads that result in to
 * `buildGroupTransformXml` (`save-group-transform-xml.ts`) as
 * `ownEmuOverride` for the nested group's own recursive call, instead of
 * asking that group to re-derive its own placement from its `x`/`xEmu`
 * directly (which is valid only at depth 0).
 *
 * @module group-xfrm-preservation
 */
import { isXfrmEmuUnchanged } from '../../utils/xfrm-emu-resolution';
import { resolveRotatedChildResizeOffset } from './group-child-rotated-resize';

/** The subset of `GroupPptxElement` describing its captured child coordinate space. */
export interface GroupChildSpaceEmu {
	readonly chOffXEmu?: number;
	readonly chOffYEmu?: number;
	readonly chExtWidthEmu?: number;
	readonly chExtHeightEmu?: number;
}

/** Minimal geometry view of a group child (leaf or nested group). */
export interface GroupChildGeometry {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly xEmu?: number;
	readonly yEmu?: number;
	readonly widthEmu?: number;
	readonly heightEmu?: number;
	/** The child's own rotation; see `group-child-rotated-resize.ts` for why a resized ROTATED child needs it. */
	readonly rotation?: number;
}

/**
 * Whether a group carries a real, usable original child coordinate space:
 * `a:chOff`/`a:chExt` EMU were captured at parse time
 * (`PptxHandlerRuntimeGroupParsing.ts`) and the extent is non-degenerate on
 * both axes. `false` is the ONLY signal that legitimately resets a group to
 * a fresh `chOff 0,0` / `chExt == ext` space: a group created in the editor
 * (which never authors `a:chOff`/`a:chExt`), or one whose captured `chExt`
 * is zero on an axis (nothing to invert against).
 */
export function hasCapturedChildSpace(group: GroupChildSpaceEmu): boolean {
	return (
		group.chOffXEmu !== undefined &&
		group.chOffYEmu !== undefined &&
		group.chExtWidthEmu !== undefined &&
		group.chExtHeightEmu !== undefined &&
		group.chExtWidthEmu > 0 &&
		group.chExtHeightEmu > 0
	);
}

/**
 * A group's captured child space paired with its OWN IMMUTABLE source
 * extent (`widthEmu`/`heightEmu`, from its OWN `a:ext`; never a "current"
 * resolved value - see the module doc for why that distinction is
 * load-bearing). This is exactly the shape of a `GroupPptxElement` itself;
 * no derivation is needed to produce it.
 */
export interface GroupChildSpaceOwner extends GroupChildSpaceEmu {
	readonly widthEmu?: number;
	readonly heightEmu?: number;
}

/**
 * Whether ONE child's current (relative-to-group) geometry still matches
 * what its stored child-space EMU would produce through `owner`'s captured
 * `a:chOff`/`a:chExt` and OWN IMMUTABLE source extent. Inverting
 * `transformGroupChild` needs only `owner`'s `chOff`/`chExt`/extent, never
 * the group's absolute position: `childSpaceX = chX + child.x / scaleX`,
 * `childSpaceWidth = child.width / scaleX` (and the Y axis symmetrically).
 */
export function isGroupChildUnchanged(
	child: GroupChildGeometry,
	owner: GroupChildSpaceOwner,
	emuPerPx: number,
): boolean {
	if (!hasCapturedChildSpace(owner)) {
		return false;
	}
	const chX = owner.chOffXEmu! / emuPerPx;
	const chY = owner.chOffYEmu! / emuPerPx;
	const chW = owner.chExtWidthEmu! / emuPerPx;
	const chH = owner.chExtHeightEmu! / emuPerPx;
	const parentW = (owner.widthEmu ?? 0) / emuPerPx;
	const parentH = (owner.heightEmu ?? 0) / emuPerPx;
	const scaleX = chW > 0 ? parentW / chW : 1;
	const scaleY = chH > 0 ? parentH / chH : 1;
	if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
		return false;
	}

	const childSpaceX = chX + child.x / scaleX;
	const childSpaceY = chY + child.y / scaleY;
	const childSpaceWidth = child.width / scaleX;
	const childSpaceHeight = child.height / scaleY;

	return (
		isXfrmEmuUnchanged(childSpaceX, child.xEmu, emuPerPx) &&
		isXfrmEmuUnchanged(childSpaceY, child.yEmu, emuPerPx) &&
		isXfrmEmuUnchanged(childSpaceWidth, child.widthEmu, emuPerPx) &&
		isXfrmEmuUnchanged(childSpaceHeight, child.heightEmu, emuPerPx)
	);
}

/** One direct child's resolved `a:off`/`a:ext` EMU, ready to write verbatim. */
export interface GroupChildSpaceResult {
	readonly xEmu: number;
	readonly yEmu: number;
	readonly widthEmu: number;
	readonly heightEmu: number;
}

/** Invert one offset axis: `chOffEmu + round(relativeEmu * chExtEmu / extEmu)`, guarded against a zero extent. */
function invertOffsetAxis(
	relativePx: number,
	chOffEmu: number,
	chExtEmu: number,
	extEmu: number,
	emuPerPx: number,
): number {
	const relativeEmu = Math.round(relativePx * emuPerPx);
	if (extEmu === 0) {
		return chOffEmu + relativeEmu;
	}
	return chOffEmu + Math.round((relativeEmu * chExtEmu) / extEmu);
}

/** Invert one extent axis: `round(emu * chExtEmu / extEmu)`, guarded against a zero extent. */
function invertExtentAxis(px: number, chExtEmu: number, extEmu: number, emuPerPx: number): number {
	const emu = Math.round(px * emuPerPx);
	if (extEmu === 0) {
		return emu;
	}
	return Math.round((emu * chExtEmu) / extEmu);
}

/**
 * Resolve one direct child's `a:off`/`a:ext` EMU against `owner`'s captured
 * child space.
 *
 * Returns the child's ORIGINAL raw EMU verbatim (avoiding any float
 * round-trip) when {@link isGroupChildUnchanged} confirms it has not moved
 * or resized since load; otherwise returns the INVERSE of the parse-time
 * mapping (`PptxHandlerRuntimeGroupParsing.ts`'s `transformGroupChild`)
 * applied to the child's CURRENT relative-to-group pixel geometry, through
 * `owner`'s OWN IMMUTABLE source extent (never a "current" resolved one -
 * see the module doc's PowerPoint-verified group-resize case for why).
 *
 * `undefined` when `owner` has no usable captured child space at all (see
 * {@link hasCapturedChildSpace}); the caller falls back to
 * `resolveXfrmEmu`'s ordinary per-axis behaviour in that case, which is
 * already correct for the normalized `chOff 0,0` / `chExt == ext` space.
 *
 * When the child is ROTATED and its `a:ext` changed, the naive per-axis
 * inversion below visibly drifts the corner/edge the resize meant to hold in
 * place, exactly as it would for a top-level element - see
 * `group-child-rotated-resize.ts` for why this needs its own helper (a group
 * child's space can scale x/y anisotropically, so the rotation-aware
 * correction cannot run directly in child-space EMU) and the COM-verified
 * formula. At `rotation = 0`, or when neither axis actually resized, that
 * helper returns `undefined` and the naive result stands untouched.
 */
export function invertChildIntoGroupSpace(
	child: GroupChildGeometry,
	owner: GroupChildSpaceOwner,
	emuPerPx: number,
): GroupChildSpaceResult | undefined {
	if (!hasCapturedChildSpace(owner)) {
		return undefined;
	}
	if (
		child.xEmu !== undefined &&
		child.yEmu !== undefined &&
		child.widthEmu !== undefined &&
		child.heightEmu !== undefined &&
		isGroupChildUnchanged(child, owner, emuPerPx)
	) {
		return {
			xEmu: child.xEmu,
			yEmu: child.yEmu,
			widthEmu: child.widthEmu,
			heightEmu: child.heightEmu,
		};
	}
	const extCx = owner.widthEmu ?? 0;
	const extCy = owner.heightEmu ?? 0;
	const widthEmu = invertExtentAxis(child.width, owner.chExtWidthEmu!, extCx, emuPerPx);
	const heightEmu = invertExtentAxis(child.height, owner.chExtHeightEmu!, extCy, emuPerPx);
	const rotatedResize = resolveRotatedChildResizeOffset(child, owner, emuPerPx);
	return {
		xEmu: rotatedResize
			? rotatedResize.xEmu
			: invertOffsetAxis(child.x, owner.chOffXEmu!, owner.chExtWidthEmu!, extCx, emuPerPx),
		yEmu: rotatedResize
			? rotatedResize.yEmu
			: invertOffsetAxis(child.y, owner.chOffYEmu!, owner.chExtHeightEmu!, extCy, emuPerPx),
		widthEmu,
		heightEmu,
	};
}
