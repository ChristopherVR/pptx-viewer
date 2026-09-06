/**
 * Ancestor-frame helpers for a chart overlay row addressed by path.
 *
 * A row nested inside a `cdr:grpSp` has its own position/size as `off`/`ext`
 * EMU in its immediate parent's child coordinate space (`a:chOff`/`a:chExt`),
 * meaningless read as bare numbers. This composes the same ratio math core's
 * `flattenChartUserShapes` (`chart-user-shapes-parser.ts`) uses for
 * rendering, but stops at the row's own node instead of only leaves, so ANY
 * row (including a nested `grpSp` group header) can be read/written as a
 * `from`/`to` fraction pair, matching how a top-level `relSizeAnchor` row
 * already edits (`chart-user-shape-tree.ts`'s `ChartUserShapeRow.from`/`to`).
 *
 * The fraction is exactly chart-relative when the row's outermost anchor is
 * a `relSizeAnchor` (its `from`/`to` already span the whole chart, so
 * composing through nested groups yields a further chart-wide fraction).
 * Under an `absSizeAnchor` the fraction is relative to the anchor's own box
 * instead: its `from` is chart-relative but `ext` is a fixed EMU size, so a
 * group child's position within it cannot be re-expressed as a further
 * chart-wide fraction without the chart's live pixel size (the same
 * approximation `flattenChartUserShapes`'s `absGroupOffsetEmu` already makes
 * for rendering).
 *
 * See the sibling `chart-user-shape-group-child.ts` for "insert a new shape
 * into an existing group" (a separate file to stay under the repo's 300-LOC
 * guideline).
 *
 * @module render/chart-user-shape-row-frame
 */
import type {
	PptxChartUserShape,
	PptxChartUserShapeGroupChild,
	PptxChartUserShapeGroupTransform,
} from 'pptx-viewer-core';

import { findChartUserShapeNode } from './chart-user-shape-tree';

/** A 0..1 box relative to some reference frame (an anchor's own box, or a group's own box). */
interface Frac {
	x: number;
	y: number;
	w: number;
	h: number;
}

const IDENTITY_FRAC: Frac = { x: 0, y: 0, w: 1, h: 1 };

function safeDiv(num: number, den: number): number {
	return den !== 0 ? num / den : 0;
}

/** Map a child's own `off`/`ext` (in `chOff`/`chExt` space) into a fraction of the group's own box. */
function childFraction(
	off: { x: number; y: number },
	ext: { cx: number; cy: number },
	chOff: { x: number; y: number },
	chExt: { cx: number; cy: number },
): Frac {
	return {
		x: safeDiv(off.x - chOff.x, chExt.cx),
		y: safeDiv(off.y - chOff.y, chExt.cy),
		w: safeDiv(ext.cx, chExt.cx),
		h: safeDiv(ext.cy, chExt.cy),
	};
}

/** Compose one more ancestor level's fraction into the running total, relative to the outermost anchor box. */
function composeFrac(outer: Frac, inner: Frac): Frac {
	return {
		x: outer.x + inner.x * outer.w,
		y: outer.y + inner.y * outer.h,
		w: inner.w * outer.w,
		h: inner.h * outer.h,
	};
}

/** Everything needed to convert the target row's own `off`/`ext` to/from a fraction. */
interface RowFrame {
	anchor: 'rel' | 'abs';
	anchorFrom: { x: number; y: number };
	anchorTo?: { x: number; y: number };
	/** Composed fraction of the row's own immediate parent group, relative to the outer anchor box. */
	parentFrac: Frac;
	/** The row's immediate parent group's own child coordinate space (fixed; never rewritten by an edit). */
	parentChOff: { x: number; y: number };
	parentChExt: { cx: number; cy: number };
}

/**
 * Walk `path` and resolve the ancestor frame needed to convert the target
 * row's own `off`/`ext` to/from a fraction. `undefined` for a top-level row
 * (`path.length < 2`, no group ancestor to convert through) or a path that
 * does not resolve through a group chain.
 */
