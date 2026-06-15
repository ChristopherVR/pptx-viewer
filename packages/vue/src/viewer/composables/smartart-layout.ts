/**
 * SmartArt layout engine — pure geometry helpers for the node-list fallback
 * path in SmartArtRenderer.vue.
 *
 * When `smartArtData.drawingShapes` are absent (the primary rendering path),
 * this module computes per-node geometry from the node tree and a bounding box
 * so SmartArtRenderer can render an SVG fallback without any framework code.
 *
 * All functions are pure (no Vue reactivity, no DOM), making them easy to unit-
 * test with Vitest.
 */

import type {
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

// ── Public geometry types ────────────────────────────────────────────────────

/** Axis-aligned rectangle. */
export interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A node rendered as an SVG rect (rounded or flat). */
export interface RenderedRectNode {
	kind: 'rect';
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

/** A node rendered as an SVG circle. */
export interface RenderedCircleNode {
	kind: 'circle';
	key: string;
	cx: number;
	cy: number;
	r: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
}

/** A node rendered as an SVG polygon (chevron, trapezoid, etc.). */
export interface RenderedPolygonNode {
	kind: 'polygon';
	key: string;
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

export type RenderedNode = RenderedRectNode | RenderedCircleNode | RenderedPolygonNode;

/** A connector line between two rendered nodes. */
export interface RenderedConnector {
	key: string;
	/** SVG path data string. */
	d: string;
}

/** Complete layout output for a single SmartArt family. */
export interface SmartArtLayoutResult {
	/** Rendered geometry nodes. */
	nodes: RenderedNode[];
	/** Connector lines (may be empty). */
	connectors: RenderedConnector[];
	/** SVG filter string for drop shadows, e.g. `"drop-shadow(…)"`. */
	shadowFilter: string | undefined;
	/**
	 * Suggested viewBox string `"0 0 W H"`.
	 * Callers should use the element's actual pixel dimensions.
	 */
	viewBox: string;
	/** The layout family that was applied. */
	family: LayoutFamily;
}

// ── Internal tree representation (mirrors React's smartart-helpers) ───────────

interface TreeNode {
	node: PptxSmartArtNode;
	children: TreeNode[];
}

// ── Colour + style utilities (self-contained, no shared imports) ──────────────

/** Pick a colour from the palette, cycling for any index. */
export function colour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

/** Compute a fading opacity for progressive nodes. */
export function nodeOpacity(index: number, total: number, style: SmartArtStyle): number {
	const base = style === 'intense' ? 1.0 : style === 'moderate' ? 0.92 : 0.85;
	if (total <= 1) {
		return base;
	}
	return base - (index / (total - 1)) * 0.15;
}

/** Drop-shadow filter string for the given style. */
export function styleShadow(style: SmartArtStyle): string | undefined {
	if (style === 'intense') {
		return 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))';
	}
	if (style === 'moderate') {
		return 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))';
	}
	return undefined;
}

/** Stroke width for node outlines. */
export function styleStroke(style: SmartArtStyle): number {
	if (style === 'intense') {
		return 2;
	}
	if (style === 'moderate') {
		return 1.5;
	}
	return 0;
}

/** Truncate text at `max` chars, appending ellipsis. */
export function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

/**
 * Fit font size to available space.
 * Uses a 0.6 char-width heuristic; clamps to 6 px minimum.
 */
