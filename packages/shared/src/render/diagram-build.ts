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
 * `p:bldDgm/@bld="one"` is itself ambiguous between PowerPoint's "One by One"
 * and "By branch, one by one" Effect Options: both are legal authoring choices
 * that write the same generic `one` token, and the diagram's OWN default hint
 * - `dgm:presLayoutVars/dgm:animOne` / `dgm:animLvl` (parsed into
 * `PptxSmartArtPresLayoutVars.animateOne` / `.animationLevel`) - is what
 * disambiguates which one PowerPoint actually plays. `resolveDiagramBuildMode`
 * (`animation-build.ts`) cannot make that call: it only sees the animation
 * token, never the diagram's own layout data. So {@link revealedSmartArtNodeCount}
 * takes the presLayoutVars hint as a THIRD, optional argument and refines the
 * generic `byOne`/`byLvl` mode before falling through to the plain per-node
 * cadence:
 *  - `animateOne === 'branch'`         group the reveal by top-level branch
 *                                      (one whole root-to-leaf branch per
 *                                      stage) instead of node-by-node.
 *  - `animateOne === 'one' | 'chOne'`  the diagram is authored to build as a
 *                                      single object ("As One Object"/"All at
 *                                      once" in the Effect Options), so every
 *                                      node reveals together, same as `asOne`.
 *  - `animationLevel === 'lvl'`        reveal a whole level per stage, same as
 *                                      `byLvlAtOnce`.
 * A more specific EXPLICIT token (`lvlOne`/`lvlAtOnce`, i.e. `build.mode` is
 * already `byLvl`/`byLvlAtOnce`) is the author's own unambiguous choice and is
 * never second-guessed by the diagram's default hint.
 *
 * @module render/diagram-build
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars } from 'pptx-viewer-core';

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

/** Top-level ancestor id (branch root) of every node, walked from its `parentId` chain. */
function nodeBranchRoots(nodes: readonly PptxSmartArtNode[]): string[] {
	const byId = new Map<string, PptxSmartArtNode>();
	for (const node of nodes) {
		byId.set(node.id, node);
	}
	return nodes.map((node) => {
		let current = node;
		const seen = new Set<string>();
		while (current.parentId && !seen.has(current.id)) {
			seen.add(current.id);
			const parent = byId.get(current.parentId);
			if (!parent) {
				break;
			}
			current = parent;
		}
		return current.id;
	});
}

/** Reveal count for a whole-level-per-stage build (`byLvlAtOnce`, or `animLvl='lvl'`). */
function revealedByLevel(nodes: readonly PptxSmartArtNode[], progress: number): number {
	const levels = nodeLevels(nodes);
	const uniqueLevels = [...new Set(levels)].sort((a, b) => a - b);
	const shownLevels = revealedStageCount(progress, uniqueLevels.length);
	if (shownLevels >= uniqueLevels.length) {
		return nodes.length;
	}
	const allowed = new Set(uniqueLevels.slice(0, shownLevels));
	return levels.filter((level) => allowed.has(level)).length;
}

/**
 * Reveal count for a whole-branch-per-stage build (`animOne='branch'`, PowerPoint's
 * "By branch, one by one"). Each top-level root and its whole subtree count as one
 * stage, in document order.
 */
function revealedByBranch(nodes: readonly PptxSmartArtNode[], progress: number): number {
	const roots = nodeBranchRoots(nodes);
	const order: string[] = [];
	const seen = new Set<string>();
	for (const root of roots) {
		if (!seen.has(root)) {
			seen.add(root);
			order.push(root);
		}
	}
	const shownBranches = revealedStageCount(progress, order.length);
	if (shownBranches >= order.length) {
		return nodes.length;
	}
	const allowed = new Set(order.slice(0, shownBranches));
	return roots.filter((root) => allowed.has(root)).length;
}

/**
 * Number of leading nodes to reveal for a diagram build at `progress`.
 *
 * Returns `nodes.length` for `asOne` or a fully-revealed build, `0` at progress
 * `0`. For `byLvlAtOnce` the count spans every node whose level falls within the
 * revealed leading levels (assuming the node list is level-ordered, as SmartArt
 * document order is).
 *
 * @param presLayoutVars - Optional diagram default-build hint
 *   (`dgm:presLayoutVars.animOne`/`.animLvl`) that refines an ambiguous
 *   `byOne`/`byLvl` mode; see the module doc comment. Ignored for the already
 *   fully-explicit `asOne`/`byLvlAtOnce` modes.
 */
export function revealedSmartArtNodeCount(
	nodes: readonly PptxSmartArtNode[],
	build: DiagramBuildState,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
): number {
	if (build.mode === 'asOne' || nodes.length === 0) {
		return nodes.length;
	}

	if (build.mode === 'byLvlAtOnce') {
		return revealedByLevel(nodes, build.progress);
	}

	// byOne / byLvl: refine the generic per-node cadence with the diagram's own
	// default-build hint, when one is present (see module doc comment).
	if (build.mode === 'byOne' || build.mode === 'byLvl') {
		if (presLayoutVars?.animateOne === 'branch') {
			return revealedByBranch(nodes, build.progress);
		}
		if (presLayoutVars?.animateOne === 'one' || presLayoutVars?.animateOne === 'chOne') {
			return nodes.length;
		}
		if (presLayoutVars?.animationLevel === 'lvl') {
			return revealedByLevel(nodes, build.progress);
		}
	}

	// byOne / byLvl with no disambiguating hint: one node per stage.
	return revealedStageCount(build.progress, nodes.length);
}
