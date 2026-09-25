/**
 * Natural-size measurement for the `hierRoot`/`hierChild` pair (ECMA-376
 * Part 1, 21.4.2.6/21.4.2.7), bottom-up, in the layout definition's own
 * unscaled space: every item takes the `w`/`h` its composite was assigned by
 * the outermost `hierChild`'s constraints (typically `w` = the whole frame's
 * width, `h` a fixed fraction of it), `sibSp` separates siblings and `sp`
 * separates a node from the rows it heads. Subtrees are outlines
 * (`hier-shape.ts`) packed against each other; `alg-hier.ts` then scales the
 * whole tree once, uniformly, to fit the frame.
 *
 * Measured against the gallery's cached "Hierarchy" drawing: composite
 * `w = W`, `h = 0.667 W`, `sibSp = 0.1 W`, `sp = 0.25 h`; three generations
 * stacked `3 h + 2 sp` exactly fill the 400pt frame, and the top node sits
 * centred over its children's row.
 */

import type { Box, EngineNode } from './engine-node';
import { isAssistantRow, isTwoColumnRow, placeTwoColumns } from './hier-assistants';
import { HANG_OFFSET_RATIO, isColumn } from './hier-hang';
import { nodeSize } from './hier-node-size';
import type { HierShape, OutlineRect } from './hier-shape';
import { boundsOf, packOffset, shiftShape } from './hier-shape';

/** `node`'s own direct `hierRoot`-alg children (its items), in order. */
export function itemsOf(node: EngineNode): EngineNode[] {
	return node.children.filter((child) => child.alg.type === 'hierRoot');
}

/** `root`'s `hierChild`-alg children that actually carry items. */
function rowsOf(root: EngineNode): EngineNode[] {
	return root.children.filter(
		(child) => child.alg.type === 'hierChild' && itemsOf(child).length > 0,
	);
}

/** The node's own content parts: everything that is not a nested row or a connector. */
function partsOf(root: EngineNode): EngineNode[] {
	return root.children.filter(
		(child) => child.alg.type !== 'hierChild' && child.alg.type !== 'conn',
	);
}

/** Pack `shapes` one after another along an axis, `gap` apart by outline. */
function pack(shapes: HierShape[], vertical: boolean, gap: number, end: boolean): HierShape {
	const rects: OutlineRect[] = [];
	const heads: Box[] = [];
	const across = (s: HierShape): number => (vertical ? boundsOf(s.rects).w : boundsOf(s.rects).h);
	const thickness = Math.max(0, ...shapes.map(across));
	for (const shape of shapes) {
		const bounds = boundsOf(shape.rects);
		// Align across the axis: start (top/left) by default, end for chAlign b/r.
		const crossShift = end ? thickness - across(shape) : 0;
		let placed = vertical
			? shiftShape(shape, crossShift - bounds.x, 0)
			: shiftShape(shape, 0, crossShift - bounds.y);
		if (rects.length > 0 && vertical) {
			// A column stacks whole subtrees: "Left Hanging"'s next report
			// drops below the previous one's deepest child even where it would
			// tuck under a shallower one (`smartart-orgchart-hierbranch.pptx`).
			const above = boundsOf(rects);
			placed = shiftShape(placed, 0, above.y + above.h + gap - boundsOf(placed.rects).y);
		} else if (rects.length > 0) {
			let offset = packOffset(rects, placed.rects, gap, vertical);
			if (offset === -Infinity) {
				const prev = heads[heads.length - 1];
				offset = vertical
					? prev.y + prev.h + gap - placed.head.y
					: prev.x + prev.w + gap - placed.head.x;
			}
			placed = vertical ? shiftShape(placed, 0, offset) : shiftShape(placed, offset, 0);
		}
		rects.push(...placed.rects);
		heads.push(placed.head);
	}
	return { rects, head: boundsOf(heads) };
}

/**
 * Measure a `hierChild` row: its items along `linDir` (`fromL`/`fromR` a
 * horizontal row, `fromT`/`fromB` a vertical column), packed `sibSp` apart
 * by outline, aligned across by `chAlign` (`t`/`l` start, `b`/`r` end).
 */
export function measureHierChild(node: EngineNode): HierShape {
	const linDir = node.alg.params.linDir ?? 'fromL';
	const vertical = linDir === 'fromT' || linDir === 'fromB';
	const reversed = linDir === 'fromR' || linDir === 'fromB';
	const items = itemsOf(node).map(measureHierRoot);
	const ordered = reversed ? [...items].reverse() : items;
	const chAlign = node.alg.params.chAlign ?? '';
	const gap = Math.max(0, node.values.get('sibSp') ?? 0);
	return pack(ordered, vertical, gap, chAlign === 'b' || chAlign === 'r');
}

