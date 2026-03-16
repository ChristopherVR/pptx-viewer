/**
 * Stacked SmartArt reflow layout implementations.
 *
 * Contains reflow algorithms for layouts that stack nodes vertically
 * with varying widths: pyramid and funnel.
 *
 * These are "visual reflow" layouts used after editing operations to
 * reposition nodes without requiring the full layout engine.
 *
 * @module smartart-editing-reflow-layouts-stacked
 */

import type { PptxSmartArtNode, PptxSmartArtDrawingShape } from '../types';
import type { ContainerBounds } from './smartart-helpers';

// ── Pyramid ──────────────────────────────────────────────────────────────

/**
 * Pyramid layout reflow: stacked bands from narrow (top) to wide (bottom).
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowPyramid(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 8;
	const gap = 4;
	const usableH = bounds.height - padding * 2;
	const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
	const maxW = bounds.width - padding * 2;

	return nodes.map((node, i) => {
		// Top band is narrowest, bottom is widest
		const widthFraction = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
		const w = maxW * widthFraction;
		const x = bounds.x + (bounds.width - w) / 2;
		const y = bounds.y + padding + i * (bandH + gap);

		return {
			id: `reflow-pyramid-${node.id}`,
			shapeType: 'rect',
			x,
			y,
			width: w,
			height: bandH,
			text: node.text,
			fontSize: Math.max(8, Math.min(11, bandH * 0.4)),
		};
	});
}

// ── Funnel ───────────────────────────────────────────────────────────────

/**
 * Funnel layout reflow: nodes stacked vertically with decreasing width
 * (widest at top, narrowest at bottom).
 *
 * @param nodes - Content nodes to lay out.
 * @param bounds - Container bounding box.
 * @returns Array of positioned drawing shapes.
 */
export function reflowFunnel(
	nodes: PptxSmartArtNode[],
	bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
	const padding = 8;
	const gap = 4;
	const usableH = bounds.height - padding * 2;
	const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
	const maxW = bounds.width - padding * 2;

	return nodes.map((node, i) => {
		// Top band is widest, bottom is narrowest (inverse of pyramid)
		const widthFraction = 1.0 - (i / Math.max(nodes.length - 1, 1)) * 0.7;
		const w = maxW * widthFraction;
		const x = bounds.x + (bounds.width - w) / 2;
		const y = bounds.y + padding + i * (bandH + gap);

		return {
			id: `reflow-funnel-${node.id}`,
			shapeType: 'rect',
			x,
			y,
			width: w,
			height: bandH,
			text: node.text,
			fontSize: Math.max(8, Math.min(11, bandH * 0.4)),
		};
	});
}
