/**
 * SmartArt Layout Engine - Core layout algorithms.
 *
 * Contains the concrete layout algorithm implementations: snake, linear,
 * hierarchy, cycle, pyramid, and matrix. Each function computes positioned
 * shapes from a node list, constraints, and bounding box.
 *
 * @module smartart-layout-engine-algorithms
 */

import type { PptxSmartArtNode } from '../types';
import type { ContainerBounds, TreeNode } from './smartart-helpers';
import { buildForest, treeWidth, treeDepth, getContentNodes } from './smartart-helpers';
import type { LayoutConstraints, LayoutEngineShape } from './smartart-layout-engine-types';

// ============================================================================
// Snake / Zigzag layout
// ============================================================================

/**
 * Compute a snake/zigzag layout.
 *
 * Nodes are arranged in rows, flowing left-to-right on even rows and
 * right-to-left on odd rows (serpentine pattern).
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (column count, spacing, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computeSnakeLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const items = getContentNodes(nodes);
	if (items.length === 0) {
		return [];
	}

	const cols = constraints.cols ?? Math.min(4, items.length);
	const rows = Math.ceil(items.length / cols);
	const sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
	const secSibSp = (constraints.secSibSp ?? 0.03) * bounds.height;
	const begPad = (constraints.begPad ?? 0.02) * bounds.width;
	const endPad = (constraints.endPad ?? 0.02) * bounds.width;

	const usableW = bounds.width - begPad - endPad;
	const usableH = bounds.height - begPad - endPad;
	const cellW = (usableW - sibSp * (cols - 1)) / cols;
	const cellH = (usableH - secSibSp * (rows - 1)) / rows;

	const nodeW = constraints.w ? constraints.w * bounds.width : cellW * 0.85;
	const nodeH = constraints.h ? constraints.h * bounds.height : cellH * 0.7;

	return items.map((node, i) => {
		const row = Math.floor(i / cols);
		const colInRow = i % cols;
		// Reverse direction on odd rows for serpentine effect
		const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;

		const cx = bounds.x + begPad + col * (cellW + sibSp) + cellW / 2;
		const cy = bounds.y + begPad + row * (cellH + secSibSp) + cellH / 2;

		return {
			nodeId: node.id,
			x: Math.round(cx - nodeW / 2),
			y: Math.round(cy - nodeH / 2),
			width: Math.round(nodeW),
			height: Math.round(nodeH),
		};
	});
}

// ============================================================================
// Linear layout
// ============================================================================

/**
 * Compute a linear layout.
 *
 * Arranges nodes in a single line, either horizontally (default) or
 * vertically. The direction is determined by the `aspectRatio` constraint
 * (values below 0.5 produce a vertical layout).
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (spacing, direction, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computeLinearLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const items = getContentNodes(nodes);
	if (items.length === 0) {
		return [];
	}

	const isVertical = (constraints.aspectRatio ?? 1) < 0.5;
	const sibSp = constraints.sibSp ?? 0.03;
	const begPad = constraints.begPad ?? 0.02;
	const endPad = constraints.endPad ?? 0.02;

	if (isVertical) {
		const padTop = begPad * bounds.height;
		const padBot = endPad * bounds.height;
		const gap = sibSp * bounds.height;
		const usableH = bounds.height - padTop - padBot;
		const nodeH = (usableH - gap * (items.length - 1)) / items.length;
		const nodeW = constraints.w ? constraints.w * bounds.width : bounds.width * 0.8;
		const xOffset = bounds.x + (bounds.width - nodeW) / 2;

		return items.map((node, i) => ({
			nodeId: node.id,
			x: Math.round(xOffset),
			y: Math.round(bounds.y + padTop + i * (nodeH + gap)),
			width: Math.round(nodeW),
			height: Math.round(nodeH),
		}));
	}

	// Horizontal layout
	const padLeft = begPad * bounds.width;
	const padRight = endPad * bounds.width;
	const gap = sibSp * bounds.width;
	const usableW = bounds.width - padLeft - padRight;
	const nodeW = (usableW - gap * (items.length - 1)) / items.length;
	const nodeH = constraints.h ? constraints.h * bounds.height : bounds.height * 0.6;
	const yOffset = bounds.y + (bounds.height - nodeH) / 2;

	const shapes = items.map((node, i) => ({
		nodeId: node.id,
		x: Math.round(bounds.x + padLeft + i * (nodeW + gap)),
		y: Math.round(yOffset),
		width: Math.round(nodeW),
		height: Math.round(nodeH),
	}));

	// Reverse if direction is 'rev'
	if (constraints.dir === 'rev') {
		shapes.reverse();
		const positions = shapes.map((s) => ({ x: s.x, y: s.y }));
		for (let i = 0; i < shapes.length; i++) {
			shapes[i].x = positions[shapes.length - 1 - i].x;
			shapes[i].y = positions[shapes.length - 1 - i].y;
		}
	}

	return shapes;
}

// ============================================================================
// Hierarchy / Tree layout
// ============================================================================

/**
 * Compute a hierarchy/tree layout.
 *
 * Positions nodes in a top-down tree arrangement using the parent-child
 * relationships defined on each node. Falls back to linear layout when
 * no tree structure can be built.
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (spacing, node size, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computeHierarchyLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const roots = buildForest(nodes);
	if (roots.length === 0) {
		// Fall back to linear if no tree structure
		return computeLinearLayout(nodes, constraints, bounds);
	}

	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));

	const begPad = (constraints.begPad ?? 0.02) * bounds.width;
	const _sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
	const _secSibSp = (constraints.secSibSp ?? 0.03) * bounds.height;

	const usableW = bounds.width - begPad * 2;
	const usableH = bounds.height - begPad * 2;
	const cellW = usableW / Math.max(totalLeaves, 1);
	const cellH = usableH / Math.max(depth, 1);

	const nodeW = constraints.w ? constraints.w * bounds.width : Math.min(cellW * 0.8, 140);
	const nodeH = constraints.h ? constraints.h * bounds.height : Math.min(cellH * 0.35, 50);

	const shapes: LayoutEngineShape[] = [];

	// Cap recursion to guard against pathological/malformed input
	const MAX_WALK_DEPTH = 256;

	function walk(t: TreeNode, xOffset: number, level: number): number {
		if (level >= MAX_WALK_DEPTH) {
			return 1;
		}
		const w = treeWidth(t);
		const cx = bounds.x + begPad + (xOffset + w / 2) * cellW;
		const cy = bounds.y + begPad + level * cellH + cellH / 2;

		shapes.push({
			nodeId: t.node.id,
			x: Math.round(cx - nodeW / 2),
			y: Math.round(cy - nodeH / 2),
			width: Math.round(nodeW),
			height: Math.round(nodeH),
		});

		let childOffset = xOffset;
		for (const child of t.children) {
			walk(child, childOffset, level + 1);
			childOffset += treeWidth(child);
		}
		return w;
	}

	let offset = 0;
	for (const root of roots) {
		offset += walk(root, offset, 0);
	}

	return shapes;
}

// ============================================================================
// Cycle / Radial layout
// ============================================================================

/**
 * Compute a cycle/radial layout.
 *
 * Arranges nodes in a circle around a central point.
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (node size, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computeCycleLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const items = getContentNodes(nodes);
	if (items.length === 0) {
		return [];
	}

	const size = Math.min(bounds.width, bounds.height);
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const radius = size * 0.32;

	const nodeW = constraints.w
		? constraints.w * bounds.width
		: Math.max(size * 0.18, Math.min(size * 0.28, 300 / items.length));
	const nodeH = constraints.h ? constraints.h * bounds.height : nodeW * 0.6;

	return items.map((node, i) => {
		const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle) - nodeW / 2;
		const ny = cy + radius * Math.sin(angle) - nodeH / 2;

		return {
			nodeId: node.id,
			x: Math.round(nx),
			y: Math.round(ny),
			width: Math.round(nodeW),
			height: Math.round(nodeH),
		};
	});
}

// ============================================================================
// Pyramid layout
// ============================================================================

/**
 * Compute a pyramid layout.
 *
 * Nodes are stacked vertically from narrow (top) to wide (bottom),
 * forming a pyramid shape.
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (padding, spacing, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computePyramidLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const items = getContentNodes(nodes);
	if (items.length === 0) {
		return [];
	}

	const begPad = (constraints.begPad ?? 0.02) * bounds.height;
	const sibSp = (constraints.sibSp ?? 0.01) * bounds.height;
	const usableH = bounds.height - begPad * 2;
	const bandH = (usableH - sibSp * (items.length - 1)) / items.length;
	const maxW = bounds.width - begPad * 2;

	return items.map((node, i) => {
		// Top band is narrowest, bottom is widest
		const widthFraction = 0.3 + (i / Math.max(items.length - 1, 1)) * 0.7;
		const w = maxW * widthFraction;
		const x = bounds.x + (bounds.width - w) / 2;
		const y = bounds.y + begPad + i * (bandH + sibSp);

		return {
			nodeId: node.id,
			x: Math.round(x),
			y: Math.round(y),
			width: Math.round(w),
			height: Math.round(bandH),
		};
	});
}

// ============================================================================
// Matrix / Grid layout
// ============================================================================

/**
 * Compute a matrix/grid layout.
 *
 * Arranges nodes in an NxN (or NxM) grid pattern.
 *
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values (column count, spacing, etc.).
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
export function computeMatrixLayout(
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	const items = getContentNodes(nodes);
	if (items.length === 0) {
		return [];
	}

	const cols = constraints.cols ?? Math.ceil(Math.sqrt(items.length));
	const rows = Math.ceil(items.length / cols);
	const begPad = (constraints.begPad ?? 0.02) * Math.min(bounds.width, bounds.height);
	const sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
	const secSibSp = (constraints.secSibSp ?? 0.02) * bounds.height;

	const usableW = bounds.width - begPad * 2;
	const usableH = bounds.height - begPad * 2;
	const cellW = (usableW - sibSp * (cols - 1)) / cols;
	const cellH = (usableH - secSibSp * (rows - 1)) / rows;

	return items.map((node, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);

		return {
			nodeId: node.id,
			x: Math.round(bounds.x + begPad + col * (cellW + sibSp)),
			y: Math.round(bounds.y + begPad + row * (cellH + secSibSp)),
			width: Math.round(cellW),
			height: Math.round(cellH),
		};
	});
}