export function fitFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	baseSize: number,
): number {
	const charWidthRatio = 0.6;
	const maxByWidth = maxWidth / Math.max(1, text.length * charWidthRatio);
	const maxByHeight = maxHeight * 0.5;
	return Math.max(6, Math.min(baseSize, maxByWidth, maxByHeight));
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

/**
 * Build a forest from a node array.
 *
 * Supports two input shapes:
 * 1. Flat list with `parentId` pointers (the format the core emits after
 *    parsing flat `<dgm:pt>` elements).
 * 2. Nested list where each node already carries a `children` array (the
 *    format produced when the core emits pre-nested nodes).
 *
 * When all root nodes already have `children`, the existing nesting is used
 * directly. Otherwise the flat `parentId` approach is used to build the tree.
 */
export function buildTree(nodes: PptxSmartArtNode[]): TreeNode[] {
	// Detect whether nodes are already nested (have children arrays populated)
	const hasNestedChildren = nodes.some((n) => n.children !== undefined && n.children.length > 0);

	if (hasNestedChildren) {
		// Recursively convert pre-nested PptxSmartArtNode tree to TreeNode tree
		function toTreeNode(n: PptxSmartArtNode): TreeNode {
			return {
				node: n,
				children: (n.children ?? []).map(toTreeNode),
			};
		}
		// Top-level nodes that either have no parentId or whose parentId is not
		// in the flat list are roots
		const allIds = new Set(nodes.map((n) => n.id));
		const roots = nodes.filter((n) => !n.parentId || !allIds.has(n.parentId));
		return roots.map(toTreeNode);
	}

	// Flat list with parentId pointers
	const map = new Map<string, TreeNode>();
	for (const n of nodes) {
		map.set(n.id, { node: n, children: [] });
	}
	const roots: TreeNode[] = [];
	for (const n of nodes) {
		const treeNode = map.get(n.id)!;
		if (n.parentId && map.has(n.parentId)) {
			map.get(n.parentId)!.children.push(treeNode);
		} else {
			roots.push(treeNode);
		}
	}
	return roots;
}

/** Total leaf-width of a tree node (1 for leaves, sum of children otherwise). */
export function treeWidth(t: TreeNode): number {
	if (t.children.length === 0) {
		return 1;
	}
	return t.children.reduce((s, c) => s + treeWidth(c), 0);
}

/** Maximum depth of a tree node (1 for leaves). */
export function treeDepth(t: TreeNode): number {
	if (t.children.length === 0) {
		return 1;
	}
	return 1 + Math.max(...t.children.map(treeDepth));
}

// ── Layout family selector ────────────────────────────────────────────────────

export type LayoutFamily =
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'matrix'
	| 'radial'
	| 'pyramid'
	| 'venn'
	| 'funnel'
	| 'target';

/** Canonical mapping of SmartArt named layouts → LayoutFamily. */
const LAYOUT_FAMILY_MAP: Partial<Record<SmartArtLayout, LayoutFamily>> = {
	basicBlockList: 'list',
	alternatingHexagons: 'list',
	horizontalBulletList: 'list',
	stackedList: 'list',
	tableList: 'list',
	trapezoidList: 'list',
	verticalBlockList: 'list',
	groupedList: 'list',
	pyramidList: 'list',

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
	verticalChevronList: 'process',
	horizontalPictureList: 'process',
	pictureAccentList: 'process',

	basicCycle: 'cycle',
	basicPie: 'cycle',

	basicRadial: 'radial',
	convergingRadial: 'radial',
	basicTarget: 'radial',
	interlockingGears: 'radial',

	hierarchy: 'hierarchy',

	basicMatrix: 'matrix',

	basicPyramid: 'pyramid',
	invertedPyramid: 'pyramid',

	basicVenn: 'venn',
	linearVenn: 'venn',

	basicFunnel: 'funnel',
};

/** Map a `resolvedLayoutType` string to a LayoutFamily. */
const RESOLVED_TYPE_MAP: Partial<Record<SmartArtLayoutType, LayoutFamily>> = {
	list: 'list',
	process: 'process',
	cycle: 'cycle',
	hierarchy: 'hierarchy',
	relationship: 'radial',
	matrix: 'matrix',
	pyramid: 'pyramid',
	funnel: 'funnel',
	target: 'target',
	venn: 'venn',
	timeline: 'process',
	chevron: 'process',
	bending: 'process',
	gear: 'radial',
};

/**
 * Determine which layout family to render.
 *
 * Priority:
 * 1. Named layout preset (`layout` field)
 * 2. `resolvedLayoutType` string from the core parser
 * 3. Heuristic: nodes with children → hierarchy; otherwise list
 */
export function resolveLayoutFamily(
	nodes: PptxSmartArtNode[],
	resolvedLayoutType?: SmartArtLayoutType,
	layout?: SmartArtLayout,
): LayoutFamily {
	if (layout && layout in LAYOUT_FAMILY_MAP) {
		return LAYOUT_FAMILY_MAP[layout]!;
	}
	if (resolvedLayoutType && resolvedLayoutType in RESOLVED_TYPE_MAP) {
		const mapped = RESOLVED_TYPE_MAP[resolvedLayoutType];
		if (mapped) {
			return mapped;
		}
	}
	// Heuristic: if any node has children it looks like a hierarchy
	const hasChildren = nodes.some((n) => n.children && n.children.length > 0);
	return hasChildren ? 'hierarchy' : 'list';
}

// ── Stroke helper ─────────────────────────────────────────────────────────────

function strokeFor(sw: number): string {
	return sw > 0 ? 'rgba(255,255,255,0.3)' : 'none';
}

// ── Per-family layout computers ───────────────────────────────────────────────

/** Bounding box passed to every layout function. */
export interface BoundingBox {
	width: number;
	height: number;
}

// --- List ---

/**
 * Vertical stacked rounded-rectangles list.
 */
export function computeListLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 4;
	const usableH = h - pad * 2;
	const itemH = nodes.length > 0 ? (usableH - gap * (nodes.length - 1)) / nodes.length : usableH;
	const itemW = w - pad * 2;
	const rx = Math.min(6, itemH * 0.15);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const y = pad + i * (itemH + gap);
		const fontSize = fitFontSize(node.text, itemW * 0.9, itemH, 12);
		const result: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-list-${node.id}-${i}`,
			x: pad,
			y,
			width: itemW,
			height: itemH,
			rx,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 40),
			fontSize,
			textX: pad + itemW / 2,
			textY: y + itemH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'list',
	};
}

// --- Process ---

/**
 * Horizontal chevron/arrow process layout.
 */
export function computeProcessLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 4;
	const chevronDepth = Math.min(16, w * 0.04);
	const usableW = w - pad * 2;
	const itemW = nodes.length > 0 ? (usableW - gap * (nodes.length - 1)) / nodes.length : usableW;
	const itemH = Math.min(h - pad * 2, h * 0.6);
	const yMid = h / 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const x = pad + i * (itemW + gap);
		const halfH = itemH / 2;
		const isFirst = i === 0;
		const isLast = i === nodes.length - 1;

		let points: string;
		if (isFirst) {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW - chevronDepth},${yMid - halfH}`,
				`${x + itemW},${yMid}`,
				`${x + itemW - chevronDepth},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
			].join(' ');
		} else if (isLast) {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW},${yMid - halfH}`,
				`${x + itemW},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
				`${x + chevronDepth},${yMid}`,
			].join(' ');
		} else {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW - chevronDepth},${yMid - halfH}`,
				`${x + itemW},${yMid}`,
				`${x + itemW - chevronDepth},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
				`${x + chevronDepth},${yMid}`,
			].join(' ');
		}

		const fontSize = fitFontSize(node.text, itemW * 0.7, itemH, 12);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-process-${node.id}-${i}`,
			points,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 25),
			fontSize,
			textX: x + itemW / 2,
			textY: yMid,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'process',
	};
}

