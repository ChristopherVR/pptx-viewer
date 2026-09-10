/**
 * SmartArt DiagramML interpreter - row count for the `mode==='hanging'`
 * forest, honouring `foldDeeperGenerations` (see `smartart-hierarchy-fold-
 * depth.ts`'s own module doc comment).
 *
 * `placeHangingTree`/`placeHangingForest` (`smartart-hierarchy-hanging.ts`)
 * stop recursing into a node's own ordinary children once `level >= 1` when
 * `foldDeeperGenerations` is set - the SAME "no per-generation item template
 * past the root's direct children" signal `smartart-hierarchy-standard.ts`'s
 * `placeAt` already consults, ported here so the `hanging` branch produces
 * the SAME rendered row SET the `std`/`tailed` branches already do for this
 * class of layout (`hierarchy-list--hier5.pptx`: cached 4 text-bearing
 * shapes - root + 3 direct children - not 5, the raw data-node count).
 *
 * `fitHangingBox` (`smartart-hierarchy-hanging-box.ts`) needs this SAME
 * count up front to size each row against the box (its own `rows` param),
 * before `placeHangingForest` has run - this module is the single source
 * both consult, so the two can never disagree on how many rows actually get
 * placed. Mirrors `placeHangingTree`/`placeAssistants`'s own traversal
 * exactly (one row per node placed there, none for a folded descendant): a
 * node placed at `level >= 1` under a fold never recurses into ITS OWN
 * ordinary children (matching `placeHangingTree`'s post-assistants fold
 * check), but assistants themselves are always counted (`placeAssistants`
 * places every assistant regardless of fold, and never recurses into an
 * assistant's own children either way - see that function's own doc
 * comment).
 *
 * Pure counting; no framework code, no DOM.
 */

import type { TreeNode } from './smartart-helpers';
import { partitionChildren } from './smartart-hierarchy-orgchart-tree';

function countRows(t: TreeNode, level: number, orgChart: boolean, fold: boolean): number {
	const { assistants, normal } = partitionChildren(t, orgChart);
	let count = 1 + assistants.length;
	if (normal.length === 0) {
		return count;
	}
	if (fold && level >= 1) {
		return count;
	}
	for (const child of normal) {
		count += countRows(child, level + 1, orgChart, fold);
	}
	return count;
}

/**
 * Total rendered row count across the whole forest - see the module doc
 * comment. Matches `placeHangingForest`'s own row-per-node output exactly.
 */
export function countHangingRows(roots: TreeNode[], orgChart: boolean, fold: boolean): number {
	return roots.reduce((sum, root) => sum + countRows(root, 0, orgChart, fold), 0);
}
