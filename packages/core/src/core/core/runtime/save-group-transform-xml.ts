/**
 * Pure helpers for serialising a `GroupPptxElement`'s `a:xfrm` (its own
 * `a:off`/`a:ext`/`a:chOff`/`a:chExt`) and each direct child's `a:off`/
 * `a:ext` back to OpenXML.
 *
 * Split out of `save-group-shape-xml.ts` to keep both files under the
 * repo's 300-LOC guideline; see that module's doc for the broader
 * `CT_GroupShape` serialisation context these helpers plug into, and
 * `group-xfrm-preservation.ts` for the child-space inversion these two
 * functions are thin XML-shaping wrappers around.
 */
import type { XmlObject } from '../../types';
import { resolveRotatedResizeOffset } from '../../utils/rotated-resize-anchor';
import { resolveXfrmEmu } from '../../utils/xfrm-emu-resolution';
import type { GroupTightRewrapResult } from './group-tight-rewrap';
import {
	GroupChildSpaceOwner,
	GroupChildSpaceResult,
	hasCapturedChildSpace,
	invertChildIntoGroupSpace,
} from './group-xfrm-preservation';

/** Minimal geometry description of a group, in pixels. */
export interface GroupTransformInput {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly rotation?: number;
	readonly flipHorizontal?: boolean;
	readonly flipVertical?: boolean;
	/** Exact EMU this group's own `a:off`/`a:ext` were parsed from, when known. See `xfrm-emu-resolution.ts`. */
	readonly xEmu?: number;
	readonly yEmu?: number;
	readonly widthEmu?: number;
	readonly heightEmu?: number;
	/** Exact EMU this group's own `a:chOff`/`a:chExt` were parsed from. See `group-xfrm-preservation.ts`. */
	readonly chOffXEmu?: number;
	readonly chOffYEmu?: number;
	readonly chExtWidthEmu?: number;
	readonly chExtHeightEmu?: number;
}

/**
 * This group's own `a:off`/`a:ext` EMU, already resolved by the ENCLOSING
 * group's own {@link invertChildIntoGroupSpace} call (treating this group as
 * one of its children). Passed down for a NESTED group only; see
 * `group-xfrm-preservation.ts`'s module doc for why a nested group cannot
 * resolve this from its own `x`/`xEmu` directly.
 */
export interface GroupOwnEmuOverride {
	readonly xEmu: number;
	readonly yEmu: number;
	readonly widthEmu: number;
	readonly heightEmu: number;
}

/**
 * Build the group's `a:xfrm`.
 *
 * `a:off`/`a:ext` re-emit `ownEmuOverride` verbatim when the caller has
 * already resolved it (a NESTED group; see {@link GroupOwnEmuOverride}), or
 * the group's exact original EMU (via `resolveXfrmEmu`) when it has not
 * moved/resized since load, instead of re-quantizing from pixels. `rewrap`
 * (see `group-tight-rewrap.ts`) takes priority over both when present: it
 * means a direct child changed and PowerPoint's own bounding-box auto-fit
 * applies, so the group's `a:off`/`a:ext`/`a:chOff`/`a:chExt` all come from
 * it instead (its own off/ext is, by construction, numerically identical to
 * what `ownEmuOverride` would carry for this same group as a nested child -
 * see that module's doc - so there is no conflict between the two).
 *
 * When neither `rewrap` nor `ownEmuOverride` applies and the group IS
 * rotated, a resize (either `a:ext` axis differing from its captured EMU)
 * additionally runs through `resolveRotatedResizeOffset`
 * (`rotated-resize-anchor.ts`): rotating a box around its own center means a
 * naive per-axis `a:off` resolve visibly drifts the corner/edge the resize
 * was meant to hold in place. See that module's doc for the COM-verified
 * formula; at `rotation = 0` it is a no-op and the pre-existing per-axis
 * result is unchanged.
 *
 * Absent a `rewrap`, `a:chOff`/`a:chExt` are re-emitted verbatim whenever the
 * group carries a captured, non-degenerate child space (see
 * `group-xfrm-preservation.ts`'s `hasCapturedChildSpace`), REGARDLESS of
 * whether anything in the subtree has moved: that space is a fixed
 * authoring choice, not a derived value, so an edit anywhere in the subtree
 * never invalidates it BY ITSELF. Only a group with no captured space at all
 * (created in the editor) or a degenerate one (`chExt` of zero on an axis)
 * falls back to a fresh `chOff 0,0` / `chExt == ext` space.
 */
