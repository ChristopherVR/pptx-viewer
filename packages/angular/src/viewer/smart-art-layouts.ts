/**
 * Pure TypeScript SmartArt family layout engines.
 *
 * Computes node box positions for the four core SmartArt families so the
 * Angular `SmartArtRendererComponent` can lay out nodes when no explicit
 * drawing-shapes are present.
 *
 * No Angular imports: all exports are plain TypeScript so they can be
 * unit-tested with vitest without TestBed or the Angular compiler.
 *
 * Geometry ported from the React renderers:
 *   packages/react/src/viewer/components/elements/smartart-layout-renderers.tsx
 *   packages/react/src/viewer/components/elements/smartart-renderer-hierarchy.tsx
 *   packages/react/src/viewer/utils/smartart-helpers.tsx
 */
import type { PptxSmartArtData, PptxSmartArtNode, SmartArtLayout } from 'pptx-viewer-core';

// ==========================================================================
// Public types
// ==========================================================================

/**
 * A positioned node box ready to be rendered as `<rect>` + `<text>` in an SVG.
 */
export interface PositionedNode {
	/** Original node id from `PptxSmartArtNode`. */
	id: string;
	/** Display text (may be truncated by the caller). */
	text: string;
	/** Left edge (SVG user units). */
	x: number;
	/** Top edge (SVG user units). */
	y: number;
	/** Box width (SVG user units). */
	w: number;
	/** Box height (SVG user units). */
	h: number;
	/**
	 * Zero-based tree depth / band index.
	 * For flat families (list, process, cycle) all nodes are at level 0.
	 */
	level: number;
	/**
	 * Node radius: only set for cycle nodes (rendered as `<circle>`).
	 * When defined the caller should render a circle at (x + r, y + r) instead
	 * of a rect.
	 */
	r?: number;
}

/**
 * A connector segment rendered as `<line x1 y1 x2 y2 />` or SVG `<path>`.
 */
export interface ConnectorSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * Result returned by `layoutSmartArtNodes`.
 */
export interface SmartArtLayoutResult {
	nodes: PositionedNode[];
	connectors: ConnectorSegment[];
}

/**
 * Recognised SmartArt family classifiers returned by `resolveSmartArtFamily`.
 */
export type SmartArtFamily = 'list' | 'process' | 'cycle' | 'hierarchy';

// ==========================================================================
// Internal tree helpers (ported from smartart-helpers.tsx)
// ==========================================================================

interface TreeNode {
	node: PptxSmartArtNode;
	children: TreeNode[];
}

/** Build a forest from flat nodes using `parentId`. */
function buildTree(nodes: PptxSmartArtNode[]): TreeNode[] {
	const map = new Map<string, TreeNode>();
	for (const n of nodes) {
		map.set(n.id, { node: n, children: [] });
	}
	const roots: TreeNode[] = [];
	for (const n of nodes) {
		const treeNode = map.get(n.id);
		if (!treeNode) {
			continue;
		}
		if (n.parentId) {
			const parent = map.get(n.parentId);
			if (parent) {
				parent.children.push(treeNode);
				continue;
			}
		}
		roots.push(treeNode);
	}
	return roots;
}

/** Measure total width (leaf-units) of a tree node. */
function treeWidth(t: TreeNode): number {
	if (t.children.length === 0) {
		return 1;
	}
	return t.children.reduce((sum, c) => sum + treeWidth(c), 0);
}

/** Measure depth of a tree. */
function treeDepth(t: TreeNode): number {
	if (t.children.length === 0) {
		return 1;
	}
	return 1 + Math.max(...t.children.map(treeDepth));
}

// ==========================================================================
// Family classifier
// ==========================================================================

/** Named-layout → family mapping (ported from layoutToCategory in React). */
const LAYOUT_TO_FAMILY: Partial<Record<SmartArtLayout, SmartArtFamily>> = {
	basicBlockList: 'list',
	alternatingHexagons: 'list',
	horizontalBulletList: 'list',
	stackedList: 'list',
	tableList: 'list',
	trapezoidList: 'list',
	verticalBlockList: 'list',
	groupedList: 'list',
	pictureAccentList: 'list',
	pyramidList: 'list',
	horizontalPictureList: 'list',
	verticalChevronList: 'list',

	basicChevronProcess: 'process',
	continuousBlockProcess: 'process',
	segmentedProcess: 'process',
	upwardArrow: 'process',
	basicTimeline: 'process',
	bendingProcess: 'process',
	stepDownProcess: 'process',
	alternatingFlow: 'process',
	descendingProcess: 'process',
	accentProcess: 'process',

	basicCycle: 'cycle',
	basicPie: 'cycle',

	hierarchy: 'hierarchy',
};

