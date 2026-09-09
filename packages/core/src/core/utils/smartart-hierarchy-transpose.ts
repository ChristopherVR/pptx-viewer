/**
 * SmartArt DiagramML interpreter - hierarchy axis transposition (post-pass).
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `arrangeHierarchy` runs its WHOLE `std`/`tailed` placement algorithm
 * against a `{width: box.height, height: box.width}` "logical" box when
 * `resolveHierarchyOrientation` (that module) detects a transposed
 * hierarchy ("Horizontal Hierarchy" and its siblings), then maps the result
 * back into the real box's coordinate system as a final pass - this module
 * is that pass. See `smartart-hierarchy-orientation.ts`'s own doc comment
 * for why a post-pass, rather than a second mirrored placement code path.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type {
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/** Swap `x`<->`y` (`width`<->`height`, `textX`<->`textY`) for one rendered node. */
function transposeNode(node: RenderedNode): RenderedNode {
	switch (node.kind) {
		case 'rect':
			return {
				...node,
				x: node.y,
				y: node.x,
				width: node.height,
				height: node.width,
				textX: node.textY,
				textY: node.textX,
			};
		case 'circle':
			return {
				...node,
				cx: node.cy,
				cy: node.cx,
				rx: node.ry,
				ry: node.rx,
				textX: node.textY,
				textY: node.textX,
			};
		case 'polygon':
			return {
				...node,
				points: transposePointsString(node.points),
				textX: node.textY,
				textY: node.textX,
			};
	}
}

/** Swap `x,y` -> `y,x` in an SVG `points` attribute string ("x,y x,y ..."). */
function transposePointsString(points: string): string {
	return points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => {
			const [x, y] = pair.split(',');
			return `${y},${x}`;
		})
		.join(' ');
}

/** Swap `x,y` -> `y,x` in every coordinate pair of an SVG path `d` string built only from `M`/`L` commands (every hierarchy connector). */
function transposePathData(d: string): string {
	return d.replace(
		/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/gu,
		(_match, x: string, y: string) => `${y},${x}`,
	);
}

/**
 * Map a whole `SmartArtLayoutResult` computed against a `{width: box.height,
 * height: box.width}` "logical" box back into the real box's coordinate
 * system - see the module doc comment for why this is a post-pass rather
 * than a second `placeStandardTree` code path.
 */
export function transposeResult(
	result: SmartArtLayoutResult,
	realWidth: number,
	realHeight: number,
): SmartArtLayoutResult {
	const nodes = result.nodes.map(transposeNode);
	const connectors: RenderedConnector[] = result.connectors.map((connector) => ({
		...connector,
		d: transposePathData(connector.d),
	}));
	return { ...result, nodes, connectors, viewBox: `0 0 ${realWidth} ${realHeight}` };
}