export function buildGroupTransformXml(
	group: GroupTransformInput,
	emuPerPx: number,
	ownEmuOverride?: GroupOwnEmuOverride,
	rewrap?: GroupTightRewrapResult,
): XmlObject {
	const extCx = rewrap
		? rewrap.extWidthEmu
		: ownEmuOverride
			? ownEmuOverride.widthEmu
			: resolveXfrmEmu(group.width, group.widthEmu, emuPerPx);
	const extCy = rewrap
		? rewrap.extHeightEmu
		: ownEmuOverride
			? ownEmuOverride.heightEmu
			: resolveXfrmEmu(group.height, group.heightEmu, emuPerPx);

	let offX: number;
	let offY: number;
	if (rewrap) {
		offX = rewrap.offXEmu;
		offY = rewrap.offYEmu;
	} else if (ownEmuOverride) {
		offX = ownEmuOverride.xEmu;
		offY = ownEmuOverride.yEmu;
	} else {
		const naiveOffX = resolveXfrmEmu(group.x, group.xEmu, emuPerPx);
		const naiveOffY = resolveXfrmEmu(group.y, group.yEmu, emuPerPx);
		const rotatedResize = resolveRotatedResizeOffset({
			rotationDeg: group.rotation,
			oldOffXEmu: group.xEmu,
			oldOffYEmu: group.yEmu,
			oldExtWidthEmu: group.widthEmu,
			oldExtHeightEmu: group.heightEmu,
			newExtWidthEmu: extCx,
			newExtHeightEmu: extCy,
			naiveOffXEmu: naiveOffX,
			naiveOffYEmu: naiveOffY,
		});
		offX = rotatedResize ? rotatedResize.offXEmu : naiveOffX;
		offY = rotatedResize ? rotatedResize.offYEmu : naiveOffY;
	}

	const xfrm: XmlObject = {};
	// `@_rot` is 60000ths of a degree (ECMA-376 ST_Angle); flips are "1" flags.
	if (typeof group.rotation === 'number' && group.rotation !== 0) {
		xfrm['@_rot'] = String(Math.round(group.rotation * 60000));
	}
	if (group.flipHorizontal) {
		xfrm['@_flipH'] = '1';
	}
	if (group.flipVertical) {
		xfrm['@_flipV'] = '1';
	}
	xfrm['a:off'] = { '@_x': String(offX), '@_y': String(offY) };
	xfrm['a:ext'] = { '@_cx': String(extCx), '@_cy': String(extCy) };
	if (rewrap) {
		xfrm['a:chOff'] = { '@_x': String(rewrap.chOffXEmu), '@_y': String(rewrap.chOffYEmu) };
		xfrm['a:chExt'] = {
			'@_cx': String(rewrap.chExtWidthEmu),
			'@_cy': String(rewrap.chExtHeightEmu),
		};
	} else if (hasCapturedChildSpace(group)) {
		xfrm['a:chOff'] = { '@_x': String(group.chOffXEmu), '@_y': String(group.chOffYEmu) };
		xfrm['a:chExt'] = { '@_cx': String(group.chExtWidthEmu), '@_cy': String(group.chExtHeightEmu) };
	} else {
		xfrm['a:chOff'] = { '@_x': '0', '@_y': '0' };
		xfrm['a:chExt'] = { '@_cx': String(extCx), '@_cy': String(extCy) };
	}
	return xfrm;
}

/** A group child's geometry, as {@link applyGroupChildTransform} needs it. */
export interface GroupChildTransformInput {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly xEmu?: number;
	readonly yEmu?: number;
	readonly widthEmu?: number;
	readonly heightEmu?: number;
	/** See `group-child-rotated-resize.ts`: a resized ROTATED child needs its own rotation to preserve its on-screen anchor. */
	readonly rotation?: number;
}

/**
 * Rewrite a child node's offset/extent into the group's coordinate space.
 * Shapes carry it at `p:spPr/a:xfrm`; graphic frames and groups at
 * `p:xfrm` / `p:grpSpPr/a:xfrm`.
 *
 * When `owner` is given (the enclosing group itself; see
 * `group-xfrm-preservation.ts`'s `GroupChildSpaceOwner`), this
 * child's `a:off`/`a:ext` are resolved via `invertChildIntoGroupSpace`:
 * its exact original EMU verbatim when unchanged, otherwise the inverse of
 * the parse-time mapping applied to its CURRENT relative-to-group pixel
 * geometry. Otherwise (`owner` absent, or it has no captured child space)
 * this falls back to the pre-existing `resolveXfrmEmu` per-axis behaviour,
 * which is exactly correct for the normalized `chOff 0,0` / `chExt == ext`
 * space.
 *
 * `precomputed`, when given, is used verbatim INSTEAD of calling
 * `invertChildIntoGroupSpace` here: the caller has already resolved it via
 * `group-tight-rewrap.ts`'s `resolveGroupChildBoxEmu` (needed when this
 * child is itself a group whose own subtree re-wrapped, since that value is
 * NOT what a bare `invertChildIntoGroupSpace(child, owner, ...)` call on
 * this child's own, possibly-stale, relative geometry would produce).
 */
export function applyGroupChildTransform(
	xml: XmlObject,
	child: GroupChildTransformInput,
	emuPerPx: number,
	owner?: GroupChildSpaceOwner,
	precomputed?: GroupChildSpaceResult,
): void {
	const spPr = xml['p:spPr'] as XmlObject | undefined;
	const grpSpPr = xml['p:grpSpPr'] as XmlObject | undefined;
	const childXfrm = (spPr?.['a:xfrm'] ?? xml['p:xfrm'] ?? grpSpPr?.['a:xfrm']) as
		| XmlObject
		| undefined;
	if (!childXfrm) {
		return;
	}
	childXfrm['a:off'] ??= {};
	childXfrm['a:ext'] ??= {};
	const inverted =
		precomputed ?? (owner ? invertChildIntoGroupSpace(child, owner, emuPerPx) : undefined);
	(childXfrm['a:off'] as XmlObject)['@_x'] = String(
		inverted ? inverted.xEmu : resolveXfrmEmu(child.x, child.xEmu, emuPerPx),
	);
	(childXfrm['a:off'] as XmlObject)['@_y'] = String(
		inverted ? inverted.yEmu : resolveXfrmEmu(child.y, child.yEmu, emuPerPx),
	);
	(childXfrm['a:ext'] as XmlObject)['@_cx'] = String(
		inverted ? inverted.widthEmu : resolveXfrmEmu(child.width, child.widthEmu, emuPerPx),
	);
	(childXfrm['a:ext'] as XmlObject)['@_cy'] = String(
		inverted ? inverted.heightEmu : resolveXfrmEmu(child.height, child.heightEmu, emuPerPx),
	);
}
