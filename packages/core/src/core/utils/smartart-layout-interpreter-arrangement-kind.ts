/**
 * SmartArt DiagramML interpreter - arrangement-kind types/constants.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (the file-size budget):
 * `ArrangementKind`/`ArrangementPlan`/`PRIMARY_ALG`/`STRUCTURAL_ARRANGEMENT_KINDS`/
 * `isMeaningfulAux`, re-exported from that module so every existing import
 * site is unaffected. Pure types/constants; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** Arrangement families the interpreter can execute. */
export type ArrangementKind =
	| 'linear'
	| 'cycle'
	| 'hierarchy'
	| 'pyramid'
	| 'snake'
	| 'composite'
	| 'conn'
	| 'spacer'
	| 'text';

/** The arranger `layoutNode` plus the resolved arrangement family. */
export interface ArrangementPlan {
	kind: ArrangementKind;
	/** The `layoutNode` carrying the arrangement algorithm + its constraints. */
	node: PptxSmartArtLayoutNode;
}

/** Map a non-hierarchy `dgm:alg` type to an arrangement family. */
export const PRIMARY_ALG: Readonly<Record<string, ArrangementKind>> = {
	lin: 'linear',
	cycle: 'cycle',
	pyra: 'pyramid',
	snake: 'snake',
	composite: 'composite',
	conn: 'conn',
	sp: 'spacer',
	tx: 'text',
};

/**
 * Kinds driven by a real point-flow algorithm (preferred over conn/sp/tx),
 * and where every arranged point gets its own item box from a shared
 * per-item template - so `smartart-layout-interpreter-item-roles.ts`'s
 * multi-role expansion (a list layout's `childText`, a card layout's
 * `roleText`/`bodyText`, ...) applies uniformly to all four. `hierarchy` and
 * `composite` are excluded: hierarchy gives each node's own box independent
 * per-depth treatment, and a top-level `composite` arranger maps points 1:1
 * onto EXPLICIT named slots rather than repeating one item template.
 */
export const STRUCTURAL_ARRANGEMENT_KINDS = new Set<ArrangementKind>([
	'linear',
	'cycle',
	'pyramid',
	'snake',
]);

/**
 * True when a `conn`/`sp`/`tx` node carries enough to arrange as a standalone
 * primary (constraints or children). A bare leaf is meaningless on its own, so
 * the interpreter declines and the caller keeps its legacy approximation.
 */
export function isMeaningfulAux(node: PptxSmartArtLayoutNode): boolean {
	return (node.constraints?.length ?? 0) > 0 || (node.children?.length ?? 0) > 0;
}