// --- Cycle ---

/**
 * Circular arrangement of nodes with arc connectors.
 */
export function computeCycleLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const size = Math.min(w, h);
	const cx = w / 2;
	const cy = h / 2;
	const radius = size * 0.35;
	const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / Math.max(1, nodes.length)));
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const connectors: RenderedConnector[] = nodes.map((_node, i) => {
		const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		const nextI = (i + 1) % nodes.length;
		const nextAngle = (nextI / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nextX = cx + radius * Math.cos(nextAngle);
		const nextY = cy + radius * Math.sin(nextAngle);
		const midAngle = (angle + nextAngle) / 2;
		const adjustedMidAngle =
			i === nodes.length - 1 ? (angle + nextAngle + Math.PI * 2) / 2 : midAngle;
		const arcBulge = radius * 0.15;
		const controlX = cx + (radius + arcBulge) * Math.cos(adjustedMidAngle);
		const controlY = cy + (radius + arcBulge) * Math.sin(adjustedMidAngle);
		return {
			key: `${elementId}-cycle-conn-${i}`,
			d: `M${nx},${ny} Q${controlX},${controlY} ${nextX},${nextY}`,
		};
	});

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		const fontSize = fitFontSize(node.text, nodeR * 1.4, nodeR * 2, 11);
		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-cycle-${node.id}-${i}`,
			cx: nx,
			cy: ny,
			r: nodeR,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'cycle',
	};
}

// --- Hierarchy ---

/**
 * Tree / org-chart hierarchy with L-shaped connector lines.
 * Falls back to list layout if the tree cannot be built.
 */
export function computeHierarchyLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const roots = buildTree(nodes);
	if (roots.length === 0) {
		return computeListLayout(nodes, box, palette, style, elementId);
	}

	const { width: svgW, height: svgH } = box;
	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));
	const cellW = svgW / Math.max(1, totalLeaves);
	const cellH = svgH / Math.max(1, depth);
	const boxW = Math.min(cellW * 0.8, 140);
	const boxH = Math.min(cellH * 0.4, 36);
	const rx = Math.min(6, boxH * 0.15);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];
	let colourIdx = 0;

	function renderTreeNode(t: TreeNode, xOffset: number, level: number): void {
		const w = treeWidth(t);
		const nodeCx = (xOffset + w / 2) * cellW;
		const nodeCy = level * cellH + cellH / 2;
		const ci = colourIdx++;
		const fontSize = fitFontSize(t.node.text, boxW * 0.9, boxH, 11);

		// L-shaped connectors to children
		let childOffset = xOffset;
		for (const child of t.children) {
			const childW = treeWidth(child);
			const childCx = (childOffset + childW / 2) * cellW;
			const childCy = (level + 1) * cellH + cellH / 2;
			const midY = nodeCy + boxH / 2 + (childCy - boxH / 2 - (nodeCy + boxH / 2)) / 2;
			connectors.push({
				key: `${elementId}-hier-conn-${t.node.id}-${child.node.id}`,
				d: `M${nodeCx},${nodeCy + boxH / 2} L${nodeCx},${midY} L${childCx},${midY} L${childCx},${childCy - boxH / 2}`,
			});
			childOffset += childW;
		}

		const nodeEntry: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-hier-${t.node.id}-${ci}`,
			x: nodeCx - boxW / 2,
			y: nodeCy - boxH / 2,
			width: boxW,
			height: boxH,
			rx,
			fill: colour(ci, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(ci, nodes.length, style),
			text: truncate(t.node.text, 40),
			fontSize,
			textX: nodeCx,
			textY: nodeCy,
		};
		renderedNodes.push(nodeEntry);

		// Recurse
		let co = xOffset;
		for (const child of t.children) {
			renderTreeNode(child, co, level + 1);
			co += treeWidth(child);
		}
	}

	let offset = 0;
	for (const root of roots) {
		renderTreeNode(root, offset, 0);
		offset += treeWidth(root);
	}

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${svgW} ${svgH}`,
		family: 'hierarchy',
	};
}

// --- Matrix ---

/**
 * Grid (ceil(sqrt(n)) × rows) layout.
 */
export function computeMatrixLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
	const rows = Math.max(1, Math.ceil(nodes.length / cols));
	const pad = 8;
	const gap = 6;
	const usableW = w - pad * 2;
	const usableH = h - pad * 2;
	const cellW = (usableW - gap * (cols - 1)) / cols;
	const cellH = (usableH - gap * (rows - 1)) / rows;
	const rx = Math.min(6, Math.min(cellW, cellH) * 0.1);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = pad + col * (cellW + gap);
		const y = pad + row * (cellH + gap);
		const fontSize = fitFontSize(node.text, cellW * 0.85, cellH, 12);
		const result: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-matrix-${node.id}-${i}`,
			x,
			y,
			width: cellW,
			height: cellH,
			rx,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: x + cellW / 2,
			textY: y + cellH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'matrix',
	};
}

