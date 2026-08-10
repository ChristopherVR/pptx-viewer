/**
 * Pure narrowing and text-layout helpers for SmartArtRendererComponent.
 * Extracted to keep the component file within the per-file line budget.
 * Re-imported as class-property function references so Angular template
 * type-checking continues to work without changes to the template.
 */
import type {
	RenderedCircleNode,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
} from '../internal/shared';

/** Narrow a RenderedNode to a circle, or undefined. */
export function narrowToCircle(node: RenderedNode): RenderedCircleNode | undefined {
	return node.kind === 'circle' ? node : undefined;
}

/** Narrow a RenderedNode to a polygon, or undefined. */
export function narrowToPolygon(node: RenderedNode): RenderedPolygonNode | undefined {
	return node.kind === 'polygon' ? node : undefined;
}

/** Narrow a RenderedNode to a rect, or undefined. */
export function narrowToRect(node: RenderedNode): RenderedRectNode | undefined {
	return node.kind === 'rect' ? node : undefined;
}
