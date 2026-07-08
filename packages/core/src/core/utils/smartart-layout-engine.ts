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
	computeSnakeLayout,
	computeLinearLayout,
	computeHierarchyLayout,
	computeCycleLayout,
	computePyramidLayout,
	computeMatrixLayout,
} from './smartart-layout-engine-algorithms';
import type {
	LayoutAlgorithmType,
	LayoutConstraints,
	LayoutEngineShape,
	ParsedLayoutDef,
} from './smartart-layout-engine-types';

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

	const constraints = layoutDef?.constraints ?? {};

	// Determine the layout algorithm to use.
	// Priority: parsed layout definition > resolved layout type > raw layout type > heuristic
	const algorithmType = layoutDef?.algorithmType;
	const resolvedType = data.resolvedLayoutType;

	// Map algorithm type to layout function
	if (algorithmType && algorithmType !== 'unknown') {
		return computeByAlgorithmType(algorithmType, nodes, constraints, bounds);
	}

	if (resolvedType) {
		return computeByLayoutType(resolvedType, nodes, constraints, bounds);
	}

	// Fall back to heuristic based on raw layoutType string
	const layoutType = resolveLayoutTypeFromString(data.layoutType);
	return computeByLayoutType(layoutType, nodes, constraints, bounds);
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
			text: node?.text,
		};
	});
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Map a parsed algorithm type to a layout function.
 *
 * @param algorithmType - Parsed algorithm type from the layout definition.
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values.
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
function computeByAlgorithmType(
	algorithmType: LayoutAlgorithmType,
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	switch (algorithmType) {
		case 'snake':
			return computeSnakeLayout(nodes, constraints, bounds);
		case 'lin':
			return computeLinearLayout(nodes, constraints, bounds);
		case 'hierChild':
		case 'hierRoot':
			return computeHierarchyLayout(nodes, constraints, bounds);
		case 'cycle':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'pyra':
			return computePyramidLayout(nodes, constraints, bounds);
		case 'tx':
		case 'sp':
			// Text and space algorithms default to linear layout
			return computeLinearLayout(nodes, constraints, bounds);
		case 'composite':
		case 'conn':
			// Composite and connector algorithms default to linear
			return computeLinearLayout(nodes, constraints, bounds);
		default:
			return computeLinearLayout(nodes, constraints, bounds);
	}
}

/**
 * Map a SmartArtLayoutType to a layout function.
 *
 * @param layoutType - Resolved SmartArt layout type.
 * @param nodes - SmartArt nodes to position.
 * @param constraints - Layout constraint values.
 * @param bounds - Container bounding box.
 * @returns Array of positioned shapes.
 */
function computeByLayoutType(
	layoutType: SmartArtLayoutType,
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	switch (layoutType) {
		case 'list':
			return computeLinearLayout(nodes, { ...constraints, aspectRatio: 0.3 }, bounds);
		case 'process':
		case 'chevron':
			return computeLinearLayout(nodes, constraints, bounds);
		case 'cycle':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'hierarchy':
			return computeHierarchyLayout(nodes, constraints, bounds);
		case 'relationship':
		case 'venn':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'matrix':
			return computeMatrixLayout(nodes, constraints, bounds);
		case 'pyramid':
		case 'funnel':
			return computePyramidLayout(nodes, constraints, bounds);
		case 'bending':
			return computeSnakeLayout(nodes, constraints, bounds);
		case 'timeline':
			return computeLinearLayout(nodes, constraints, bounds);
		case 'target':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'gear':
			return computeCycleLayout(nodes, { ...constraints, w: 0.2 }, bounds);
		default:
			return computeLinearLayout(nodes, constraints, bounds);
	}
}

/**
 * Resolve a raw layout type string to a SmartArtLayoutType.
 *
 * @param layoutType - Raw layout type string from the PPTX data model.
 * @returns Resolved SmartArt layout type.
 */
function resolveLayoutTypeFromString(layoutType: string | undefined): SmartArtLayoutType {
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
	if (lower.includes('snake') || lower.includes('bending') || lower.includes('zigzag')) {
		return 'bending';
	}
	if (lower.includes('process') || lower.includes('chevron') || lower.includes('arrow')) {
		return 'process';
	}
	if (lower.includes('venn')) {
		return 'relationship';
	}
	if (lower.includes('matrix')) {
		return 'matrix';
	}
	if (lower.includes('pyramid')) {
		return 'pyramid';
	}
	if (lower.includes('funnel')) {
		return 'funnel';
	}
	if (lower.includes('timeline')) {
		return 'timeline';
	}
	if (lower.includes('target') || lower.includes('bullseye')) {
		return 'target';
	}
	if (lower.includes('gear')) {
		return 'gear';
	}
	if (lower.includes('list') || lower.includes('block')) {
		return 'list';
	}
	if (lower.includes('relationship')) {
		return 'relationship';
	}

	return 'list';
}

/**
 * Get the default shape type for a layout category.
 *
 * @param layoutType - SmartArt layout type.
 * @returns Default shape type string for the given layout.
 */
function getDefaultShapeType(layoutType: SmartArtLayoutType): string {
	switch (layoutType) {
		case 'cycle':
		case 'target':
		case 'gear':
			return 'ellipse';
		case 'relationship':
		case 'venn':
			return 'ellipse';
		case 'chevron':
			return 'chevron';
		case 'pyramid':
		case 'funnel':
			return 'trapezoid';
		case 'timeline':
		case 'bending':
			return 'roundRect';
		default:
			return 'roundRect';
	}
}