// --- Radial / Relationship ---

/**
 * Centre node + satellite nodes arranged radially.
 */
export function computeRadialLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cx = w / 2;
	const cy = h / 2;
	const size = Math.min(w, h);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	if (nodes.length === 0) {
		return {
			nodes: [],
			connectors: [],
			shadowFilter: undefined,
			viewBox: `0 0 ${w} ${h}`,
			family: 'radial',
		};
	}

	// First node is the centre; the rest are satellites
	const [centre, ...satellites] = nodes;
	const centreR = size * 0.14;
	const orbitR = size * 0.35;
	const satR = Math.max(size * 0.06, Math.min(size * 0.1, 180 / Math.max(1, satellites.length)));

	const renderedNodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];

	// Centre node
	const centreFontSize = fitFontSize(centre.text, centreR * 1.6, centreR * 2, 12);
	renderedNodes.push({
		kind: 'circle',
		key: `${elementId}-radial-centre-0`,
		cx,
		cy,
		r: centreR,
		fill: colour(0, palette),
		stroke,
		strokeWidth: sw,
		opacity: nodeOpacity(0, nodes.length, style),
		text: truncate(centre.text, 20),
		fontSize: centreFontSize,
	});

	// Satellite nodes
	satellites.forEach((node, si) => {
		const i = si + 1;
		const angle = (si / Math.max(1, satellites.length)) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + orbitR * Math.cos(angle);
		const ny = cy + orbitR * Math.sin(angle);
		const fontSize = fitFontSize(node.text, satR * 1.4, satR * 2, 10);

		// Connector from centre to satellite
		const edgeAngleX = cx + centreR * Math.cos(angle);
		const edgeAngleY = cy + centreR * Math.sin(angle);
		connectors.push({
			key: `${elementId}-radial-conn-${i}`,
			d: `M${edgeAngleX},${edgeAngleY} L${nx},${ny}`,
		});

		renderedNodes.push({
			kind: 'circle',
			key: `${elementId}-radial-${node.id}-${i}`,
			cx: nx,
			cy: ny,
			r: satR,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize,
		});
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'radial',
	};
}

