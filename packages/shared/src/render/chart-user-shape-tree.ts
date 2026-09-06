/**
 * Pure editing helpers for the FULL overlay-shape tree, including shapes
 * grouped inside a `cdr:grpSp` (`c:userShapes`).
 *
 * `chart-user-shape-edit.ts` only ever addressed a chart's TOP-LEVEL overlay
 * shapes: a `grpSp` entry showed up in `listChartUserShapeDescriptors` as one
 * non-editable row, and nothing inside it could be reached from an
 * inspector. This module flattens that whole tree (a top-level shape, or a
 * `grpSp` and everything nested inside it, arbitrarily deep) into a flat,
 * indented list of rows so every binding's inspector can show and edit a
 * grouped child exactly like a top-level one, then maps an edit on any row
 * back to the correct core operation:
 *
 * - A top-level row (`path.length === 1`) patches `PptxChartUserShape`
 *   fields directly, same as `withChartUserShapeUpdated`.
 * - A nested row (`path.length > 1`) descends through `.children` the same
 *   way core's path-based `updateChartUserShapeAtPath` SDK op does,
 *   clearing `rawXml` on every `grpSp` ancestor along the way so the
 *   serializer regenerates it instead of masking the edit (see
 *   `chart-user-shape-operations.ts`'s module doc for the same contract on
 *   the core side). These helpers mirror that op rather than importing it
 *   because, like the rest of this file's siblings, they operate directly on
 *   the `userShapes` array so a binding's inspector never has to fabricate a
 *   throwaway `ChartPptxElement`.
 *
 * @module render/chart-user-shape-tree
 */
import type {
	PptxChartUserShape,
	PptxChartUserShapeGroupChild,
	PptxChartUserShapeParagraph,
} from 'pptx-viewer-core';

/** Either a top-level overlay shape or a shape grouped inside one. */
export type ChartUserShapeNode = PptxChartUserShape | PptxChartUserShapeGroupChild;

/**
 * A flattened, indented row for one node in the overlay-shape tree (a
 * top-level shape, a `grpSp` group header, or a shape nested inside one).
 */
export interface ChartUserShapeRow {
	/** `[topIndex]` for a top-level shape, `[topIndex, childIndex, ...]` for a nested one. */
	path: number[];
	/** Nesting depth for indentation; `0` for a top-level shape. */
	depth: number;
	kind: PptxChartUserShape['kind'];
	/** True for a `grpSp` row: a group header with no visual/position editing of its own, only its children below it. */
	isGroup: boolean;
	/** Present on a top-level row only: its own drawing-anchor kind. */
	anchor?: 'rel' | 'abs';
	/** Top-level `relSizeAnchor` corner, or a top-level `absSizeAnchor`'s corner (fractions of the chart). */
	from?: { x: number; y: number };
	/** Top-level `relSizeAnchor`'s opposite corner (fraction of the chart). */
	to?: { x: number; y: number };
	/** Size in EMU: a top-level `absSizeAnchor`'s extent, or any row's own size when nested. */
	ext?: { cx: number; cy: number };
	/** Present on a nested row only: its position within the parent group's child coordinate space, in EMU. */
	off?: { x: number; y: number };
	/**
	 * This row's OWN rotation in degrees, when set: a `grpSp` row's own
	 * `transform.rotation` (rotates the whole group as a rigid body), or a
	 * leaf's own `rotation`. See {@link withChartUserShapeRowRotationUpdated}
	 * for the matching write side.
	 */
	rotation?: number;
	/**
	 * This row's OWN horizontal flip, when set: a `grpSp` row's own
	 * `transform.flipH`, or a leaf's own `flipH`. See
	 * {@link withChartUserShapeRowFlipUpdated} for the matching write side.
	 */
	flipH?: boolean;
	/** Same as {@link flipH}, mirrored vertically. */
	flipV?: boolean;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	/** Joined paragraph text, for a compact row label. */
	text?: string;
	/** A `pic` row's alt text, when present. */
	altText?: string;
	/** Whether text/fill/line controls apply (`sp`/`cxnSp`, top-level or nested). */
	editableVisuals: boolean;
	/**
	 * Whether position/size controls apply. True for every row, including a
	 * `grpSp` group header: a top-level group's own drawing anchor
	 * (`from`/`to`/`ext`) already moves/resizes the whole group with its
	 * children following (the group's own `a:xfrm` off/ext is not consulted
	 * by rendering at all, see `flattenChartUserShapes`, so the anchor IS the
	 * group's effective container transform); a nested group's own `off`/
	 * `ext` (its `a:xfrm` within the parent's child space, see {@link off}) is
	 * the container transform, edited via `chart-user-shape-row-frame.ts`'s
	 * chart-relative fraction helpers exactly like any other nested row.
	 */
	editablePosition: boolean;
	/** Whether alt text applies (`pic` only). */
	editableAltText: boolean;
}

/** Joined, non-empty paragraph text for a row's compact label. */
function rowText(paragraphs: PptxChartUserShapeParagraph[] | undefined): string | undefined {
	const text = paragraphs
		?.map((p) => p.text)
		.filter((t) => t.length > 0)
		.join(' ');
	return text && text.length > 0 ? text : undefined;
}

