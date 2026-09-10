/**
 * SmartArt DiagramML interpreter - hierarchy dispatch `linDir`/`hierAlign`
 * fallback resolution.
 *
 * `discoverArrangement` (`smartart-layout-interpreter-model.ts`, Track L/S
 * territory) falls back to the choose-WRAPPING node itself when a genuine
 * org-chart-family layoutDef's `hierRoot`/`hierChild` algorithm is reached
 * only by evaluating a `dgm:choose`, not as a direct `layoutNode` child
 * (`hierarchy-list--hier5.pptx`/`horizontal-labeled-hierarchy--hier5.pptx`:
 * see `smartart-track-r-successor.md` SESSION 34/36 for the full derivation).
 * That fallback node's OWN `.algorithm` field stays `undefined` (never
 * mutated - hierarchy code elsewhere depends on the EXACT node reference
 * reaching `arrangeHierarchy` unchanged), so `algorithmParam(algorithmNode,
 * 'linDir')` reads nothing for it even though the node's own `dgm:choose`
 * carries the real value.
 *
 * The OUTERMOST `hierChild`'s own `linDir` is NOT a safe "whole tree hangs"
 * signal on its own: the plain "Hierarchy"/"Circle Picture Hierarchy"/
 * "Labeled Hierarchy" family also wraps `hierChild1`'s alg in an identical
 * `dir=norm/rev`-mirroring `dgm:choose` declaring `linDir="fromL"/"fromR"`
 * at EVERY generation (`hierChild1`, `hierChild2`, ...) purely to flip fan
 * order left/right - NOT to hang anything (`hierRoot1`'s own children are
 * just its render template, no NESTED `hierChild` inside it at all; the next
 * generation's `hierChildN` is a SIBLING of `hierRootN`, both children of
 * the SAME enclosing `forEach`, not nested under the root). A genuinely
 * hanging construct (`hierarchy-list`/`horizontal-labeled-hierarchy`) instead
 * nests its OWN "children of root" `hierChild` STRICTLY BELOW a `hierRoot`
 * node (`hierarchy-list--hier5.pptx`'s `root(hierRoot) -> childShape
 * (hierChild, linDir=fromT)`; `horizontal-labeled-hierarchy--hier5.pptx`'s
 * `Name17(hierRoot) -> hierChild2(hierChild, linDir=fromT)` the identical
 * shape, one level per generation) - so this module searches specifically
 * for a `hierChild` found BELOW the tree's own first `hierRoot`, never the
 * outermost wrapper's own `linDir` directly, keeping the plain fanning
 * family's `fromL`/`fromR` mirror-only value from ever being misread as a
 * hang signal.
 *
 * Resolved independently here (Track R territory only - no edit to
 * `smartart-layout-interpreter-model.ts` needed, unlike the WeakMap approach
 * a prior round attempted and reverted). A fixture whose relevant node
 * already carries a real `.algorithm` (every non-choose-wrapped hierarchy
 * fixture) resolves identically either way - `branchMode`'s existing
 * decision is unaffected for them.
 */

import type {
	PptxSmartArtLayoutAlgorithm,
	PptxSmartArtLayoutNode,
	PptxSmartArtPresLayoutVars,
} from '../types';
import { chooseAlgorithm } from './smartart-layout-interpreter-choose-algorithm';

interface FoundAlgorithm {
	node: PptxSmartArtLayoutNode;
	algorithm: PptxSmartArtLayoutAlgorithm;
}

/**
 * The `hierChild` found strictly BELOW the tree's own first `hierRoot` (the
 * "children of root" generation, per the module doc comment) - `undefined`
 * when the tree declares no `hierRoot` at all, or that `hierRoot` nests no
 * `hierChild` (the plain fanning family - see the module doc comment).
 */
function findNestedChildAlgorithm(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): FoundAlgorithm | undefined {
	const root = findFirst(algorithmNode, 'hierRoot', nodeCount, presLayoutVars, new Set());
	if (!root) {
		return undefined;
	}
	for (const child of root.node.children ?? []) {
		const found = findFirst(child, 'hierChild', nodeCount, presLayoutVars, new Set());
		if (found) {
			return found;
		}
	}
	return undefined;
}

/** See the module doc comment. */
export function resolveHierarchyDispatchLinDir(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): string | undefined {
	const found = findNestedChildAlgorithm(algorithmNode, nodeCount, presLayoutVars);
	return found?.algorithm.parameters?.find((param) => param.type === 'linDir')?.value;
}

/** See {@link resolveHierarchyDispatchLinDir}; the SAME nested `hierChild`'s `chAlign` param. */
export function resolveHierarchyDispatchChAlign(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): string | undefined {
	const found = findNestedChildAlgorithm(algorithmNode, nodeCount, presLayoutVars);
	return found?.algorithm.parameters?.find((param) => param.type === 'chAlign')?.value;
}

/**
 * The tree's own root item's `hierAlign` param (e.g. `tL`/`tR`), found by a
 * depth-first search below `algorithmNode` for the first `hierRoot`-typed
 * node (direct `.algorithm`, or its own `dgm:choose` resolved). `undefined`
 * when nothing resolves - see the module doc comment for why a false
 * negative here is always safe.
 */
export function resolveHierarchyRootAlign(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): string | undefined {
	const found = findFirst(algorithmNode, 'hierRoot', nodeCount, presLayoutVars, new Set());
	return found?.algorithm.parameters?.find((param) => param.type === 'hierAlign')?.value;
}

function effectiveAlgorithm(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): PptxSmartArtLayoutAlgorithm | undefined {
	if (node.algorithm) {
		return node.algorithm;
	}
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	return chooseAlgorithm(node, nodeCount, { presLayoutVars });
}

/** Depth-first, first-match search for a node whose effective algorithm type is `type`. */
function findFirst(
	node: PptxSmartArtLayoutNode | undefined,
	type: string,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	visited: Set<PptxSmartArtLayoutNode>,
): FoundAlgorithm | undefined {
	if (!node || visited.has(node)) {
		return undefined;
	}
	visited.add(node);
	const algorithm = effectiveAlgorithm(node, nodeCount, presLayoutVars);
	if (algorithm?.type === type) {
		return { node, algorithm };
	}
	for (const child of node.children ?? []) {
		const found = findFirst(child, type, nodeCount, presLayoutVars, visited);
		if (found) {
			return found;
		}
	}
	return undefined;
}
