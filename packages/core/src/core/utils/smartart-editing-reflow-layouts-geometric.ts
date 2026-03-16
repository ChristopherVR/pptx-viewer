/**
 * Geometric SmartArt reflow layout implementations.
 *
 * Contains reflow algorithms for layouts that use geometric or spatial
 * arrangements: cycle (circular), matrix (grid), venn (overlapping circles),
 * target (concentric rings), and gear (interlocking gears).
 *
 * These are "visual reflow" layouts used after editing operations to
 * reposition nodes without requiring the full layout engine.
 *
 * @module smartart-editing-reflow-layouts-geometric
 */

import type { PptxSmartArtNode, PptxSmartArtDrawingShape } from '../types';
import type { ContainerBounds } from './smartart-helpers';

// ── Cycle ────────────────────────────────────────────────────────────────

/**
 * Cycle layout reflow: distribute nodes around a circle.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowCycle(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const size = Math.min(bounds.width, bounds.height);
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const radius = size * 0.32;
	const nodeW = Math.max(size * 0.18, Math.min(size * 0.28, 300 / nodes.length));
	const nodeH = nodeW * 0.6;

	return nodes.map((node, i) => {
		const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle) - nodeW / 2;
		const ny = cy + radius * Math.sin(angle) - nodeH / 2;

		return {
			id: `reflow-cycle-${node.id}`,
			shapeType: 'ellipse',
			x: nx,
			y: ny,
			width: nodeW,
			height: nodeH,
			text: node.text,
			fontSize: Math.max(7, Math.min(10, nodeW * 0.1)),
		};
	});
}

// ── Matrix ───────────────────────────────────────────────────────────────

/**
 * Matrix layout reflow: place nodes in a grid pattern.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowMatrix(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const cols = Math.ceil(Math.sqrt(nodes.length));
	const rows = Math.ceil(nodes.length / cols);
	const padding = 8;
	const gap = 6;
	const usableW = bounds.width - padding * 2;
	const usableH = bounds.height - padding * 2;
	const cellW = (usableW - gap * (cols - 1)) / cols;
	const cellH = (usableH - gap * (rows - 1)) / rows;

	return nodes.map((node, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);

		return {
			id: `reflow-matrix-${node.id}`,
			shapeType: 'roundRect',
			x: bounds.x + padding + col * (cellW + gap),
			y: bounds.y + padding + row * (cellH + gap),
			width: cellW,
			height: cellH,
			text: node.text,
			fontSize: Math.max(8, Math.min(11, Math.min(cellW, cellH) * 0.12)),
		};
	});
}

// ── Target ───────────────────────────────────────────────────────────────

/**
 * Target / Bullseye layout reflow: concentric rings with nodes.
 * Outermost ring is the first node, innermost is the last.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowTarget(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const size = Math.min(bounds.width, bounds.height);
	const maxRadius = size * 0.45;

	return nodes.map((node, i) => {
		// Outermost ring first, innermost last
		const radiusFraction = 1.0 - i / nodes.length;
		const r = maxRadius * radiusFraction;
		const diameter = r * 2;

		return {
			id: `reflow-target-${node.id}`,
			shapeType: 'ellipse',
			x: cx - r,
			y: cy - r,
			width: diameter,
			height: diameter,
			text: node.text,
			fontSize: Math.max(7, Math.min(10, r * 0.15)),
		};
	});
}

// ── Gear ─────────────────────────────────────────────────────────────────

/**
 * Gear layout reflow: interlocking gear shapes in a triangular arrangement.
 * Up to 3 main gears with extra nodes listed to the side.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowGear(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const gearNodes = nodes.slice(0, 3);
	const extraNodes = nodes.slice(3);
	const gearAreaW = extraNodes.length > 0 ? bounds.width * 0.7 : bounds.width;
	const gearAreaH = bounds.height;
	const _cx = bounds.x + gearAreaW / 2;
	const cy = bounds.y + gearAreaH / 2;
	const spacing = gearAreaW / (gearNodes.length + 1);
	const gearR = Math.min(spacing * 0.4, gearAreaH * 0.35);
	const gearDiameter = gearR * 2;

	const shapes: PptxSmartArtDrawingShape[] = [];

	gearNodes.forEach((node, i) => {
		// Position gears: first and third at same height, second shifted down
		const gx = bounds.x + spacing * (i + 1);
		const gy = cy + (i % 2 === 0 ? 0 : gearR * 0.35);

		shapes.push({
			id: `reflow-gear-${node.id}`,
			shapeType: 'ellipse',
			x: gx - gearR,
			y: gy - gearR,
			width: gearDiameter,
			height: gearDiameter,
			text: node.text,
			fontSize: Math.max(7, Math.min(10, gearR * 0.15)),
		});
	});

	// Extra nodes as small labels to the right
	const labelH = 20;
	const labelGap = 6;
	const labelW = bounds.width - gearAreaW - 16;
	const labelStartX = bounds.x + gearAreaW + 8;
	const labelStartY = bounds.y + (bounds.height - extraNodes.length * (labelH + labelGap)) / 2;

	extraNodes.forEach((node, i) => {
		shapes.push({
			id: `reflow-gear-extra-${node.id}`,
			shapeType: 'roundRect',
			x: labelStartX,
			y: labelStartY + i * (labelH + labelGap),
			width: Math.max(labelW, 30),
			height: labelH,
			text: node.text,
			fontSize: Math.max(7, Math.min(10, 10)),
		});
	});

	return shapes;
}

// ── Venn ─────────────────────────────────────────────────────────────────

/**
 * Venn layout reflow: overlapping circles for 2-4 nodes,
 * horizontal row for 5+.
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowVenn(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const size = Math.min(bounds.width, bounds.height);

	if (nodes.length <= 4) {
		const r = size * 0.22;
		const spread = r * 0.6;

		return nodes.map((node, i) => {
			const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
			const nx = cx + spread * Math.cos(angle) - r;
			const ny = cy + spread * Math.sin(angle) - r;

			return {
				id: `reflow-venn-${node.id}`,
				shapeType: 'ellipse',
				x: nx,
				y: ny,
				width: r * 2,
				height: r * 2,
				text: node.text,
				fontSize: Math.max(7, Math.min(10, r * 0.1)),
			};
		});
	}

	// Horizontal row of circles for 5+ nodes
	const r = Math.min(size * 0.15, bounds.width / (nodes.length * 1.5));
	const totalW = nodes.length * r * 2;
	const startX = cx - totalW / 2 + r;

	return nodes.map((node, i) => ({
		id: `reflow-venn-${node.id}`,
		shapeType: 'ellipse',
		x: startX + i * r * 2 - r,
		y: cy - r,
		width: r * 2,
		height: r * 2,
		text: node.text,
		fontSize: Math.max(6, Math.min(9, r * 0.1)),
	}));
}
