/**
 * Pure decision helper for the `a:off` PowerPoint writes when a ROTATED
 * element's `a:ext` changes size but nothing about the element's position was
 * explicitly moved (a plain resize: `Shape.Width`/`Shape.Height`/`ScaleWidth`/
 * `ScaleHeight` via COM, or this SDK's own resize-handle drag).
 *
 * ## The problem
 *
 * `a:off`/`a:ext` describe a shape's UNROTATED bounding box; `a:rot` then
 * spins that box around its OWN center for rendering (§20.1.7.6). Resizing
 * naively - keep `a:off` on whichever axis did not change, re-quantize the
 * other from the model's current pixel value - is exactly correct when
 * `rot` is 0 (`resolveXfrmEmu`'s existing per-axis behaviour), but wrong the
 * instant the element is rotated: growing `a:ext` moves the box's center in
 * the UNROTATED frame, and since that center is also the rotation pivot, the
 * corner/edge the user meant to hold in place visibly drifts on screen
 * unless `a:off` compensates.
 *
 * ## Ground truth (COM automation, real PowerPoint)
 *
 * Built a rotated group/shape at 25, 90, 180 and -40 degrees and resized each
 * via `Shape.Width`, `Shape.Height`, both together, and `ScaleWidth` from
 * `msoScaleFromTopLeft`/`msoScaleFromMiddle`. Every case matches ONE formula,
 * byte-exact in EMU:
 *
 *  - The visually rendered position of whichever LOCAL (unrotated) point the
 *    edit anchors - the untouched edge/corner for a `Width`/`Height` setter
 *    or `ScaleFrom TopLeft` (top-left anchored, grows right/down), the exact
 *    center for `ScaleFromMiddle` - stays fixed on screen.
 *  - That anchor point is expressible as a fraction of the OLD box
 *    (`{fx, fy}`, 0..1 per axis) and is recoverable from what a NAIVE
 *    (rotation-unaware) resolve already produced for `a:off`, without any
 *    caller needing to know which handle/property drove the edit: comparing
 *    the naive new offset against the OLD offset on an axis whose extent
 *    changed reveals exactly which fraction of that axis stayed put
 *    (`fx = 0` when the naive offset didn't move at all - "grow from the
 *    left" - `fx = 1` when it moved by the full negated delta - "grow from
 *    the right" - `fx = 0.5` when it moved by exactly half that delta -
 *    "grow from the center", which is also why `ScaleFromMiddle` needs no
 *    special case: the fraction that falls out is 0.5 and the correction
 *    below becomes a no-op).
 *  - Given the anchor fraction, the OLD box's center, and how far each axis's
 *    extent changed, the NEW center is the old center shifted by that
 *    (unrotated) local displacement ROTATED by `rot`. `a:off` is then just
 *    `newCenter - newExt / 2`.
 *
 * At `rot = 0` this reduces exactly to the naive per-axis result (the
 * rotation matrix is the identity), so {@link resolveRotatedResizeOffset}
 * only changes anything for a genuinely rotated element; callers gate on its
 * `undefined` return (no old EMU captured, or neither axis actually resized)
 * to fall back to the pre-existing behaviour untouched, so an unrotated
 * resize's existing exact-EMU golden values are unaffected.
 *
 * ## BOTH axes resized in the same edit: sequential, not simultaneous
 *
 * When `Width` AND `Height` both change in the same save (a corner-handle
 * drag, or `Shape.Width`/`Shape.Height` set back-to-back via COM before one
 * `SaveAs`), composing the anchor correction as ONE simultaneous rotation
 * (a single call into the derivation above, with both deltas nonzero) lands
 * 1 EMU off on EACH axis at an irrational angle - COM ground truth
 * (`s2-childresize-25.pptx`, see `group-child-rotated-resize.ts`) shows
 * PowerPoint's own result matches feeding the WIDTH-only correction back in
 * as the "old" box for a second, HEIGHT-only pass instead: two sequential
 * single-axis corrections, each re-anchored against the previous step's
 * (rounded) result, not one combined delta. Re-verified by fresh COM
 * automation across 8 angles (25, 37, -40, 61, 113, 155, 200, 290) and two
 * scenarios - a plain rotated top-level shape and a rotated group child,
 * both resized on both axes in one edit - byte-exact in every case (see
 * `rotated-resize-anchor.test.ts` and `group-child-rotated-resize.test.ts`);
 * order (width-then-height vs height-then-width) did not change the result
 * in any swept case, so {@link resolveRotatedResizeOffset} always applies
 * width first. This is why the derivation above is factored into
 * {@link resolveSingleAxisRotatedResizeOffset}: the public function is a
 * dispatcher over one or two calls into it, never a "both deltas in one
 * rotation" formula.
 *
 * This does NOT close every combined-edit gap: a ROTATED GROUP resized
 * directly on both axes AND ALSO having a child edited in the SAME save
 * (`group-tight-rewrap-own-box.ts`'s `rewrapGroupOwnBox`, which calls this
 * function for its own "self-resize" step, then performs a SECOND, separate
 * rotation to re-wrap around the tightened child bbox) still lands 1 EMU off
 * on `off.x`/`ext.cy` at 25 degrees - confirmed unchanged by this fix
 * (verified by feeding the sequential result through that second step) and
 * NOT explained by intermediate-EMU rounding either (an unrounded-pivot
 * variant was tried and made the unrotated golden case wrong instead of
 * fixing the rotated one). See that module's doc for the residual this fix
 * does not reach.
 *
 * See `save-group-transform-xml.ts` (a top-level group's own resize) and
 * `PptxElementTransformUpdater.ts` (every other top-level element type) for
 * the two call sites. A group CHILD's resize goes through
 * `group-xfrm-preservation.ts`'s child-space inversion instead, and a
 * group's re-wrap after a CHILD edit through `group-tight-rewrap.ts`'s
 * `rewrapGroupOwnBox`, both out of scope here (see that module's doc for the
 * distinction).
 *
 * @module rotated-resize-anchor
 */

