/**
 * `diagram-build`: staged SmartArt reveal (`p:bldDgm` / `a:bldDgm`) projection.
 *
 * Maps the playback-time diagram {@link DiagramBuildMode} + progress to the
 * number of leading nodes a staged SmartArt renderer should reveal. The renderer
 * slices its node list (and, for the precomputed-drawing path, its shape list)
 * to that prefix, so later nodes stay hidden until the build advances.
 *
 *  - `byOne` / `byLvl`  reveal one node at a time (count = node count).
 *  - `byLvlAtOnce`      reveal a whole level per stage (count = level count);
 *                       the returned node count spans the revealed levels.
 *  - `asOne`            reveal everything at once.
 *
 * `byOne` and `byLvl` share the same one-node-per-stage cadence here: the OOXML
 * distinction is traversal ordering, which the node list already encodes in
 * document order, so a leading-prefix reveal honours both.
 *
 * @module render/diagram-build
 */

import type { PptxSmartArtNode } from 'pptx-viewer-core';

import { revealedStageCount } from './animation-build';
import type { DiagramBuildMode } from './animation-timeline-types';

/** The diagram variant of a playback-time build state. */
export interface DiagramBuildState {
	mode: DiagramBuildMode;
	/** 0..1 fraction of the build revealed at the current playback time. */
	progress: number;
}

/** Depth (0-based) of every node, walked from its `parentId` chain. */
function nodeLevels(nodes: readonly PptxSmartArtNode[]): number[] {
	const byId = new Map<string, PptxSmartArtNode>();
	for (const node of nodes) {
		byId.set(node.id, node);
	}
	return nodes.map((node) => {
		let depth = 0;
		let current: PptxSmartArtNode | undefined = node;
		const seen = new Set<string>();
		while (current?.parentId && !seen.has(current.id)) {
			seen.add(current.id);
			const parent = byId.get(current.parentId);
			if (!parent) {
				break;
			}
			depth++;
			current = parent;
		}
		return depth;
	});
}

/**
 * Number of leading nodes to reveal for a diagram build at `progress`.
 *
 * Returns `nodes.length` for `asOne` or a fully-revealed build, `0` at progress
 * `0`. For `byLvlAtOnce` the count spans every node whose level falls within the
 * revealed leading levels (assuming the node list is level-ordered, as SmartArt
 * document order is).
 */
export function revealedSmartArtNodeCount(
	nodes: readonly PptxSmartArtNode[],
	build: DiagramBuildState,
): number {
	if (build.mode === 'asOne' || nodes.length === 0) {
		return nodes.length;
	}

	if (build.mode === 'byLvlAtOnce') {
		const levels = nodeLevels(nodes);
		const uniqueLevels = [...new Set(levels)].sort((a, b) => a - b);
		const shownLevels = revealedStageCount(build.progress, uniqueLevels.length);
		if (shownLevels >= uniqueLevels.length) {
			return nodes.length;
		}
		const allowed = new Set(uniqueLevels.slice(0, shownLevels));
		return levels.filter((level) => allowed.has(level)).length;
	}

	// byOne / byLvl: one node per stage.
	return revealedStageCount(build.progress, nodes.length);
}