/** Where `hierAlign` puts the node: which side of its rows, and how it aligns along that side. */
function parseHierAlign(value: string | undefined): { side: string; align: string } {
	const hierAlign = value ?? 'tCtrCh';
	const side = hierAlign.charAt(0);
	const rest = hierAlign.slice(1);
	const align = rest.startsWith('Ctr') ? 'center' : rest === 'L' || rest === 'T' ? 'start' : 'end';
	return { side, align };
}

/** Shift along the alignment axis that lines the rows' heads up with the node per `align`. */
function alignShift(node: Box, heads: Box, align: string, vertical: boolean): number {
	const [n0, nLen, g0, gLen] = vertical
		? [node.x, node.w, heads.x, heads.w]
		: [node.y, node.h, heads.y, heads.h];
	if (align === 'start') {
		return n0 - g0;
	}
	if (align === 'end') {
		return n0 + nLen - (g0 + gLen);
	}
	return n0 + nLen / 2 - (g0 + gLen / 2);
}

/**
 * How far a hanging column sits in from the node's aligned edge, as a
 * fraction of its width: the node's own `alignOff` (the org charts declare
 * 0.25, or 0.65 once the node has an assistant), else 0.25.
 */
function hangInset(root: EngineNode): number {
	// Measured before the node evaluates its own constraints, so read the
	// declaration itself.
	const own = root.constraints.find(
		(c) => c.type === 'alignOff' && c.for === 'self' && c.refType === 'none' && c.hasVal,
	);
	const declared = own?.val ?? root.values.get('alignOff');
	return declared !== undefined && declared > 0 ? declared : HANG_OFFSET_RATIO;
}

/**
 * Measure a `hierRoot`: its own node and, on the side `hierAlign` names,
 * its rows (stacked `sp` apart), the node aligned against the rows' own
 * nodes (`CtrCh`/`CtrDes` centred, `L`/`T` start, `R`/`B` end). A `tL`/`tR`
 * node over vertical columns hangs them instead (`hier-hang.ts`).
 */
export function measureHierRoot(root: EngineNode): HierShape {
	const parts = partsOf(root);
	const size = nodeSize(parts);
	const head: Box = { x: 0, y: 0, w: size.w, h: size.h };
	const own: OutlineRect[] = parts.map((part) => ({
		node: part,
		x: size.dx,
		y: size.dy,
		w: size.partW,
		h: size.partH,
	}));
	const rowNodes = rowsOf(root);
	if (rowNodes.length === 0) {
		return { rects: own, head };
	}
	const sp = Math.max(0, root.values.get('sp') ?? 0);
	const { side, align } = parseHierAlign(root.alg.params.hierAlign);
	const vertical = side === 't' || side === 'b';
	const assistantRows =
		side === 't' ? rowNodes.filter((row) => isAssistantRow(row, itemsOf(row))) : [];
	const rows = rowNodes.filter((row) => !assistantRows.includes(row));
	let top = size.h + sp;
	const centre = size.dx + size.partW / 2;
	const assistants: OutlineRect[] = [];
	if (assistantRows.length > 0) {
		const band = placeTwoColumns(
			assistantRows.flatMap((row) => itemsOf(row).map(measureHierRoot)),
			centre,
			top,
			Math.max(0, assistantRows[0].values.get('sibSp') ?? 0),
			sp,
		);
		assistants.push(...band.rects);
		top = band.bottom + sp;
	}
	if (rows.length === 0) {
		return { rects: [...own, ...assistants], head };
	}
	if (side === 't' && rows.every(isTwoColumnRow)) {
		const hung = placeTwoColumns(
			rows.flatMap((row) => itemsOf(row).map(measureHierRoot)),
			centre,
			top,
			Math.max(0, rows[0].values.get('sibSp') ?? 0),
			sp,
		);
		return { rects: [...own, ...assistants, ...hung.rects], head };
	}
	const group = pack(rows.map(measureHierChild), vertical, sp, false);
	const groupBounds = boundsOf(group.rects);
	let placed: HierShape;
	if (vertical) {
		const dy = side === 't' ? top - groupBounds.y : -sp - (groupBounds.y + groupBounds.h);
		let dx = alignShift(head, group.head, align, true);
		if (side === 't' && align !== 'center' && rows.every(isColumn)) {
			const inset = hangInset(root) * size.w;
			dx =
				align === 'start'
					? head.x + inset - group.head.x
					: head.x + head.w - inset - (group.head.x + group.head.w);
		}
		placed = shiftShape(group, dx, dy);
	} else {
		const dx = side === 'l' ? size.w + sp - groupBounds.x : -sp - (groupBounds.x + groupBounds.w);
		placed = shiftShape(group, dx, alignShift(head, group.head, align, false));
	}
	return { rects: [...own, ...assistants, ...placed.rects], head };
}