/** Inputs {@link resolveRotatedResizeOffset} needs, all in EMU (position/extent) or degrees (rotation). */
export interface RotatedResizeAnchorInput {
	/** The element's current rotation, `a:rot`'s source value in degrees. */
	readonly rotationDeg: number | undefined;
	/** The element's `a:off`/`a:ext` EXACTLY as parsed (before this edit). `undefined` when unknown (SDK-created, or unparsed). */
	readonly oldOffXEmu: number | undefined;
	readonly oldOffYEmu: number | undefined;
	readonly oldExtWidthEmu: number | undefined;
	readonly oldExtHeightEmu: number | undefined;
	/** The NEW `a:ext` this save is about to write (already resolved by the caller). */
	readonly newExtWidthEmu: number;
	readonly newExtHeightEmu: number;
	/** The `a:off` a rotation-UNAWARE resolve already produced for this save. */
	readonly naiveOffXEmu: number;
	readonly naiveOffYEmu: number;
}

/** The corrected `a:off`, when a correction applies; see the module doc for when it does not. */
export interface RotatedResizeAnchorResult {
	readonly offXEmu: number;
	readonly offYEmu: number;
}

/**
 * The single-axis-pair derivation (module doc): given an old box, a new
 * `a:ext`, and the naive `a:off` a rotation-unaware resolve already
 * produced, recover the anchor fraction per axis and rotate the OLD center
 * to the NEW one. Correct on its own whenever AT MOST ONE axis actually
 * resized; {@link resolveRotatedResizeOffset} is the only thing allowed to
 * call this with BOTH deltas nonzero (the internal second pass of its
 * sequential decomposition) - see the module doc for why calling this
 * directly with both deltas nonzero is 1 EMU off at an irrational angle.
 */
