/**
 * `diagram-drawing-shape-reveal`: staged reveal projection for the
 * PRE-COMPUTED `dsp:` drawing shapes a SmartArt element caches
 * (`smartArtData.drawingShapes`), as opposed to `diagram-build.ts`'s
 * `resolveRevealedSmartArtNodes`, which projects the NODE tree consumed by
 * the shared layout-engine fallback path.
 *
 * Every binding's SmartArt renderer prefers the cached drawing when present
 * (it is PowerPoint's own layout output), so a staged `p:bldDgm` build must
 * reveal it too. Two reveal strategies, exactly mirroring `diagram-build.ts`:
 *
 *  - **Authored-index** (`resolveRevealedDrawingShapes` given a
 *    `DiagramRevealDescriptor`): each shape is mapped back to its source node
 *    id via `resolveDrawingShapeNodeId` and kept only when that node id is in
 *    the revealed set; a shape that cannot be mapped to any node (background /
 *    connector decoration) is always kept, since it carries no node identity
 *    of its own to gate on. This is exact, but only as exact as
 *    `resolveDrawingShapeNodeId`'s best-effort mapping is.
 *  - **Count-based fallback** (no descriptor, only `state.build`): the shape
 *    list has no per-node identity to filter by, so it is trimmed to a
 *    proportional PREFIX (`shownNodeCount / totalNodes` of the shape count),
 *    same as every binding computed inline before this module existed.
 *
 * @module render/diagram-drawing-shape-reveal
 */

import type { PptxSmartArtDrawingShape, PptxSmartArtNode } from 'pptx-viewer-core';

import type { ElementAnimationState } from './animation-timeline-types';
import { revealedSmartArtNodeCount } from './diagram-build';
import { resolveDrawingShapeNodeId } from './smartart-inline-edit';

/**
 * Number of leading drawing shapes to reveal for a COUNT-BASED partial
 * diagram build, kept proportional to the revealed node prefix so the shapes
 * appear in step with the nodes.
 */
function proportionalShapeCount(
	shownNodes: number,
	totalNodes: number,
	totalShapes: number,
): number {
	return Math.ceil((shownNodes / Math.max(totalNodes, 1)) * totalShapes);
}

/**
 * Resolve the cached drawing shapes revealed at the current playback state,
 * preferring the authored-index {@link DiagramRevealDescriptor}
 * (`state.diagramReveal`) over the count-based `state.build` when both are
 * available, and revealing every shape when neither applies. Every binding's
 * SmartArt element renderer calls this in place of hand-rolling the
 * proportional-count slice.
 */
export function resolveRevealedDrawingShapes(
	shapes: readonly PptxSmartArtDrawingShape[],
	nodes: readonly PptxSmartArtNode[],
	state: Pick<ElementAnimationState, 'build' | 'diagramReveal'> | undefined,
): PptxSmartArtDrawingShape[] {
	if (shapes.length === 0) {
		return [];
	}

	if (state?.diagramReveal) {
		const { nodeIds } = state.diagramReveal.descriptor;
		return shapes.filter((shape, index) => {
			const nodeId = resolveDrawingShapeNodeId(shape, index, shapes, nodes);
			// A shape with no resolvable node id is structural chrome (a
			// connector decoration, background, ...): always shown, since it
			// carries no per-node identity of its own to gate on.
			return nodeId === undefined || nodeIds.has(nodeId);
		});
	}

	if (state?.build?.kind === 'diagram') {
		const shownNodeCount = revealedSmartArtNodeCount(nodes, state.build);
		if (shownNodeCount >= nodes.length) {
			return shapes.slice();
		}
		return shapes.slice(0, proportionalShapeCount(shownNodeCount, nodes.length, shapes.length));
	}

	return shapes.slice();
}

/**
 * Node id for each REVEALED drawing shape, index-aligned with `revealed`.
 *
 * The ids are resolved over the FULL cached shape list, never over the
 * revealed subset: `resolveDrawingShapeNodeId` maps by position whenever the
 * shape count equals the node count, and a partially revealed subset breaks
 * that alignment (with one node shown, the first rendered shape is whichever
 * node the authored reveal named, not the first node). Resolving over the
 * full list, then picking ids by shape identity (the reveal filters the same
 * objects, see {@link resolveRevealedDrawingShapes}), keeps the tag correct
 * for every reveal state. Every binding stamps its `data-smartart-node-id`
 * (and looks up its a11y label) through this.
 */
export function resolveRevealedDrawingShapeNodeIds(
	allShapes: readonly PptxSmartArtDrawingShape[],
	revealed: readonly PptxSmartArtDrawingShape[],
	nodes: readonly PptxSmartArtNode[],
): (string | undefined)[] {
	const byShape = new Map<PptxSmartArtDrawingShape, string | undefined>();
	for (const [index, shape] of allShapes.entries()) {
		byShape.set(shape, resolveDrawingShapeNodeId(shape, index, allShapes, nodes));
	}
	return revealed.map((shape, index) => {
		if (byShape.has(shape)) {
			return byShape.get(shape);
		}
		// A shape not taken from `allShapes` (a caller built its own list): fall
		// back to resolving it in the list it was handed.
		return resolveDrawingShapeNodeId(shape, index, revealed, nodes);
	});
}
