/**
 * Anchor-preserving `a:off` correction for a ROTATED shape that is itself a
 * direct CHILD of a group, when it is resized (not just moved). Split out of
 * `group-xfrm-preservation.ts` to keep that module under the repo's 300-LOC
 * guideline.
 *
 * ## Why this cannot reuse `rotated-resize-anchor.ts` directly
 *
 * `resolveRotatedResizeOffset` (`rotated-resize-anchor.ts`) recovers the
 * anchor point a resize implicitly held in place and keeps it fixed on
 * screen once rotated - but it needs every input in ONE consistent,
 * ISOTROPIC (equal x/y scale) frame, because a genuine geometric rotation
 * only behaves like a rotation in such a frame. A group child's OWN `a:off`/
 * `a:ext` live in the group's CHILD-SPACE (`a:chOff`/`a:chExt`) coordinate
 * system, which can scale x and y by DIFFERENT factors relative to the
 * group's own render size - an anisotropic map that would silently distort
 * "rotate by `child.rotation` degrees" into a shear if applied there
 * directly.
 *
 * The child's CURRENT relative-to-group PIXEL geometry (`child.x`/`y`/
 * `width`/`height`, from `transformGroupChild` - the group's OWN rotation is
 * applied separately, as a container-level transform, so this local frame is
 * always isotropic) is exactly the right frame instead: it is where
 * `child.rotation` actually spins the shape for rendering. This module:
 *
 *  1. Forward-maps the child's OLD (as-parsed) child-space EMU box into that
 *     same isotropic render-relative-EMU frame, using the SAME fixed
 *     `owner`-derived per-axis scale {@link invertOffsetAxis}/
 *     {@link invertExtentAxis} use for the inverse direction (constant across
 *     the edit: it comes from the group's OWN immutable extent, never a
 *     "current" one - see that module's doc).
 *  2. Runs `resolveRotatedResizeOffset` entirely within that frame (old box,
 *     new extent, and the naive per-axis result all in render-relative EMU),
 *     exactly as `PptxElementTransformUpdater.ts` does for a top-level
 *     element.
 *  3. Inverts the corrected render-relative offset back into the group's
 *     child-space EMU the SAME way {@link invertOffsetAxis} does, so the
 *     result composes into `a:off` exactly like any other child value.
 *
 * ## Verified against real PowerPoint (COM automation)
 *
 * `s2-childresize-{25,90}.pptx`: an unrotated group with two children,
 * rotate one child (25 or 90 degrees, no move - rotating alone has no
 * effect per `rotated-resize-anchor.ts`), then resize it via
 * `GroupItems(1).Width`/`Height` (two SEPARATE COM property sets), one
 * `SaveAs`. Byte-exact at 90 degrees. At 25 degrees the SINGLE-SHOT formula
 * this module implements (matching how this SDK's own editor applies one
 * resize as one final state, not two COM-style sequential live-refits - the
 * same "order A" precedent documented in `group-tight-rewrap.ts` for the
 * combined group-resize-plus-child-edit case) is exact for EITHER axis
 * resized alone, and 1 EMU off on EACH axis when COM's ground truth was
 * produced by two sequential property sets rather than one combined edit
 * (verified: feeding the Width-only result back in as the "old" box for a
 * second, Height-only pass reproduces COM's number exactly) - see
 * `group-child-rotated-resize.test.ts`.
 *
 * @module group-child-rotated-resize
 */
import { resolveRotatedResizeOffset } from '../../utils/rotated-resize-anchor';
import type { GroupChildGeometry, GroupChildSpaceOwner } from './group-xfrm-preservation';

/** Forward-map one child-space EMU offset into the group's render-relative EMU frame (inverse of `invertOffsetAxis`). */
function forwardOffsetAxis(
	childSpaceEmu: number,
	chOffEmu: number,
	chExtEmu: number,
	extEmu: number,
): number {
	if (chExtEmu === 0) {
		return childSpaceEmu - chOffEmu;
	}
	return ((childSpaceEmu - chOffEmu) * extEmu) / chExtEmu;
}