function resolveRowFrame(
	userShapes: ReadonlyArray<PptxChartUserShape>,
	path: readonly number[],
): RowFrame | undefined {
	const [topIndex, ...rest] = path;
	if (topIndex === undefined || rest.length === 0) {
		return undefined;
	}
	const top = userShapes[topIndex];
	if (!top || top.kind !== 'grpSp' || !top.transform) {
		return undefined;
	}
	let parentChOff = top.transform.chOff;
	let parentChExt = top.transform.chExt;
	let parentFrac: Frac = IDENTITY_FRAC;
	let children: PptxChartUserShapeGroupChild[] | undefined = top.children;

	// Every path segment EXCEPT the last is an ancestor GROUP the target is
	// nested inside, each contributing one more level of composition.
	for (let i = 0; i < rest.length - 1; i++) {
		const index = rest[i]!;
		const node = children?.[index];
		if (!node || node.kind !== 'grpSp' || !node.transform) {
			return undefined;
		}
		parentFrac = composeFrac(
			parentFrac,
			childFraction(node.off, node.ext, parentChOff, parentChExt),
		);
		parentChOff = node.transform.chOff;
		parentChExt = node.transform.chExt;
		children = node.children;
	}

	return {
		anchor: top.anchor,
		anchorFrom: top.from,
		anchorTo: top.to,
		parentFrac,
		parentChOff,
		parentChExt,
	};
}

/** A nested row's position/size as a fraction pair, ready for the same `from`/`to` editor a top-level `relSizeAnchor` row uses. */
export interface ChartUserShapeRowChartBox {
	anchor: 'rel' | 'abs';
	from: { x: number; y: number };
	to: { x: number; y: number };
}

/**
 * Read a nested row's position/size as a `from`/`to` fraction pair (see this
 * module's doc for what the fraction is relative to). `undefined` for a
 * top-level row (which already carries its own `from`/`to`/`ext` directly,
 * see `ChartUserShapeRow`) or an unresolvable path.
 */
export function getChartUserShapeRowChartBox(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
): ChartUserShapeRowChartBox | undefined {
	if (!userShapes) {
		return undefined;
	}
	const frame = resolveRowFrame(userShapes, path);
	const target = findChartUserShapeNode(userShapes, path);
	if (!frame || !target || !('off' in target) || !('ext' in target)) {
		return undefined;
	}
	const composed = composeFrac(
		frame.parentFrac,
		childFraction(target.off, target.ext, frame.parentChOff, frame.parentChExt),
	);
	if (frame.anchor === 'rel') {
		const anchorTo = frame.anchorTo ?? frame.anchorFrom;
		const width = anchorTo.x - frame.anchorFrom.x;
		const height = anchorTo.y - frame.anchorFrom.y;
		const from = {
			x: frame.anchorFrom.x + composed.x * width,
			y: frame.anchorFrom.y + composed.y * height,
		};
		return {
			anchor: 'rel',
			from,
			to: { x: from.x + composed.w * width, y: from.y + composed.h * height },
		};
	}
	// abs: a fraction of the anchor's OWN box (0..1), not a further chart-wide
	// fraction; see this module's doc.
	return {
		anchor: 'abs',
		from: { x: composed.x, y: composed.y },
		to: { x: composed.x + composed.w, y: composed.y + composed.h },
	};
}

/**
 * Write a nested row's `from`/`to` fraction pair back as EMU `off`/`ext` in
 * its immediate parent's child space, inverting {@link getChartUserShapeRowChartBox}'s
 * composition. Every ancestor group above the target is left untouched (its
 * own `off`/`ext`/`chOff`/`chExt` do not change); when the target itself is a
 * `grpSp`, its `transform.off`/`.ext` are kept in sync with the top-level
 * `off`/`ext` the serializer does not otherwise read (see
 * `chart-user-shapes-serializer.ts`'s `buildGroupNode`, which reads
 * `group.transform`, not the child-level convenience `off`/`ext` fields).
 * Rounds to whole EMU so repeated edits do not accumulate float drift.
 */
export function withChartUserShapeRowChartBoxUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
	box: Pick<ChartUserShapeRowChartBox, 'from' | 'to'>,
): PptxChartUserShape[] {
	const shapes = userShapes ?? [];
	const frame = resolveRowFrame(shapes, path);
	if (!frame) {
		return [...shapes];
	}
	const composed: Frac =
		frame.anchor === 'rel'
			? (() => {
					const anchorTo = frame.anchorTo ?? frame.anchorFrom;
					const width = anchorTo.x - frame.anchorFrom.x;
					const height = anchorTo.y - frame.anchorFrom.y;
					return {
						x: safeDiv(box.from.x - frame.anchorFrom.x, width),
						y: safeDiv(box.from.y - frame.anchorFrom.y, height),
						w: safeDiv(box.to.x - box.from.x, width),
						h: safeDiv(box.to.y - box.from.y, height),
					};
				})()
			: {
					x: box.from.x,
					y: box.from.y,
					w: box.to.x - box.from.x,
					h: box.to.y - box.from.y,
				};

	// Undo the ancestor composition to recover the fraction relative to the
	// row's own immediate parent group; every level above it is untouched.
	const ownFrac: Frac = {
		x: safeDiv(composed.x - frame.parentFrac.x, frame.parentFrac.w),
		y: safeDiv(composed.y - frame.parentFrac.y, frame.parentFrac.h),
		w: safeDiv(composed.w, frame.parentFrac.w),
		h: safeDiv(composed.h, frame.parentFrac.h),
	};
	const off = {
		x: Math.round(frame.parentChOff.x + ownFrac.x * frame.parentChExt.cx),
		y: Math.round(frame.parentChOff.y + ownFrac.y * frame.parentChExt.cy),
	};
	const ext = {
		cx: Math.round(ownFrac.w * frame.parentChExt.cx),
		cy: Math.round(ownFrac.h * frame.parentChExt.cy),
	};

	const applyOffExt = (child: PptxChartUserShapeGroupChild): PptxChartUserShapeGroupChild =>
		child.kind === 'grpSp' && child.transform
			? { ...child, off, ext, transform: { ...child.transform, off, ext } }
			: { ...child, off, ext };

	// `path` always resolves to a group child here (a `RowFrame` only comes
	// back for `path.length >= 2`), so the top level just descends into the
	// addressed group's `children` (typed `PptxChartUserShapeGroupChild[]`)
	// and hands off to `withGroupChildAtPath`, sidestepping `withNodeAtPath`'s
	// single generic type parameter (which cannot express "this callback only
	// ever runs on a group child, never the top-level shape itself").
	const [topIndex, ...rest] = path;
	return shapes.map((shape, i) => {
		if (i !== topIndex || shape.kind !== 'grpSp' || !shape.children) {
			return shape;
		}
		const { rawXml: _staleRawXml, ...withoutRawXml } = shape;
		return { ...withoutRawXml, children: withGroupChildAtPath(shape.children, rest, applyOffExt) };
	});
}

/** Rebuild `children` with `apply` run on the group child at `path`, clearing rawXml on every group ancestor walked along the way. */
function withGroupChildAtPath(
	children: readonly PptxChartUserShapeGroupChild[],
	path: readonly number[],
	apply: (node: PptxChartUserShapeGroupChild) => PptxChartUserShapeGroupChild,
): PptxChartUserShapeGroupChild[] {
	const [head, ...rest] = path;
	return children.map((child, i) => {
		if (i !== head) {
			return child;
		}
		if (rest.length === 0) {
			return apply(child);
		}
		if (child.kind !== 'grpSp' || !child.children) {
			return child;
		}
		const { rawXml: _staleRawXml, ...withoutRawXml } = child;
		return { ...withoutRawXml, children: withGroupChildAtPath(child.children, rest, apply) };
	});
}

/** A group's own `chOff`/`chExt` (its own child coordinate space), for sizing a new child that lands inside it. */
export function getChartUserShapeGroupTransform(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	groupPath: readonly number[],
): PptxChartUserShapeGroupTransform | undefined {
	const node = findChartUserShapeNode(userShapes, groupPath);
	return node && node.kind === 'grpSp' ? node.transform : undefined;
}
