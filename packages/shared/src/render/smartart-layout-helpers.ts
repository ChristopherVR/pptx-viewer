/**
 * SmartArt layout engine — pure colour / style / tree / family-resolution
 * helpers shared by the React, Vue, and Angular bindings.
 *
 * These back the SVG-fallback path taken when a SmartArt element has no
 * pre-computed `drawingShapes`. No framework code, no DOM — pure TypeScript
 * over `pptx-viewer-core` types and the geometry types in
 * `smartart-layout-types`.
 *
 * Consolidated from (and kept the superset of):
 *   - Vue  `packages/vue/src/viewer/composables/smartart-layout.ts`
 *   - React `packages/react/src/viewer/utils/smartart-helpers.tsx`
 */

import type {
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

import type { LayoutFamily, TreeNode } from './smartart-layout-types';

// ── Colour + style utilities ─────────────────────────────────────────────────

/** Pick a colour from the palette, cycling for any index. */
export function colour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

/**
 * Resolve the effective fill for a node: an explicit per-node
 * `node.style.fillColor` override wins, otherwise the cycled palette colour.
 */
export function nodeFill(node: PptxSmartArtNode, index: number, palette: string[]): string {
	const override = node.style?.fillColor;
	return override && override.length > 0 ? override : colour(index, palette);
}

/**
 * Resolve the effective outline stroke for a node: an explicit per-node
 * `node.style.lineColor` override wins, otherwise the style-derived default.
 */
export function nodeStroke(node: PptxSmartArtNode, defaultStroke: string): string {
	const override = node.style?.lineColor;
	return override && override.length > 0 ? override : defaultStroke;
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

/** Truncate text at `max` chars, appending an ellipsis. */
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

/** Outline-stroke colour for a node given its computed stroke width. */
export function strokeFor(sw: number): string {
	return sw > 0 ? 'rgba(255,255,255,0.3)' : 'none';
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
	const hasNestedChildren = nodes.some((n) => n.children !== undefined && n.children.length > 0);

	if (hasNestedChildren) {
		const toTreeNode = (n: PptxSmartArtNode): TreeNode => ({
			node: n,
			children: (n.children ?? []).map(toTreeNode),
		});
		const allIds = new Set(nodes.map((n) => n.id));
		const roots = nodes.filter((n) => !n.parentId || !allIds.has(n.parentId));
		return roots.map(toTreeNode);
	}

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

/** Depth-first flatten of a nested node forest. */
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

// ── Layout family selector ────────────────────────────────────────────────────

/** Canonical mapping of SmartArt named layouts → LayoutFamily. */
export const LAYOUT_FAMILY_MAP: Partial<Record<SmartArtLayout, LayoutFamily>> = {
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
	const hasChildren = nodes.some((n) => n.children && n.children.length > 0);
	return hasChildren ? 'hierarchy' : 'list';
}
