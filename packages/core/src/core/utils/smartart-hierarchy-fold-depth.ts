/**
 * SmartArt DiagramML interpreter - hierarchy per-generation "fold depth"
 * detection.
 *
 * `arrangeHierarchy`'s `std`/`tailed` branches (`smartart-hierarchy-
 * standard.ts`) recurse the ACTUAL data tree to its full depth by default,
 * giving every descendant its own box - correct for the common "Hierarchy"/
 * "Organization Chart" family, whose item template repeats a fresh
 * `hierRoot`/`hierChild` pair at every generation. Some built-in layoutDefs
 * (`hierarchy-list` - uniqueId `hierarchy3`, `Vertical Circle List`) instead
 * declare only ONE generation's worth of per-item layoutNode (e.g.
 * `childText`), whose own `dgm:presOf` is a COMPOUND axis ending in an
 * UNBOUNDED `des`/`desOrSelf` hop (`axis="self desOrSelf" ... cnt="1 0"`,
 * ECMA-376 21.4.7.5's "this point, plus every one of its own descendants,
 * with no depth limit") - a genuine declarative signal that this generation
 * is the LAST one the layout renders its own box for: any deeper descendant
 * folds into that SAME box's text instead of getting a box of its own,
 * matching PowerPoint's own cached drawing (`hierarchy-list--hier5.pptx`:
 * cached 4 text-bearing shapes - root + 3 direct children - the interpreter
 * previously gave a 5th, separate box to a GRANDCHILD one of those three
 * children happened to have).
 *
 * This is a STRUCTURAL property of the layout definition (found once, up
 * front), not a per-node runtime decision: `smartart-hierarchy-standard.ts`'s
 * `placeAt` consults the resulting boolean to stop recursing past the first
 * generation, and the pre-existing `collectFoldedDescendants`/`renderedIds`
 * mechanism in `smartart-interpreter-drawing-bridge.ts` (already used by
 * `lin`/`snake` for the SAME "a descendant added a level deeper via the text
 * pane's Tab/Add Bullet" shape) automatically folds any node this arranger
 * never gave a box to into its nearest rendered ancestor's text - no new
 * text-joining logic needed here, only "stop creating boxes past this
 * depth".
 *
 * Pure decision logic; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** True when `axis`/`count` (from a `dgm:presOf`) ends in an unbounded `des`/`desOrSelf` hop. */
function endsInUnboundedDescendantHop(
	axis: string[] | undefined,
	count: number[] | undefined,
): boolean {
	if (!axis || axis.length === 0) {
		return false;
	}
	const lastIndex = axis.length - 1;
	const lastAxis = axis[lastIndex];
	if (lastAxis !== 'des' && lastAxis !== 'desOrSelf') {
		return false;
	}
	const lastCount = count?.[lastIndex];
	return lastCount === undefined || lastCount === 0;
}

/**
 * Depth-first search of `node`'s whole subtree (mirroring
 * `findHierarchyItemShape`'s traversal) for a per-item layoutNode whose own
 * `presentationOf` ends in an unbounded `des`/`desOrSelf` hop - see the
 * module doc comment.
 */
export function hierarchyLeafFoldsDescendants(node: PptxSmartArtLayoutNode | undefined): boolean {
	if (!node) {
		return false;
	}
	if (endsInUnboundedDescendantHop(node.presentationOf?.axis, node.presentationOf?.count)) {
		return true;
	}
	return (node.children ?? []).some((child) => hierarchyLeafFoldsDescendants(child));
}
