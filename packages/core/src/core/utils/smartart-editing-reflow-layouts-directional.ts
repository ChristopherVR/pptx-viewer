/**
 * Directional/flow SmartArt reflow layout implementations.
 *
 * Contains reflow algorithms for layouts that use directional or
 * sequential flow arrangements: timeline, relationship,
 * chevron, and bending/snake.
 *
 * These are "visual reflow" layouts used after editing operations to
 * reposition nodes without requiring the full layout engine.
 *
 * @module smartart-editing-reflow-layouts-directional
 */

import type { PptxSmartArtNode, PptxSmartArtDrawingShape } from '../types';
import type { ContainerBounds } from './smartart-helpers';

// ── Timeline ─────────────────────────────────────────────────────────────

/**
 * Timeline layout reflow: nodes along a horizontal line with
 * alternating above/below placement.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowTimeline(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 24;
	const lineY = bounds.y + bounds.height / 2;
	const lineStartX = bounds.x + padding;
	const lineEndX = bounds.x + bounds.width - padding;
	const lineLen = lineEndX - lineStartX;
	const nodeW = Math.max(40, Math.min(80, lineLen / (nodes.length * 1.2)));
	const nodeH = nodeW * 0.5;
	const labelOffset = Math.min(bounds.height * 0.28, 40);

	const shapes: PptxSmartArtDrawingShape[] = [];

	// Add the timeline bar as a thin rectangle
	shapes.push({
		id: 'reflow-timeline-bar',
		shapeType: 'rect',
		x: lineStartX,
		y: lineY - 2,
		width: lineLen,
		height: 4,
		fillColor: '#94a3b8',
	});

	nodes.forEach((node, i) => {
		const x =
			nodes.length === 1
				? (lineStartX + lineEndX) / 2
				: lineStartX + (i / (nodes.length - 1)) * lineLen;
		const above = i % 2 === 0;
		const ny = above ? lineY - labelOffset - nodeH / 2 : lineY + labelOffset - nodeH / 2;

		shapes.push({
			id: `reflow-timeline-${node.id}`,
			shapeType: 'roundRect',
			x: x - nodeW / 2,
			y: ny,
			width: nodeW,
			height: nodeH,
			text: node.text,
			fontSize: Math.max(6, Math.min(10, nodeW * 0.1)),
		});
	});

	return shapes;
}

// ── Relationship ─────────────────────────────────────────────────────────

/**
 * Relationship layout reflow: nodes with bidirectional arrows.
 * For 2 nodes: side-by-side with double-headed arrow.
 * For 3+: arranged in a circle with connectors.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowRelationship(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const shapes: PptxSmartArtDrawingShape[] = [];

	if (nodes.length <= 2) {
		// Side by side with bidirectional arrow
		const padding = 16;
		const arrowGap = 24;
		const usableW = bounds.width - padding * 2 - arrowGap;
		const nodeW = usableW / nodes.length;
		const nodeH = bounds.height * 0.5;
		const yOffset = bounds.y + (bounds.height - nodeH) / 2;

		nodes.forEach((node, i) => {
			shapes.push({
				id: `reflow-rel-${node.id}`,
				shapeType: 'roundRect',
				x: bounds.x + padding + i * (nodeW + arrowGap),
				y: yOffset,
				width: nodeW,
				height: nodeH,
				text: node.text,
				fontSize: Math.max(8, Math.min(11, nodeW * 0.1)),
			});
		});

		// Add arrow between nodes
		if (nodes.length === 2) {
			const arrowX = bounds.x + padding + nodeW;
			const arrowY = yOffset + nodeH / 2 - 6;
			shapes.push({
				id: 'reflow-rel-arrow',
				shapeType: 'leftRightArrow',
				x: arrowX,
				y: arrowY,
				width: arrowGap,
				height: 12,
				fillColor: '#94a3b8',
			});
		}
	} else {
		// Circle arrangement with connectors
		const size = Math.min(bounds.width, bounds.height);
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		const radius = size * 0.3;
		const nodeW = Math.max(size * 0.16, Math.min(size * 0.24, 250 / nodes.length));
		const nodeH = nodeW * 0.6;

		nodes.forEach((node, i) => {
			const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
			const nx = cx + radius * Math.cos(angle) - nodeW / 2;
			const ny = cy + radius * Math.sin(angle) - nodeH / 2;

			shapes.push({
				id: `reflow-rel-${node.id}`,
				shapeType: 'roundRect',
				x: nx,
				y: ny,
				width: nodeW,
				height: nodeH,
				text: node.text,
				fontSize: Math.max(7, Math.min(10, nodeW * 0.1)),
			});
		});
	}

	return shapes;
}

// ── Chevron ──────────────────────────────────────────────────────────────

/**
 * Chevron layout reflow: arrow-shaped nodes flowing horizontally.
 * Each node is a chevron/arrow shape pointing right.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowChevron(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 8;
	const gap = 4;
	const usableW = bounds.width - padding * 2;
	const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
	const itemH = Math.min(bounds.height - padding * 2, 60);
	const yOffset = bounds.y + (bounds.height - itemH) / 2;

	return nodes.map((node, i) => {
		const x = bounds.x + padding + i * (itemW + gap);

		return {
			id: `reflow-chevron-${node.id}`,
			shapeType: 'chevron',
			x,
			y: yOffset,
			width: itemW,
			height: itemH,
			text: node.text,
			fontSize: Math.max(7, Math.min(11, itemW * 0.1)),
		};
	});
}

// ── Bending / Snake ──────────────────────────────────────────────────────

/**
 * Bending / Snake layout reflow: nodes in a serpentine path.
 * Nodes flow left-to-right, then right-to-left on the next row, etc.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowBending(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const COLS = 4;
	const padding = 8;
	const gap = 6;
	const rows = Math.ceil(nodes.length / COLS);
	const usableW = bounds.width - padding * 2;
	const usableH = bounds.height - padding * 2;
	const cellW = (usableW - gap * (COLS - 1)) / COLS;
	const cellH = (usableH - gap * (rows - 1)) / Math.max(rows, 1);
	const boxW = cellW * 0.85;
	const boxH = Math.min(cellH * 0.7, 40);

	const shapes: PptxSmartArtDrawingShape[] = [];

	nodes.forEach((node, i) => {
		const row = Math.floor(i / COLS);
		const colInRow = i % COLS;
		// Reverse direction on odd rows (serpentine)
		const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;

		const nodeCx = bounds.x + padding + col * (cellW + gap) + cellW / 2;
		const nodeCy = bounds.y + padding + row * (cellH + gap) + cellH / 2;

		shapes.push({
			id: `reflow-bending-${node.id}`,
			shapeType: 'roundRect',
			x: nodeCx - boxW / 2,
			y: nodeCy - boxH / 2,
			width: boxW,
			height: boxH,
			text: node.text,
			fontSize: Math.max(7, Math.min(10, boxW * 0.1)),
		});

		// Add arrow connector to next node
		if (i < nodes.length - 1) {
			const nextRow = Math.floor((i + 1) / COLS);
			const nextColInRow = (i + 1) % COLS;
			const nextCol = nextRow % 2 === 0 ? nextColInRow : COLS - 1 - nextColInRow;
			const nextCx = bounds.x + padding + nextCol * (cellW + gap) + cellW / 2;
			const nextCy = bounds.y + padding + nextRow * (cellH + gap) + cellH / 2;

			if (nextRow === row) {
				// Horizontal arrow
				const dir = nextCx > nodeCx ? 1 : -1;
				const arrowX = dir > 0 ? nodeCx + boxW / 2 : nextCx + boxW / 2;
				const arrowW = Math.abs(nextCx - nodeCx) - boxW;
				shapes.push({
					id: `reflow-bending-arrow-${node.id}`,
					shapeType: dir > 0 ? 'rightArrow' : 'leftArrow',
					x: arrowX,
					y: nodeCy - 4,
					width: Math.max(arrowW, 4),
					height: 8,
					fillColor: '#94a3b8',
				});
			} else {
				// Vertical arrow (row transition)
				const arrowY = nodeCy + boxH / 2;
				const arrowH = Math.abs(nextCy - nodeCy) - boxH;
				shapes.push({
					id: `reflow-bending-arrow-${node.id}`,
					shapeType: 'downArrow',
					x: nodeCx - 4,
					y: arrowY,
					width: 8,
					height: Math.max(arrowH, 4),
					fillColor: '#94a3b8',
				});
			}
		}
	});

	return shapes;
}