/**
 * Classify `data` into one of the four core SmartArt families.
 *
 * Priority:
 * 1. `resolvedLayoutType` field (set by the core parser)
 * 2. Named `layout` preset via the LAYOUT_TO_FAMILY table
 * 3. Fallback: 'list'
 */
export function resolveSmartArtFamily(data: PptxSmartArtData): SmartArtFamily {
	const resolved = data.resolvedLayoutType;
	if (
		resolved === 'list' ||
		resolved === 'process' ||
		resolved === 'cycle' ||
		resolved === 'hierarchy'
	) {
		return resolved;
	}
	if (data.layout) {
		const mapped = LAYOUT_TO_FAMILY[data.layout];
		if (mapped !== undefined) {
			return mapped;
		}
	}
	return 'list';
}

// ==========================================================================
// Individual layout engines
// ==========================================================================

/**
 * List: vertical stack of rectangular bands, full width.
 *
 * Geometry mirrors `ListRenderer` from smartart-layout-renderers.tsx.
 */
function layoutList(
	nodes: PptxSmartArtNode[],
	width: number,
	height: number,
): SmartArtLayoutResult {
	if (nodes.length === 0) {
		return { nodes: [], connectors: [] };
	}
	const pad = 8;
	const gap = 4;
	const usableH = height - pad * 2;
	const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
	const itemW = width - pad * 2;

	const positioned: PositionedNode[] = nodes.map((node, i) => ({
		id: node.id,
		text: node.text,
		x: pad,
		y: pad + i * (itemH + gap),
		w: itemW,
		h: itemH,
		level: 0,
	}));

	return { nodes: positioned, connectors: [] };
}

/**
 * Process: horizontal row of chevron / arrow shapes.
 *
 * The chevron notch (`chevronDepth`) is embedded in the `x` / `w` values so
 * the caller can use the same bounding-box approach; the actual chevron polygon
 * is built at render time from these values.
 *
 * Geometry mirrors `ProcessRenderer` from smartart-layout-renderers.tsx.
 */
function layoutProcess(
	nodes: PptxSmartArtNode[],
	width: number,
	height: number,
): SmartArtLayoutResult {
	if (nodes.length === 0) {
		return { nodes: [], connectors: [] };
	}
	const pad = 8;
	const gap = 4;
	const chevronDepth = Math.min(16, width * 0.04);
	const usableW = width - pad * 2;
	const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
	const itemH = Math.min(height - pad * 2, height * 0.6);
	const yTop = (height - itemH) / 2;

	const positioned: PositionedNode[] = nodes.map(
		(node, i) =>
			({
				id: node.id,
				text: node.text,
				x: pad + i * (itemW + gap),
				y: yTop,
				w: itemW,
				h: itemH,
				level: 0,
				/** Expose chevron depth so callers can build the polygon. */
				chevronDepth,
			}) as PositionedNode & { chevronDepth: number },
	);

	return { nodes: positioned, connectors: [] };
}

/**
 * Cycle: nodes placed evenly around a circle.
 *
 * Each node is returned as a circle (`r` is set); connectors are curved arcs
 * approximated here as straight-line `ConnectorSegment`s connecting the centre
 * of consecutive node circles.
 *
 * Geometry mirrors `CycleRenderer` from smartart-layout-renderers.tsx.
 */
function layoutCycle(
	nodes: PptxSmartArtNode[],
	width: number,
	height: number,
): SmartArtLayoutResult {
	if (nodes.length === 0) {
		return { nodes: [], connectors: [] };
	}
	const size = Math.min(width, height);
	const cx = width / 2;
	const cy = height / 2;
	const radius = size * 0.35;
	const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / nodes.length));
	const TWO_PI = Math.PI * 2;
	const HALF_PI = Math.PI / 2;

	const positioned: PositionedNode[] = nodes.map((node, i) => {
		const angle = (i / nodes.length) * TWO_PI - HALF_PI;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		return {
			id: node.id,
			text: node.text,
			/** Top-left of bounding box so x+r, y+r is the circle centre. */
			x: nx - nodeR,
			y: ny - nodeR,
			w: nodeR * 2,
			h: nodeR * 2,
			level: 0,
			r: nodeR,
		};
	});

	// Straight-line approximations of the inter-node arcs.
	const connectors: ConnectorSegment[] = nodes.map((_node, i) => {
		const angle = (i / nodes.length) * TWO_PI - HALF_PI;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		const nextI = (i + 1) % nodes.length;
		const nextAngle = (nextI / nodes.length) * TWO_PI - HALF_PI;
		const nextX = cx + radius * Math.cos(nextAngle);
		const nextY = cy + radius * Math.sin(nextAngle);
		return { x1: nx, y1: ny, x2: nextX, y2: nextY };
	});

	return { nodes: positioned, connectors };
}