// --- Pyramid ---

/**
 * Stacked trapezoids forming a pyramid shape (widest at bottom).
 */
export function computePyramidLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 3;
	const usableH = h - pad * 2;
	const bandH = nodes.length > 0 ? (usableH - gap * (nodes.length - 1)) / nodes.length : usableH;
	const maxW = w - pad * 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const topWidthFrac = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
		const bottomWidthFrac =
			i < nodes.length - 1 ? 0.3 + ((i + 1) / Math.max(nodes.length - 1, 1)) * 0.7 : 1.0;
		const topW = maxW * topWidthFrac;
		const bottomW = maxW * bottomWidthFrac;
		const y = pad + i * (bandH + gap);

		const topLeft = (w - topW) / 2;
		const topRight = topLeft + topW;
		const bottomLeft = (w - bottomW) / 2;
		const bottomRight = bottomLeft + bottomW;

		const points = [
			`${topLeft},${y}`,
			`${topRight},${y}`,
			`${bottomRight},${y + bandH}`,
			`${bottomLeft},${y + bandH}`,
		].join(' ');

		const fontSize = fitFontSize(node.text, topW * 0.85, bandH, 12);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-pyramid-${node.id}-${i}`,
			points,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: w / 2,
			textY: y + bandH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'pyramid',
	};
}

// --- Venn ---

/**
 * Overlapping circles arranged radially (≤4 nodes) or horizontally (5+).
 */
export function computeVennLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const shadow = styleShadow(style);

	if (nodes.length <= 4) {
		const cx = w / 2;
		const cy = h / 2;
		const r = Math.min(w, h) * 0.28;
		const spread = r * 0.55;

		const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
			const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
			const nx = cx + spread * Math.cos(angle);
			const ny = cy + spread * Math.sin(angle);
			const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 11);
			const result: RenderedCircleNode = {
				kind: 'circle',
				key: `${elementId}-venn-${node.id}-${i}`,
				cx: nx,
				cy: ny,
				r,
				fill: colour(i, palette),
				stroke: 'none',
				strokeWidth: 0,
				opacity: 0.35,
				text: truncate(node.text, 20),
				fontSize,
			};
			return result;
		});

		return {
			nodes: renderedNodes,
			connectors: [],
			shadowFilter: shadow,
			viewBox: `0 0 ${w} ${h}`,
			family: 'venn',
		};
	}

	// 5+ nodes: horizontal overlapping circles
	const r = Math.min(h * 0.38, w / (nodes.length * 0.9));
	const overlap = r * 0.5;
	const totalW = nodes.length * (r * 2 - overlap) + overlap;
	const offsetX = (w - totalW) / 2 + r;
	const cy = h / 2;

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const nx = offsetX + i * (r * 2 - overlap);
		const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 10);
		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-venn-${node.id}-${i}`,
			cx: nx,
			cy,
			r,
			fill: colour(i, palette),
			stroke: 'none',
			strokeWidth: 0,
			opacity: 0.35,
			text: truncate(node.text, 20),
			fontSize,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'venn',
	};
}

