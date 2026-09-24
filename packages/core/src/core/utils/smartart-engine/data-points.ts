/**
 * The semantic data model the SmartArt layout engine walks: the `doc` point,
 * every content point (`node`/`asst`), and the `parTrans`/`sibTrans`
 * transition points of each parent-child connection, arranged as the tree the
 * DiagramML axes (ECMA-376 Part 1, 21.4.7.6 ST_AxisType) navigate.
 *
 * Under a parent, each child connection contributes three points in this
 * order: its `parTrans`, the child content point, then its `sibTrans`. That
 * ordering is what makes `precedSib ptType="parTrans"` and `followSib
 * ptType="sibTrans" cnt="1"` resolve to the transitions around a node, and it
 * is how PowerPoint's built-in layouts address connectors and arrows.
 *
 * Presentation (`pres`) points in the data part are deliberately ignored:
 * they are PowerPoint's own cached output, and a diagram from another
 * producer does not have them.
 */

import type { PptxSmartArtConnection, PptxSmartArtNode } from '../../types';

export type PointType = 'doc' | 'node' | 'asst' | 'parTrans' | 'sibTrans';

export interface DataPoint {
	id: string;
	type: PointType;
	/** Content point for `node`/`asst`; undefined for doc and transitions. */
	source?: PptxSmartArtNode;
	/** Connector text for a transition point. */
	label?: string;
	parent?: DataPoint;
	/** Ordered children: parTrans, node, sibTrans per child connection. */
	children: DataPoint[];
}

export interface DataModel {
	doc: DataPoint;
	byId: Map<string, DataPoint>;
}

function collectNodes(
	nodes: PptxSmartArtNode[],
	parentId: string | undefined,
	out: { node: PptxSmartArtNode; parentId?: string }[],
): void {
	for (const node of nodes) {
		out.push({ node, parentId: node.parentId ?? parentId });
		if (node.children?.length) {
			collectNodes(node.children, node.id, out);
		}
	}
}

function isContentType(nodeType: string | undefined): boolean {
	return (
		nodeType === undefined ||
		nodeType === 'node' ||
		nodeType === 'asst' ||
		nodeType === 'norm' ||
		nodeType === ''
	);
}

/**
 * Build the engine's data tree from the loader's node list and connections.
 * Child order follows each parent connection's `srcOrd` (falling back to
 * node-list order); transitions missing from the connection list are
 * synthesised so every child still has its `parTrans`/`sibTrans` pair.
 */
export function buildDataModel(
	nodes: PptxSmartArtNode[],
	connections: PptxSmartArtConnection[] | undefined,
): DataModel {
	const flat: { node: PptxSmartArtNode; parentId?: string }[] = [];
	collectNodes(nodes, undefined, flat);
	const content = flat.filter((entry) => isContentType(entry.node.nodeType));
	const contentIds = new Set(content.map((entry) => entry.node.id));
	const docId =
		content.find((entry) => entry.parentId && !contentIds.has(entry.parentId))?.parentId ??
		'__doc__';
	const doc: DataPoint = { id: docId, type: 'doc', children: [] };
	const byId = new Map<string, DataPoint>([[docId, doc]]);
	const cxnByChild = new Map<string, PptxSmartArtConnection>();
	for (const cxn of connections ?? []) {
		if ((cxn.type === undefined || cxn.type === 'parOf') && contentIds.has(cxn.destId)) {
			cxnByChild.set(cxn.destId, cxn);
		}
	}
	for (const { node } of content) {
		byId.set(node.id, {
			id: node.id,
			type: node.nodeType === 'asst' ? 'asst' : 'node',
			source: node,
			children: [],
		});
	}
	const grouped = new Map<string, { point: DataPoint; order: number; index: number }[]>();
	content.forEach(({ node, parentId }, index) => {
		const point = byId.get(node.id);
		const parentKey = parentId && byId.has(parentId) ? parentId : docId;
		const cxn = cxnByChild.get(node.id);
		if (!point) {
			return;
		}
		const list = grouped.get(parentKey) ?? [];
		list.push({ point, order: cxn?.srcOrd ?? index, index });
		grouped.set(parentKey, list);
	});
	for (const [parentKey, list] of grouped) {
		const parent = byId.get(parentKey) ?? doc;
		list.sort((a, b) => a.order - b.order || a.index - b.index);
		for (const { point } of list) {
			const cxn = cxnByChild.get(point.id);
			const parTrans: DataPoint = {
				id: cxn?.parentTransitionId ?? `${point.id}#parTrans`,
				type: 'parTrans',
				label: cxn?.label,
				parent,
				children: [],
			};
			const sibTrans: DataPoint = {
				id: cxn?.siblingTransitionId ?? `${point.id}#sibTrans`,
				type: 'sibTrans',
				label: cxn?.label,
				parent,
				children: [],
			};
			point.parent = parent;
			parent.children.push(parTrans, point, sibTrans);
			byId.set(parTrans.id, parTrans);
			byId.set(sibTrans.id, sibTrans);
		}
	}
	return { doc, byId };
}

/** Content children (`node`/`asst`) of a point, in order. */
export function contentChildren(point: DataPoint): DataPoint[] {
	return point.children.filter((child) => child.type === 'node' || child.type === 'asst');
}

/** Depth of a content point below the doc point (top-level nodes are 1). */
export function pointDepth(point: DataPoint): number {
	let depth = 0;
	let current = point.parent;
	while (current) {
		depth++;
		current = current.parent;
	}
	return point.type === 'parTrans' || point.type === 'sibTrans' ? depth : depth;
}

/** Deepest content-point depth below `point` (0 when it has no content children). */
export function maxContentDepth(point: DataPoint): number {
	let best = 0;
	for (const child of contentChildren(point)) {
		best = Math.max(best, 1 + maxContentDepth(child));
	}
	return best;
}