/** Push one non-group node's row, then recurse when it is (or contains) a group. */
function pushRows(
	node: ChartUserShapeNode,
	path: number[],
	depth: number,
	out: ChartUserShapeRow[],
): void {
	const isTop = depth === 0;
	const top = isTop ? (node as PptxChartUserShape) : undefined;
	const child = isTop ? undefined : (node as PptxChartUserShapeGroupChild);

	out.push({
		path,
		depth,
		kind: node.kind,
		isGroup: node.kind === 'grpSp',
		...(top ? { anchor: top.anchor, from: top.from, to: top.to } : {}),
		...(child ? { off: child.off } : {}),
		rotation: node.kind === 'grpSp' ? node.transform?.rotation : node.rotation,
		flipH: node.kind === 'grpSp' ? node.transform?.flipH : node.flipH,
		flipV: node.kind === 'grpSp' ? node.transform?.flipV : node.flipV,
		ext: node.ext,
		fill: node.fill,
		stroke: node.stroke,
		strokeWidth: node.strokeWidth,
		...(rowText(node.paragraphs) ? { text: rowText(node.paragraphs) } : {}),
		...(node.altText ? { altText: node.altText } : {}),
		editableVisuals: node.kind === 'sp' || node.kind === 'cxnSp',
		editablePosition: true,
		editableAltText: node.kind === 'pic',
	});

	if (node.kind === 'grpSp' && node.children) {
		node.children.forEach((grandchild, i) => {
			pushRows(grandchild, [...path, i], depth + 1, out);
		});
	}
}

/**
 * Flatten a chart's overlay shapes, and everything grouped inside them, into
 * an indented row list ready for an inspector tree view.
 */
export function listChartUserShapeRows(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
): ChartUserShapeRow[] {
	const out: ChartUserShapeRow[] = [];
	(userShapes ?? []).forEach((shape, i) => {
		pushRows(shape, [i], 0, out);
	});
	return out;
}

/** Fields a row's editor may patch; applied to whichever node type its path resolves to. */
export type ChartUserShapeRowPatch = Partial<PptxChartUserShape> &
	Partial<PptxChartUserShapeGroupChild>;

/**
 * Rebuild `nodes` with `apply` run on the node at `path`, returning a new
 * array (untouched siblings are structurally shared). `apply` returning
 * `undefined` removes the node. Mirrors core's
 * `chart-user-shape-operations.ts` `withNodeAtPath`: every `grpSp` ancestor
 * walked along the way has its own `rawXml` cleared, since a stale cached
 * verbatim group would otherwise re-emit unchanged and mask the edit.
 */
export function withNodeAtPath<T extends ChartUserShapeNode>(
	nodes: readonly T[],
	path: readonly number[],
	apply: (node: T) => T | undefined,
): T[] {
	const [head, ...rest] = path;
	if (head === undefined || head < 0 || head >= nodes.length) {
		return [...nodes];
	}
	const result: T[] = [];
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i]!;
		if (i !== head) {
			result.push(node);
			continue;
		}
		if (rest.length === 0) {
			const applied = apply(node);
			if (applied !== undefined) {
				result.push(applied);
			}
			continue;
		}
		if (node.kind !== 'grpSp' || !node.children) {
			result.push(node);
			continue;
		}
		const newChildren = withNodeAtPath(
			node.children,
			rest,
			apply as (n: PptxChartUserShapeGroupChild) => PptxChartUserShapeGroupChild | undefined,
		);
		const { rawXml: _staleRawXml, ...withoutRawXml } = node;
		result.push({ ...withoutRawXml, children: newChildren } as T);
	}
	return result;
}

/**
 * Resolve the node at `path` without modifying anything, for reads (e.g.
 * `chart-user-shape-row-frame.ts`'s fraction conversion and group-child
 * insertion need to inspect a group's own `transform` before writing to it).
 */
export function findChartUserShapeNode(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
): ChartUserShapeNode | undefined {
	const [head, ...rest] = path;
	if (head === undefined || !userShapes) {
		return undefined;
	}
	let node: ChartUserShapeNode | undefined = userShapes[head];
	for (const index of rest) {
		if (!node || node.kind !== 'grpSp' || !node.children) {
			return undefined;
		}
		node = node.children[index];
	}
	return node;
}

/**
 * Patch one row (top-level or nested arbitrarily deep in groups) by path,
 * returning a fresh `userShapes` array for `onUpdateChartData`.
 */
export function withChartUserShapeRowUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
	patch: ChartUserShapeRowPatch,
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], path, (node) => ({ ...node, ...patch }));
}

/** Remove one row (top-level or nested) by path. */
export function withChartUserShapeRowRemoved(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], path, () => undefined);
}

/**
 * Patch a row's first paragraph's text, creating a single default paragraph
 * when it has none yet (matching `createDefaultChartUserShape`'s one-line
 * text box). Existing paragraph formatting (align/bold/etc.) is preserved;
 * any paragraphs after the first are left as-is.
 */
export function withChartUserShapeRowTextUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
	text: string,
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], path, (node) => {
		const paragraphs = node.paragraphs ?? [];
		const [first, ...rest] = paragraphs;
		const nextFirst: PptxChartUserShapeParagraph = { ...(first ?? {}), text };
		return { ...node, paragraphs: [nextFirst, ...rest] };
	});
}
