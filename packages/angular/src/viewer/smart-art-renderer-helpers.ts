/**
 * Pure narrowing and text-layout helpers for SmartArtRendererComponent.
 * Extracted to keep the component file within the per-file line budget.
 * Re-imported as class-property function references so Angular template
 * type-checking continues to work without changes to the template.
 */
import { smartArtConnectorPaint, smartArtNodeLabel } from '../internal/shared';
import type {
	RenderedCircleNode,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtConnectorPaint,
	SmartArtLayoutResult,
	SmartArtNodeLabel,
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

/**
 * Resolved label descriptors for a layout, index-aligned with `layout.nodes`.
 *
 * The template used to hardcode `fill="white"` and anchor circle labels on
 * `cx`/`cy`, ignoring the descriptor's optional `fontColor` / `fontWeight` /
 * `fontStyle` / `textX` / `textY` / `textAnchor` / `textBaseline`. The shared
 * `smartArtNodeLabel` decides all of it; this only maps the array so the
 * component can expose it as a single `computed()`.
 */
export function layoutNodeLabels(layout: SmartArtLayoutResult): SmartArtNodeLabel[] {
	return layout.nodes.map((node) => smartArtNodeLabel(node));
}

/**
 * Resolved connector paint for a layout, index-aligned with
 * `layout.connectors`. The template used to hardcode the grey default, which
 * flattened the per-node colours target leaders and timeline stems carry.
 */
export function layoutConnectorPaints(layout: SmartArtLayoutResult): SmartArtConnectorPaint[] {
	return layout.connectors.map((connector) => smartArtConnectorPaint(connector));
}
