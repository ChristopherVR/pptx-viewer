/**
 * Cross-node font-size resolution for the per-point layout engine.
 *
 * ECMA-376 Part 1, 21.4.2.x: `<dgm:constr type="primFontSz" ... op="equ"/>`
 * makes every addressed node share ONE size, and PowerPoint picks the size
 * the worst-fitting member can still fit at (every cached gallery drawing
 * renders an `equ` group at a single whole point, however short a member's
 * own text is). `op="lte"` with a `refType="primFontSz"` reference caps a
 * node at another node's final size (times `fact`), and `op="equ"` with such
 * a reference joins the two into one group.
 *
 * Each text node first gets its own best fit (`text-fit.ts`), then groups
 * collapse to their minimum and references cap their dependants, repeating
 * until nothing changes (every step only ever lowers a size, so this
 * terminates). A margin that references ANOTHER node's font size ("Gear"'s
 * child box: `lMarg` = 0.3 x the gear's own `primFontSz`) is fitted against
 * that node's size from the previous round, so the whole resolution runs
 * again until the sizes it reads are the sizes it produced.
 */

import type { EngineNode } from './engine-node';
import type { NodeText, TextMetrics } from './text-fit';
import { fitNodeFontPt, nodeFontBounds } from './text-fit';

/** One rendered, text-bearing node awaiting its size. */
export interface FontFitEntry {
	node: EngineNode;
	text: NodeText;
}

class UnionFind {
	private readonly parent = new Map<EngineNode, EngineNode>();

	find(node: EngineNode): EngineNode {
		let root = node;
		while (this.parent.has(root) && this.parent.get(root) !== root) {
			root = this.parent.get(root) as EngineNode;
		}
		return root;
	}

	union(a: EngineNode, b: EngineNode): void {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) {
			this.parent.set(ra, rb);
		}
	}
}

interface Cap {
	target: EngineNode;
	ref: EngineNode;
	fact: number;
}

function allNodes(entries: readonly FontFitEntry[]): EngineNode[] {
	const roots = new Set<EngineNode>();
	for (const { node } of entries) {
		let top = node;
		while (top.parent) {
			top = top.parent;
		}
		roots.add(top);
	}
	const out: EngineNode[] = [];
	const visit = (n: EngineNode): void => {
		out.push(n);
		n.children.forEach(visit);
	};
	roots.forEach(visit);
	return out;
}

function buildLinks(entries: readonly FontFitEntry[]): { groups: UnionFind; caps: Cap[] } {
	const groups = new UnionFind();
	const caps: Cap[] = [];
	for (const node of allNodes(entries)) {
		for (const group of node.groups) {
			if (group.type !== 'primFontSz') {
				continue;
			}
			for (let i = 1; i < group.members.length; i++) {
				groups.union(group.members[0], group.members[i]);
			}
		}
		for (const d of node.deferred) {
			if (
				d.type === 'primFontSz' &&
				d.refType === 'primFontSz' &&
				d.op !== 'gte' &&
				d.ref !== node
			) {
				caps.push({ target: node, ref: d.ref, fact: d.fact });
			}
		}
	}
	// Same layout node, same size: across the gallery corpus's cached
	// drawings, 510 of 514 (fixture, presName) groups with text render every
	// shape at ONE size even where the layout declares no `op="equ"` for them
	// ("Organization Chart"'s `rootText` boxes all share 33pt although each
	// only declares its own `primFontSz val="65"`). The 4 exceptions are
	// timeline/dot-list label containers whose members sit in different
	// equality groups.
	const firstByName = new Map<string, EngineNode>();
	for (const { node } of entries) {
		const first = firstByName.get(node.name);
		if (first) {
			groups.union(first, node);
		} else {
			firstByName.set(node.name, node);
		}
	}
	return { groups, caps };
}

function equalise(
	sizes: Map<EngineNode, number>,
	starts: Map<EngineNode, number>,
	groups: UnionFind,
	caps: readonly Cap[],
): void {
	for (let pass = 0; pass < 8; pass++) {
		let changed = false;
		const groupMin = new Map<EngineNode, number>();
		for (const [node, size] of sizes) {
			const root = groups.find(node);
			groupMin.set(root, Math.min(groupMin.get(root) ?? Infinity, size));
		}
		for (const [node, size] of sizes) {
			const min = groupMin.get(groups.find(node)) ?? size;
			if (min < size) {
				sizes.set(node, min);
				changed = true;
			}
		}
		for (const cap of caps) {
			const current = sizes.get(cap.target);
			const refSize = sizes.get(cap.ref);
			if (current === undefined || refSize === undefined) {
				continue;
			}
			// Only a reference that actually shrank propagates: "Vertical
			// Action List"'s `descendantText` keeps its own 24pt although it
			// declares `lte 0.82 x parentText` and `parentText` stays at 28pt.
			if (refSize >= (starts.get(cap.ref) ?? Infinity)) {
				continue;
			}
			const limit = Math.max(1, Math.round(refSize * cap.fact));
			if (limit < current) {
				sizes.set(cap.target, limit);
				changed = true;
			}
		}
		if (!changed) {
			return;
		}
	}
}

/**
 * Resolve every entry's primary font size in whole POINTS. Nodes that are
 * not in `entries` (no text) still take part in equality groups only as
 * bridges; they never lower anyone's size themselves.
 */
export function resolveEngineFonts(
	entries: readonly FontFitEntry[],
	metrics: TextMetrics,
): Map<EngineNode, number> {
	const { groups, caps } = buildLinks(entries);
	const starts = new Map<EngineNode, number>();
	for (const entry of entries) {
		starts.set(entry.node, nodeFontBounds(entry.node).start);
	}
	let resolved = new Map<EngineNode, number>();
	for (let round = 0; round < 4; round++) {
		const previous = resolved;
		const refSize = (ref: EngineNode): number | undefined => previous.get(ref) ?? starts.get(ref);
		const sizes = new Map<EngineNode, number>();
		for (const entry of entries) {
			const bounds = nodeFontBounds(entry.node);
			sizes.set(entry.node, fitNodeFontPt(entry.node, entry.text, bounds, metrics, refSize));
		}
		equalise(sizes, starts, groups, caps);
		resolved = sizes;
		if ([...sizes].every(([node, size]) => previous.get(node) === size)) {
			break;
		}
	}
	return resolved;
}