/**
 * Hierarchy: tree / org-chart layout.
 *
 * Nodes are arranged in levels top-to-bottom. L-shaped connectors link each
 * parent to its children.
 *
 * Geometry mirrors `HierarchyRenderer` from smartart-renderer-hierarchy.tsx.
 * Falls back to `layoutList` when no parent-child structure can be detected.
 */
function layoutHierarchy(
	rawNodes: PptxSmartArtNode[],
	width: number,
	height: number,
): SmartArtLayoutResult {
	if (rawNodes.length === 0) {
		return { nodes: [], connectors: [] };
	}

	const roots = buildTree(rawNodes);
	if (roots.length === 0) {
		return layoutList(rawNodes, width, height);
	}

	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));
	const cellW = width / totalLeaves;
	const cellH = height / Math.max(depth, 1);
	const boxW = Math.min(cellW * 0.8, 140);
	const boxH = Math.min(cellH * 0.4, 36);

	const positioned: PositionedNode[] = [];
	const connectors: ConnectorSegment[] = [];

	function visitNode(t: TreeNode, xOffset: number, level: number): void {
		const w = treeWidth(t);
		const nodeCx = (xOffset + w / 2) * cellW;
		const nodeCy = level * cellH + cellH / 2;

		positioned.push({
			id: t.node.id,
			text: t.node.text,
			x: nodeCx - boxW / 2,
			y: nodeCy - boxH / 2,
			w: boxW,
			h: boxH,
			level,
		});

		// Emit L-shaped connector segments from this node to each child.
		let childOffset = xOffset;
		for (const child of t.children) {
			const childW = treeWidth(child);
			const childCx = (childOffset + childW / 2) * cellW;
			const childCy = (level + 1) * cellH + cellH / 2;
			// Mid-point for the horizontal leg of the L.
			const midY = nodeCy + boxH / 2 + (childCy - boxH / 2 - (nodeCy + boxH / 2)) / 2;

			// Vertical leg down from parent.
			connectors.push({
				x1: nodeCx,
				y1: nodeCy + boxH / 2,
				x2: nodeCx,
				y2: midY,
			});
			// Horizontal leg across to child column.
			connectors.push({
				x1: nodeCx,
				y1: midY,
				x2: childCx,
				y2: midY,
			});
			// Vertical leg down to child box.
			connectors.push({
				x1: childCx,
				y1: midY,
				x2: childCx,
				y2: childCy - boxH / 2,
			});

			visitNode(child, childOffset, level + 1);
			childOffset += childW;
		}
	}

	let offset = 0;
	for (const root of roots) {
		visitNode(root, offset, 0);
		offset += treeWidth(root);
	}

	return { nodes: positioned, connectors };
}

// ==========================================================================
// Public entry-point
// ==========================================================================

/**
 * Compute positioned node boxes (and optional connector segments) for the
 * SmartArt diagram described by `data`, fitted inside the given `width` ×
 * `height` viewport.
 *
 * This is a **pure function**: it only reads `data` and produces geometry.
 * Callers are responsible for rendering (`<rect>`/`<circle>` + `<text>` per
 * node, `<line>` per connector).
 *
 * @param data   - Parsed `PptxSmartArtData` from `pptx-viewer-core`.
 * @param width  - Viewport width in SVG user units (px at 1:1).
 * @param height - Viewport height in SVG user units (px at 1:1).
 */
export function layoutSmartArtNodes(
	data: PptxSmartArtData,
	width: number,
	height: number,
): SmartArtLayoutResult {
	// Flatten nested root-nodes for families that work on a flat list.
	const flatRoots = flattenForLayout(data.nodes);
	const family = resolveSmartArtFamily(data);

	switch (family) {
		case 'process':
			return layoutProcess(flatRoots, width, height);
		case 'cycle':
			return layoutCycle(flatRoots, width, height);
		case 'hierarchy':
			// Hierarchy uses the raw nested structure to build the tree.
			return layoutHierarchy(data.nodes, width, height);
		case 'list':
		default:
			return layoutList(flatRoots, width, height);
	}
}

/**
 * Depth-first flatten: only the immediate root nodes are used for flat
 * families (process / cycle / list). Children are included so that, for
 * example, a process diagram that happens to have nested nodes still renders
 * every node as a step.
 */
function flattenForLayout(roots: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (n: PptxSmartArtNode): void => {
		out.push(n);
		for (const c of n.children ?? []) {
			walk(c);
		}
	};
	for (const r of roots) {
		walk(r);
	}
	return out;
}
