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

/**
 * Split node text on newlines and compute per-line y offsets (in SVG px)
 * that centre the block around the node centre y (offset 0). Single-line
 * text produces one entry with offsetY=0, preserving the existing
 * dominant-baseline="central" behaviour exactly.
 */
export function computeTextLines(
	text: string,
	fontSize: number,
): Array<{ text: string; offsetY: number }> {
	const raw = (text ?? '').split('\n').filter((l) => l.length > 0);
	if (raw.length === 0) {
		return [{ text: '', offsetY: 0 }];
	}
	const lh = fontSize * 1.2;
	const totalH = raw.length * lh;
	return raw.map((line, i) => ({
		text: line,
		offsetY: -totalH / 2 + lh / 2 + i * lh,
	}));
}