// --- Funnel ---

/**
 * Narrowing trapezoid stages forming a funnel.
 */
export function computeFunnelLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const usableW = w - pad * 2;
	const stageH = nodes.length > 0 ? (h - pad * 2) / nodes.length : h - pad * 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const topWidth = usableW * (1 - i / Math.max(1, nodes.length));
		const bottomWidth = usableW * (1 - (i + 1) / Math.max(1, nodes.length));
		const y = pad + i * stageH;

		const topLeft = (w - topWidth) / 2;
		const topRight = topLeft + topWidth;
		const bottomLeft = (w - bottomWidth) / 2;
		const bottomRight = bottomLeft + bottomWidth;

		const points = [
			`${topLeft},${y}`,
			`${topRight},${y}`,
			`${bottomRight},${y + stageH}`,
			`${bottomLeft},${y + stageH}`,
		].join(' ');

		const fontSize = fitFontSize(node.text, topWidth * 0.85, stageH, 11);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-funnel-${node.id}-${i}`,
			points,
			fill: colour(i, palette),
			stroke,
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: w / 2,
			textY: y + stageH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'funnel',
	};
}

// --- Target ---

/**
 * Concentric circles (bullseye) with leader lines to the right.
 */
export function computeTargetLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cx = w * 0.4;
	const cy = h / 2;
	const maxR = Math.min(cx - 8, cy - 8);
	const shadow = styleShadow(style);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const r = maxR * ((nodes.length - i) / Math.max(1, nodes.length));
		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-target-${node.id}-${i}`,
			cx,
			cy,
			r: Math.max(r, 4),
			fill: colour(i, palette),
			stroke: 'none',
			strokeWidth: 0,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize: Math.max(7, Math.min(10, maxR / Math.max(1, nodes.length + 1))),
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'target',
	};
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Compute the SVG layout for a SmartArt element when drawing shapes are absent.
 *
 * @param nodes               - Flat/nested node array from `PptxSmartArtData`.
 * @param box                 - Pixel bounding box of the element.
 * @param palette             - Resolved colour palette.
 * @param style               - Resolved SmartArt style intensity.
 * @param elementId           - Element ID (used for stable SVG key generation).
 * @param resolvedLayoutType  - Layout type string from the core parser.
 * @param layout              - Named layout preset.
 * @returns Complete layout geometry for the resolved family.
 */
export function computeSmartArtLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	resolvedLayoutType?: SmartArtLayoutType,
	layout?: SmartArtLayout,
): SmartArtLayoutResult {
	// Flatten nested children into a single list for non-hierarchy families
	const flat = flattenNodes(nodes);

	const family = resolveLayoutFamily(nodes, resolvedLayoutType, layout);

	switch (family) {
		case 'list':
			return computeListLayout(flat, box, palette, style, elementId);
		case 'process':
			return computeProcessLayout(flat, box, palette, style, elementId);
		case 'cycle':
			return computeCycleLayout(flat, box, palette, style, elementId);
		case 'hierarchy':
			// Hierarchy works with the original nested nodes
			return computeHierarchyLayout(nodes, box, palette, style, elementId);
		case 'matrix':
			return computeMatrixLayout(flat, box, palette, style, elementId);
		case 'radial':
			return computeRadialLayout(flat, box, palette, style, elementId);
		case 'pyramid':
			return computePyramidLayout(flat, box, palette, style, elementId);
		case 'venn':
			return computeVennLayout(flat, box, palette, style, elementId);
		case 'funnel':
			return computeFunnelLayout(flat, box, palette, style, elementId);
		case 'target':
			return computeTargetLayout(flat, box, palette, style, elementId);
	}
}

/** Depth-first flatten of nested node forest. */
export function flattenNodes(roots: PptxSmartArtNode[]): PptxSmartArtNode[] {
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
