/**
 * Hanging org-chart branches: a `hierRoot` aligned to one corner of its rows
 * (`hierAlign="tL"`/`"tR"`) whose rows are vertical columns (`hierChild`
 * `linDir="fromT"`) hangs those columns below the node, inset toward the
 * aligned side, instead of fanning them.
 *
 * The built-in org charts spell every hanging case out in their own
 * choose/if blocks rather than leaving it to the algorithm: `hierBranch`
 * `l`/`r` select `hierAlign="tR"`/`"tL"` plus a `fromT` column, and the
 * default `init` does the same for a node whose descendants are all leaves
 * (`axis="des" func="maxDepth" op="lte" val="1"`). "Name and Title
 * Organization Chart" leaves that `init` branch on the plain fan, and its
 * cached drawing indeed stacks Node Five straight below Node Two.
 *
 * Geometry, measured on the gallery's cached "Organization Chart" drawings
 * (hier5: Node Five under Node Two; hier8: Branch C Root under Branch B
 * Grandchild): the column's near edge sits exactly `0.25 x` the parent
 * node's width in from the parent's own edge (the legacy interpreter's
 * `HIER_TAIL_OFFSET_RATIO`, COM-verified across every `hierBranch` value),
 * one `sp` below the node. Siblings pack by outline (`hier-shape.ts`), so
 * the column juts past its parent without widening the parent's row.
 */

import type { EngineNode } from './engine-node';

/** The hanging column's inset from the parent node's near edge, as a fraction of the node's width. */
export const HANG_OFFSET_RATIO = 0.25;

/** Whether a `hierChild` row runs as a vertical column. */
export function isColumn(row: EngineNode): boolean {
	const linDir = row.alg.params.linDir;
	return linDir === 'fromT' || linDir === 'fromB';
}
