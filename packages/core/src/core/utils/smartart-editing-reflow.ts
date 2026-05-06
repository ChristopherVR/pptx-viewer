/**
 * SmartArt layout reflow dispatcher and basic layout implementations.
 *
 * Contains the main `reflowSmartArtLayout` entry point which dispatches to
 * the appropriate layout algorithm, plus the simpler layout implementations
 * (list, process, hierarchy) and the layout category resolver.
 *
 * @module smartart-editing-reflow
 */

import type {
	PptxSmartArtData,
	PptxSmartArtNode,
	PptxSmartArtDrawingShape,
	SmartArtLayoutType,
} from '../types';
import {
	reflowCycle,
	reflowMatrix,
	reflowPyramid,
	reflowFunnel,
	reflowTarget,
	reflowGear,
	reflowVenn,
	reflowTimeline,
	reflowRelationship,
	reflowChevron,
	reflowBending,
} from './smartart-editing-reflow-layouts';
import type { ContainerBounds } from './smartart-helpers';
import { buildForest, treeWidth, treeDepth, getContentNodes } from './smartart-helpers';

// ── Public types ─────────────────────────────────────────────────────────

/**
 * Position data for a single node produced by the reflow engine.
 */
export interface ReflowedNodePosition {
	/** Unique identifier of the SmartArt node. */
	nodeId: string;
	/** Horizontal position in pixels. */
	x: number;
	/** Vertical position in pixels. */
	y: number;
	/** Width of the node in pixels. */
	width: number;
	/** Height of the node in pixels. */
	height: number;
}

// ── Main reflow dispatcher ───────────────────────────────────────────────

/**
 * Recalculate positions for all SmartArt nodes based on the current
 * layout type and node structure.
 *
 * This function computes visually reasonable positions for the 5 most
 * common layout types. It does not aim for pixel-perfect PowerPoint
 * fidelity, but produces clean, well-spaced layouts.
 *
 * Returns an array of `PptxSmartArtDrawingShape` entries that can be
 * set on `data.drawingShapes` to update the visual layout, or returns
 * `undefined` if the layout type is not supported for reflow.
 *
 * @param data - SmartArt data model with nodes, connections, and layout type.
 * @param bounds - Container bounding box on the slide.
 * @returns Array of positioned drawing shapes, or undefined.
 */
export function reflowSmartArtLayout(
	data: PptxSmartArtData,
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] | undefined {
	const nodes = getContentNodes(data.nodes);
	if (nodes.length === 0) {
		return undefined;
	}

	const layoutType: SmartArtLayoutType =
		data.resolvedLayoutType ?? resolveLayoutCategory(data.layoutType);

	switch (layoutType) {
		case 'list':
			return reflowList(nodes, bounds);
		case 'process':
			return reflowProcess(nodes, bounds);
		case 'hierarchy':
			return reflowHierarchy(data.nodes, bounds);
		case 'cycle':
			return reflowCycle(nodes, bounds);
		case 'matrix':
			return reflowMatrix(nodes, bounds);
		case 'pyramid':
			return reflowPyramid(nodes, bounds);
		case 'funnel':
			return reflowFunnel(nodes, bounds);
		case 'target':
			return reflowTarget(nodes, bounds);
		case 'gear':
			return reflowGear(nodes, bounds);
		case 'venn':
			return reflowVenn(nodes, bounds);
		case 'timeline':
			return reflowTimeline(nodes, bounds);
		case 'relationship':
			return reflowRelationship(nodes, bounds);
		case 'chevron':
			return reflowChevron(nodes, bounds);
		case 'bending':
			return reflowBending(nodes, bounds);
		default:
			// For unknown layout types, fall back to list
			return reflowList(nodes, bounds);
	}
}

// ── Basic reflow implementations ─────────────────────────────────────────

