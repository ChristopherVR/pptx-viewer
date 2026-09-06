/**
 * SmartArt DiagramML interpreter - "hierChild group" wrap-into-row-or-column
 * decision, used by `placeWrappedChildren` in `smartart-hierarchy-standard.ts`
 * when a generation's ordinary children exceed the resolved `chPref`/`chMax`
 * row size.
 *
 * Closes the residual documented (until now) in `docs/guide/limitations.md`'s
 * "SmartArt layout" row: a manager row that is NOT exactly `chPref` wide (2,
 * 4 or 5 siblings, one or two of which separately have `chPref` reports of
 * their own). Measured against the genuine, COM-authored
 * `smartart-orgchart-fan-variants.pptx` corpus fixture (11 slides: row widths
 * 2/4/5, the chPref-reaching manager at every position - first/middle/last -
 * plus two-manager variants at width 2 and 4).
 *
 * The root cause is NOT a rendering-time "fan" decision at all: it is that
 * PowerPoint's own org-chart data model does not attach a manager's reports
 * to the manager once its own "hierChild group" wrapper still has room.
 * `SmartArtNode.AddNode()` fills the CURRENT wrapper (capacity `chPref`,
 * matching `flattenOrgChartGroupWrappers`'s doc comment) regardless of which
 * node's `.Nodes` collection the call targets, so a manager only keeps its
 * own DIRECT child once its wrapper is full; earlier "reports" are spliced in
 * as the manager's own ROW SIBLINGS instead. `flattenOrgChartGroupWrappers`
 * already reconstructs this (each wrapper's members become flat siblings of
 * the wrapper's own parent), so by the time `placeWrappedChildren` sees the
 * flat list, wrapper boundaries have already been reconstructible: because a
 * wrapper always fills to `chPref` before the next one starts (this is simply
 * how repeated `.Nodes.Add()` calls behave), re-chunking the FLAT list
 * sequentially into `chPref`-sized groups (exactly what `placeWrappedChildren`
 * already does for its column grouping) reproduces the ORIGINAL wrapper
 * boundaries exactly. Verified against all 11 fixture slides.
 *
 * What was missing is the PER-GROUP row-vs-column choice. Measured: when a
 * group's members are all leaves (no ordinary children of their own) -
 * `smartart-orgchart-many.pptx`'s shape - PowerPoint compacts the group into
 * one hanging COLUMN (already modelled). But when ANY member of a group has
 * its own ordinary children (needs vertical room below it), PowerPoint fans
 * the WHOLE group inline across the shared ROW instead, contiguous with
 * neighbouring groups - never partially, and never per-member: a group with
 * one "heavy" member and two plain leaves still fans all three. Confirmed
 * across every combination in the fixture (manager first/middle/last within
 * its own group, two managers in the same row, groups of size 1/2/3).
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { TreeNode } from './smartart-helpers';
import type { PlaceAtFn } from './smartart-hierarchy-fan';
import { effectiveWidth, elbowConnector, partitionChildren } from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';

/** One `chPref`-sized (or smaller, if trailing) chunk of a wrapped generation. */
export interface WrappedGroup {
	readonly members: readonly TreeNode[];
	/**
	 * True when at least one member has its own ordinary children: the whole
	 * group fans inline across the shared row instead of compacting into a
	 * hanging column. See the module doc comment.
	 */
	readonly fansAsRow: boolean;
}

/**
 * Chunk `children` sequentially into `perColumn`-sized groups (the last may
 * be smaller) and classify each as a row-fan or a leaf-only column.
 */
export function planWrappedGroups(
	children: readonly TreeNode[],
	perColumn: number,
	orgChart: boolean,
): WrappedGroup[] {
	const groups: WrappedGroup[] = [];
	for (let i = 0; i < children.length; i += perColumn) {
		const members = children.slice(i, i + perColumn);
		const fansAsRow = members.some((m) => partitionChildren(m, orgChart).normal.length > 0);
		groups.push({ members, fansAsRow });
	}
	return groups;
}

/**
 * How many shared-row column units this group's plan consumes: every
 * member's own `effectiveWidth` for a row-fan group (each gets its own
 * column, same as an ordinary flat child), or exactly one shared unit for a
 * leaf-only column (its extra members stack below that one unit, they never
 * widen the row).
 */
export function wrappedGroupSlotCount(group: WrappedGroup, orgChart: boolean): number {
	if (!group.fansAsRow) {
		return 1;
	}
	return group.members.reduce((sum, m) => sum + effectiveWidth(m, orgChart), 0);
}

/** The options shape `placeWrappedChildren` needs from its caller's own options object. */
export interface WrappedChildrenOptions {
	orgChart: boolean;
	/** Resolved `chPref`/`chMax` row size; must be finite when this is called. */
	perRow: number;
}

