/**
 * SmartArt Layout Engine.
 *
 * Computes shape positions from SmartArt data models WITHOUT relying on
 * pre-computed `drawing*.xml`.  The engine can optionally parse
 * `dgm:layoutDef` XML to extract algorithm type, constraints, and rules,
 * but also works purely from a `PptxSmartArtData` object and a layout type.
 *
 * This is the "Phase 2" layout engine referenced in `PptxSmartArtParser` —
 * it supersedes the heuristic fallback in `smartart-decompose.ts` when
 * richer layout information is available.
 *
 * This module re-exports from focused sub-modules:
 * - `smartart-layout-engine-types` - Public type definitions
 * - `smartart-layout-engine-algorithms` - Core layout algorithms
 * - `smartart-layout-engine-parser` - Layout definition XML parser
 *
 * @module smartart-layout-engine
 */

import type {
	PptxSmartArtData,
	PptxSmartArtNode,
	PptxSmartArtDrawingShape,
	SmartArtLayoutType,
} from '../types';
import type { ContainerBounds } from './smartart-helpers';
import { getContentNodes } from './smartart-helpers';
import {
	computeByAlgorithmType,
	computeByLayoutType,
	getDefaultShapeType,
	resolveLayoutTypeFromString,
} from './smartart-layout-engine-dispatch';
import type { LayoutEngineShape, ParsedLayoutDef } from './smartart-layout-engine-types';
import { applyNodeLayoutRules, evaluateLayoutRules } from './smartart-layout-rule-evaluator';
import { projectSmartArtNodeText } from './smartart-node-text-projection';

// ── Re-exports: types ────────────────────────────────────────────────────

export type {
	LayoutEngineShape,
	LayoutConstraints,
	ParsedLayoutDef,
	LayoutAlgorithmType,
	LayoutRule,
} from './smartart-layout-engine-types';

// ── Re-exports: algorithms ───────────────────────────────────────────────

export {
	computeSnakeLayout,
	computeLinearLayout,
	computeHierarchyLayout,
	computeCycleLayout,
	computePyramidLayout,
	computeMatrixLayout,
} from './smartart-layout-engine-algorithms';

// ── Re-exports: parser ───────────────────────────────────────────────────

export { parseLayoutDefinition } from './smartart-layout-engine-parser';

// ============================================================================
// High-Level Engine Entry Point
// ============================================================================

/**
 * Compute layout positions for all nodes in a SmartArt data model.
 *
 * This is the main entry point for the layout engine.  It selects the
 * appropriate algorithm based on the layout type (from parsed layout
 * definition or resolved SmartArt data) and produces positioned shapes.
 *
 * @param data - SmartArt data model (nodes + connections + layout type).
 * @param bounds - Container bounding box on the slide.
 * @param layoutDef - Optional parsed layout definition for constraint-driven layout.
 * @returns Array of positioned shapes, or undefined if layout cannot be computed.
 */
export function computeSmartArtLayout(
	data: PptxSmartArtData,
	bounds: ContainerBounds,
	layoutDef?: ParsedLayoutDef,
): LayoutEngineShape[] | undefined {
	const nodes = data.nodes;
	if (!nodes || nodes.length === 0) {
		return undefined;
	}

	const contentNodes = getContentNodes(nodes);
	if (contentNodes.length === 0) {
		return undefined;
	}

	const evaluated = evaluateLayoutRules(
		layoutDef?.constraints ?? {},
		layoutDef?.rules ?? [],
		contentNodes,
	);
	const constraints = evaluated.constraints;

	// Determine the layout algorithm to use.
	// Priority: parsed layout definition > resolved layout type > raw layout type > heuristic
	const algorithmType = layoutDef?.algorithmType;
	const resolvedType = data.resolvedLayoutType;

	// Map algorithm type to layout function
	const shapes =
		algorithmType && algorithmType !== 'unknown'
			? computeByAlgorithmType(algorithmType, nodes, constraints, bounds)
			: resolvedType
				? computeByLayoutType(resolvedType, nodes, constraints, bounds)
				: computeByLayoutType(
						resolveLayoutTypeFromString(data.layoutType),
						nodes,
						constraints,
						bounds,
					);
	return applyNodeLayoutRules(shapes, evaluated.nodeConstraints, bounds, constraints);
}

/**
 * Convert layout engine shapes to `PptxSmartArtDrawingShape[]` for integration
 * with the existing SmartArt rendering pipeline.
 *
 * This bridges the layout engine output with the existing decompose/render
 * path that expects `PptxSmartArtDrawingShape` objects.
 *
 * @param engineShapes - Positioned shapes from the layout engine.
 * @param nodes - SmartArt node list for text lookup.
 * @param layoutType - Layout type for default shape selection.
 * @returns Array of drawing shapes compatible with the rendering pipeline.
 */
export function layoutEngineShapesToDrawingShapes(
	engineShapes: LayoutEngineShape[],
	nodes: PptxSmartArtNode[],
	layoutType: SmartArtLayoutType,
): PptxSmartArtDrawingShape[] {
	const nodeMap = new Map<string, PptxSmartArtNode>();
	for (const n of nodes) {
		nodeMap.set(n.id, n);
	}

	return engineShapes.map((shape) => {
		const node = nodeMap.get(shape.nodeId);
		const shapeType = getDefaultShapeType(layoutType);

		return {
			id: `engine-${shape.nodeId}`,
			shapeType,
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
			fontSize: shape.fontSize,
			text: node?.text,
			textSegments: node
				? projectSmartArtNodeText(node, {
						...(shape.fontSize !== undefined ? { fontSize: shape.fontSize * (96 / 72) } : {}),
					})
				: undefined,
		};
	});
}