/** Forward-map one child-space EMU extent into the group's render-relative EMU frame (inverse of `invertExtentAxis`). */
function forwardExtentAxis(childSpaceExtEmu: number, chExtEmu: number, extEmu: number): number {
	if (chExtEmu === 0) {
		return childSpaceExtEmu;
	}
	return (childSpaceExtEmu * extEmu) / chExtEmu;
}

/** Invert one render-relative EMU offset into the group's child-space EMU (the EMU-native core of `invertOffsetAxis`). */
function invertOffsetAxisEmu(
	relativeEmu: number,
	chOffEmu: number,
	chExtEmu: number,
	extEmu: number,
): number {
	if (extEmu === 0) {
		return chOffEmu + Math.round(relativeEmu);
	}
	return chOffEmu + Math.round((relativeEmu * chExtEmu) / extEmu);
}

/** This helper's inputs: a group child carrying its own rotation, plus its as-parsed child-space EMU box. */
export interface RotatedGroupChildResizeInput extends GroupChildGeometry {
	readonly rotation?: number;
}

/**
 * Corrected child-space `a:off` for a ROTATED direct child of `owner` whose
 * `a:ext` changed, preserving the on-screen anchor point the resize
 * implicitly held in place - see the module doc. `undefined` when no
 * correction applies (unrotated, no captured old box, or neither axis
 * resized): the caller falls back to the naive per-axis inversion.
 */
export function resolveRotatedChildResizeOffset(
	child: RotatedGroupChildResizeInput,
	owner: GroupChildSpaceOwner,
	emuPerPx: number,
): { readonly xEmu: number; readonly yEmu: number } | undefined {
	if (
		!child.rotation ||
		child.xEmu === undefined ||
		child.yEmu === undefined ||
		child.widthEmu === undefined ||
		child.heightEmu === undefined
	) {
		return undefined;
	}
	const extCx = owner.widthEmu ?? 0;
	const extCy = owner.heightEmu ?? 0;
	const chOffXEmu = owner.chOffXEmu!;
	const chOffYEmu = owner.chOffYEmu!;
	const chExtWidthEmu = owner.chExtWidthEmu!;
	const chExtHeightEmu = owner.chExtHeightEmu!;

	const oldRenderXEmu = forwardOffsetAxis(child.xEmu, chOffXEmu, chExtWidthEmu, extCx);
	const oldRenderYEmu = forwardOffsetAxis(child.yEmu, chOffYEmu, chExtHeightEmu, extCy);
	const oldRenderWidthEmu = forwardExtentAxis(child.widthEmu, chExtWidthEmu, extCx);
	const oldRenderHeightEmu = forwardExtentAxis(child.heightEmu, chExtHeightEmu, extCy);

	const naiveRenderXEmu = Math.round(child.x * emuPerPx);
	const naiveRenderYEmu = Math.round(child.y * emuPerPx);
	const newRenderWidthEmu = Math.round(child.width * emuPerPx);
	const newRenderHeightEmu = Math.round(child.height * emuPerPx);

	const rotatedResize = resolveRotatedResizeOffset({
		rotationDeg: child.rotation,
		oldOffXEmu: oldRenderXEmu,
		oldOffYEmu: oldRenderYEmu,
		oldExtWidthEmu: oldRenderWidthEmu,
		oldExtHeightEmu: oldRenderHeightEmu,
		newExtWidthEmu: newRenderWidthEmu,
		newExtHeightEmu: newRenderHeightEmu,
		naiveOffXEmu: naiveRenderXEmu,
		naiveOffYEmu: naiveRenderYEmu,
	});
	if (!rotatedResize) {
		return undefined;
	}
	return {
		xEmu: invertOffsetAxisEmu(rotatedResize.offXEmu, chOffXEmu, chExtWidthEmu, extCx),
		yEmu: invertOffsetAxisEmu(rotatedResize.offYEmu, chOffYEmu, chExtHeightEmu, extCy),
	};
}