/**
 * Place one generation's ordinary children (already known to exceed
 * `options.perRow`) as `chPref`-sized GROUPS, side by side, in the shared row.
 * Each group is either fanned inline as ordinary row members (at least one
 * member has its own ordinary children) or compacted into one hanging COLUMN
 * (all its members are leaves) - see the module doc comment for the
 * measurement. `placeAtFn` is injected (rather than imported) to avoid a
 * value-level import cycle with `smartart-hierarchy-standard.ts`, which is
 * this function's only caller and owns `placeAt`.
 *
 * A wrapped child's own descendants still resolve onto the normal per-level
 * grid: the virtual `xOffset` handed to its own recursion is solved so
 * `(xOffset + childW / 2) * cellW` reproduces the position already used here,
 * keeping `cellW`/`cellH` uniform for every generation past this one.
 */
export function placeWrappedChildren<TOptions extends WrappedChildrenOptions>(
	hc: HierContext,
	parentId: string,
	normal: TreeNode[],
	cx: number,
	cy: number,
	xOffset: number,
	spanW: number,
	level: number,
	cellW: number,
	cellH: number,
	options: TOptions,
	placeAtFn: PlaceAtFn<TOptions>,
): void {
	const groups = planWrappedGroups(normal, options.perRow, options.orgChart);
	const totalSlots = groups.reduce((sum, g) => sum + wrappedGroupSlotCount(g, options.orgChart), 0);
	const totalW = spanW * cellW;
	const leftX = xOffset * cellW;
	const unitW = totalW / Math.max(1, totalSlots);
	const rowCy = (level + 1) * cellH + cellH / 2;

	let slot = 0;
	for (const group of groups) {
		slot = group.fansAsRow
			? placeRowFanGroup(
					hc,
					parentId,
					group,
					cx,
					cy,
					leftX,
					unitW,
					slot,
					rowCy,
					level,
					cellW,
					cellH,
					options,
					placeAtFn,
				)
			: placeColumnGroup(
					hc,
					parentId,
					group,
					cx,
					cy,
					leftX,
					unitW,
					slot,
					rowCy,
					cellW,
					cellH,
					level,
					options,
					placeAtFn,
				);
	}
}

/** Fan every member of a row-fan `group` inline, each its own shared-row column. */
function placeRowFanGroup<TOptions extends WrappedChildrenOptions>(
	hc: HierContext,
	parentId: string,
	group: WrappedGroup,
	cx: number,
	cy: number,
	leftX: number,
	unitW: number,
	slot: number,
	rowCy: number,
	level: number,
	cellW: number,
	cellH: number,
	options: TOptions,
	placeAtFn: PlaceAtFn<TOptions>,
): number {
	let cursor = slot;
	for (const child of group.members) {
		const childW = effectiveWidth(child, options.orgChart);
		const childCx = leftX + unitW * (cursor + childW / 2);
		elbowConnector(hc, parentId, cx, cy + hc.boxH / 2, childCx, rowCy - hc.boxH / 2, child.node.id);
		const virtualOffset = childCx / cellW - childW / 2;
		placeAtFn(hc, child, childCx, rowCy, virtualOffset, childW, level + 1, cellW, cellH, options);
		cursor += childW;
	}
	return cursor;
}

/**
 * Place a leaf-only `group`'s first member in its shared-row column slot (the
 * same y as an ordinary row item), then chain the rest directly below it,
 * spaced by `cellH / group.length` - the pre-existing
 * `smartart-orgchart-many.pptx` column behaviour, now scoped to one shared row
 * slot instead of one `perColumn`-worth of width, and anchored to the row's
 * own y (rather than the generation band's start) so the first member's
 * position never collides with a later member's compressed slot.
 */
function placeColumnGroup<TOptions extends WrappedChildrenOptions>(
	hc: HierContext,
	parentId: string,
	group: WrappedGroup,
	cx: number,
	cy: number,
	leftX: number,
	unitW: number,
	slot: number,
	rowCy: number,
	cellW: number,
	cellH: number,
	level: number,
	options: TOptions,
	placeAtFn: PlaceAtFn<TOptions>,
): number {
	const groupCx = leftX + unitW * (slot + 0.5);
	const subRowH = cellH / group.members.length;
	let fromId = parentId;
	let fromX = cx;
	let fromY = cy + hc.boxH / 2;
	for (let i = 0; i < group.members.length; i++) {
		const child = group.members[i];
		const childCy = rowCy + subRowH * i;
		elbowConnector(hc, fromId, fromX, fromY, groupCx, childCy - hc.boxH / 2, child.node.id);
		const childW = effectiveWidth(child, options.orgChart);
		const virtualOffset = groupCx / cellW - childW / 2;
		placeAtFn(hc, child, groupCx, childCy, virtualOffset, childW, level + 1, cellW, cellH, options);
		fromId = child.node.id;
		fromX = groupCx;
		fromY = childCy + hc.boxH / 2;
	}
	return slot + 1;
}