function resolveSingleAxisRotatedResizeOffset(input: {
	readonly rotationDeg: number;
	readonly oldOffXEmu: number;
	readonly oldOffYEmu: number;
	readonly oldExtWidthEmu: number;
	readonly oldExtHeightEmu: number;
	readonly newExtWidthEmu: number;
	readonly newExtHeightEmu: number;
	readonly naiveOffXEmu: number;
	readonly naiveOffYEmu: number;
}): RotatedResizeAnchorResult {
	const {
		rotationDeg,
		oldOffXEmu,
		oldOffYEmu,
		oldExtWidthEmu,
		oldExtHeightEmu,
		newExtWidthEmu,
		newExtHeightEmu,
		naiveOffXEmu,
		naiveOffYEmu,
	} = input;
	const deltaWidth = newExtWidthEmu - oldExtWidthEmu;
	const deltaHeight = newExtHeightEmu - oldExtHeightEmu;

	// Which fraction of each axis the edit held in place, recovered from what
	// the naive (rotation-unaware) resolve already computed for `a:off`; see
	// the module doc's derivation. An axis whose extent did not change has no
	// anchor to recover (and needs none: its term below is zero regardless).
	const anchorFx = deltaWidth !== 0 ? (oldOffXEmu - naiveOffXEmu) / deltaWidth : 0.5;
	const anchorFy = deltaHeight !== 0 ? (oldOffYEmu - naiveOffYEmu) / deltaHeight : 0.5;

	const rad = (rotationDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	const oldCenterX = oldOffXEmu + oldExtWidthEmu / 2;
	const oldCenterY = oldOffYEmu + oldExtHeightEmu / 2;

	// The anchor's displacement from the OLD center, in the UNROTATED local
	// frame, rotated into the frame the anchor is actually rendered in.
	const localX = (anchorFx - 0.5) * deltaWidth;
	const localY = (anchorFy - 0.5) * deltaHeight;
	const rotatedX = localX * cos - localY * sin;
	const rotatedY = localX * sin + localY * cos;

	const newCenterX = oldCenterX - rotatedX;
	const newCenterY = oldCenterY - rotatedY;

	return {
		offXEmu: Math.round(newCenterX - newExtWidthEmu / 2),
		offYEmu: Math.round(newCenterY - newExtHeightEmu / 2),
	};
}

/**
 * Recompute `a:off` for a rotated element whose `a:ext` changed, so the
 * anchor point the edit implicitly held in place stays at the same on-screen
 * position after rotation. Returns `undefined` when no correction is needed
 * or possible: no rotation, no captured "old" box to diff against, or
 * neither axis actually resized (a pure move never needs this - position is
 * stored axis-aligned and unaffected by rotation).
 *
 * When BOTH axes resized in this edit, this dispatches to TWO sequential
 * {@link resolveSingleAxisRotatedResizeOffset} calls (width first, then
 * height against the width-corrected intermediate box) rather than one
 * simultaneous rotation - see the module doc for the COM ground truth that
 * settled this.
 */
export function resolveRotatedResizeOffset(
	input: RotatedResizeAnchorInput,
): RotatedResizeAnchorResult | undefined {
	const {
		rotationDeg,
		oldOffXEmu,
		oldOffYEmu,
		oldExtWidthEmu,
		oldExtHeightEmu,
		newExtWidthEmu,
		newExtHeightEmu,
		naiveOffXEmu,
		naiveOffYEmu,
	} = input;
	if (
		!rotationDeg ||
		oldOffXEmu === undefined ||
		oldOffYEmu === undefined ||
		oldExtWidthEmu === undefined ||
		oldExtHeightEmu === undefined
	) {
		return undefined;
	}
	const deltaWidth = newExtWidthEmu - oldExtWidthEmu;
	const deltaHeight = newExtHeightEmu - oldExtHeightEmu;
	if (deltaWidth === 0 && deltaHeight === 0) {
		return undefined;
	}

	if (deltaWidth !== 0 && deltaHeight !== 0) {
		const widthOnly = resolveSingleAxisRotatedResizeOffset({
			rotationDeg,
			oldOffXEmu,
			oldOffYEmu,
			oldExtWidthEmu,
			oldExtHeightEmu,
			newExtWidthEmu,
			newExtHeightEmu: oldExtHeightEmu,
			naiveOffXEmu,
			naiveOffYEmu,
		});
		return resolveSingleAxisRotatedResizeOffset({
			rotationDeg,
			oldOffXEmu: widthOnly.offXEmu,
			oldOffYEmu: widthOnly.offYEmu,
			oldExtWidthEmu: newExtWidthEmu,
			oldExtHeightEmu,
			newExtWidthEmu,
			newExtHeightEmu,
			naiveOffXEmu: widthOnly.offXEmu,
			naiveOffYEmu: widthOnly.offYEmu,
		});
	}

	return resolveSingleAxisRotatedResizeOffset({
		rotationDeg,
		oldOffXEmu,
		oldOffYEmu,
		oldExtWidthEmu,
		oldExtHeightEmu,
		newExtWidthEmu,
		newExtHeightEmu,
		naiveOffXEmu,
		naiveOffYEmu,
	});
}