/**
 * List layout reflow: distribute nodes vertically with equal spacing.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
function reflowList(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 8;
	const gap = 6;
	const usableW = bounds.width - padding * 2;
	const usableH = bounds.height - padding * 2;
	const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;

	return nodes.map((node, i) => ({
		id: `reflow-list-${node.id}`,
		shapeType: 'roundRect',
		x: bounds.x + padding,
		y: bounds.y + padding + i * (itemH + gap),
		width: usableW,
		height: itemH,
		text: node.text,
		fontSize: Math.max(8, Math.min(11, itemH * 0.4)),
	}));
}

/**
 * Process layout reflow: distribute nodes horizontally with connectors.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
function reflowProcess(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 8;
	const arrowGap = 16;
	const usableW = bounds.width - padding * 2;
	const usableH = bounds.height - padding * 2;
	const nodeW = (usableW - arrowGap * (nodes.length - 1)) / nodes.length;
	const nodeH = usableH * 0.6;
	const yOffset = bounds.y + padding + (usableH - nodeH) / 2;

	const shapes: PptxSmartArtDrawingShape[] = [];

	nodes.forEach((node, i) => {
		const x = bounds.x + padding + i * (nodeW + arrowGap);

		shapes.push({
			id: `reflow-proc-${node.id}`,
			shapeType: 'roundRect',
			x,
			y: yOffset,
			width: nodeW,
			height: nodeH,
			text: node.text,
			fontSize: Math.max(8, Math.min(11, nodeW * 0.12)),
		});

		// Arrow connector between nodes (represented as a small triangle shape)
		if (i < nodes.length - 1) {
			const arrowX = x + nodeW;
			const arrowY = yOffset + nodeH / 2 - 6;
			shapes.push({
				id: `reflow-proc-arrow-${node.id}`,
				shapeType: 'rightArrow',
				x: arrowX,
				y: arrowY,
				width: arrowGap,
				height: 12,
				fillColor: '#94a3b8',
			});
		}
	});

	return shapes;
}

/**
 * Hierarchy layout reflow: recalculate tree positions.
 *
 * @param nodes - All SmartArt nodes (including structural nodes).
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
function reflowHierarchy(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const roots = buildForest(nodes);
	if (roots.length === 0) {
		// Fall back to list if no tree structure
		return reflowList(getContentNodes(nodes), bounds);
	}

	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));
	const padding = 8;
	const usableW = bounds.width - padding * 2;
	const usableH = bounds.height - padding * 2;
	const cellW = usableW / Math.max(totalLeaves, 1);
	const cellH = usableH / Math.max(depth, 1);
	const boxW = Math.min(cellW * 0.8, 140);
	const boxH = Math.min(cellH * 0.35, 28);

	const shapes: PptxSmartArtDrawingShape[] = [];

	// Cap recursion to guard against pathological/malformed input
	const MAX_WALK_DEPTH = 256;

	function walkTree(
		t: { node: PptxSmartArtNode; children: typeof roots },
		xOffset: number,
		level: number,
	): number {
		if (level >= MAX_WALK_DEPTH) {
			return 1;
		}
		const w = treeWidth(t);
		const cx = bounds.x + padding + (xOffset + w / 2) * cellW;
		const cy = bounds.y + padding + level * cellH + cellH / 2;

		shapes.push({
			id: `reflow-hier-${t.node.id}`,
			shapeType: 'roundRect',
			x: cx - boxW / 2,
			y: cy - boxH / 2,
			width: boxW,
			height: boxH,
			text: t.node.text,
			fontSize: Math.max(7, Math.min(10, boxW / 14)),
		});

		let childOffset = xOffset;
		for (const child of t.children) {
			walkTree(child, childOffset, level + 1);
			childOffset += treeWidth(child);
		}
		return w;
	}

	let offset = 0;
	for (const root of roots) {
		offset += walkTree(root, offset, 0);
	}

	return shapes;
}

// ── Layout category resolver ─────────────────────────────────────────────

/**
 * Resolve a raw layout type string to a `SmartArtLayoutType`.
 *
 * Matches keywords in the raw string to determine the most appropriate
 * layout category. Falls back to `"list"` when no match is found.
 *
 * @param layoutType - Raw layout type string from the PPTX data model.
 * @returns Resolved SmartArt layout type.
 */
export function resolveLayoutCategory(layoutType: string | undefined): SmartArtLayoutType {
	if (!layoutType) {
		return 'list';
	}
	const lower = layoutType.toLowerCase();

	if (lower.includes('hierarchy') || lower.includes('org')) {
		return 'hierarchy';
	}
	if (lower.includes('cycle') || lower.includes('radial')) {
		return 'cycle';
	}
	if (lower.includes('funnel')) {
		return 'funnel';
	}
	if (lower.includes('target') || lower.includes('bullseye')) {
		return 'target';
	}
	if (lower.includes('gear') || lower.includes('interlock')) {
		return 'gear';
	}
	if (lower.includes('venn')) {
		return 'venn';
	}
	if (lower.includes('timeline')) {
		return 'timeline';
	}
	if (lower.includes('bending') || lower.includes('snake') || lower.includes('zigzag')) {
		return 'bending';
	}
	if (lower.includes('chevron')) {
		return 'chevron';
	}
	if (lower.includes('relationship')) {
		return 'relationship';
	}
	if (lower.includes('process') || lower.includes('arrow')) {
		return 'process';
	}
	if (lower.includes('matrix')) {
		return 'matrix';
	}
	if (lower.includes('pyramid')) {
		return 'pyramid';
	}
	if (lower.includes('list') || lower.includes('block')) {
		return 'list';
	}

	return 'list';
}
