/**
 * SmartArt DiagramML interpreter - compound `presOf axis="ch ..."` per-item
 * role content.
 *
 * Split out of `smartart-layout-interpreter-item-role-shared.ts` (the
 * file-size budget): `contentIds`'s single-token axis branches (`self`/`ch`/
 * `des`/`desOrSelf`) assume ONE data point per role. A compound axis whose
 * FIRST token is `ch` (`Tab List`'s `FirstChild`, `presOf axis="ch desOrSelf"
 * st="1 1" cnt="1 0"`; `Child`, `axis="ch desOrSelf" st="2 1" cnt="0 0"`)
 * instead selects a 1-based POSITION RANGE into the point's own children (via
 * the `ch` token's own `st`/`cnt`), then folds each selected position's
 * descendants in via the second token - the same "named per-child slot"
 * shape `smartart-layout-interpreter-composite-children.ts` resolves for a
 * bare composite wrapper, reused here via {@link positionRange}. Pure
 * TypeScript - no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { positionRange } from './smartart-layout-interpreter-axis-range';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/**
 * A compound `presOf axis="ch desOrSelf"` (or `"ch des"`) role's own content:
 * the FIRST token (`ch`) selects a 1-based POSITION RANGE into `node`'s own
 * children via its own `start`/`count` (`Tab List`'s `FirstChild`, position 1
 * only; `Child`, position 2 onward, unbounded - both reached via the SAME
 * `nodesForEach axis="ch"` as the arranger's own per-point iteration, so
 * `node` here is already the correctly-anchored point), the second token
 * (`des`/`desOrSelf`) folds each selected position's own descendants in
 * alongside it (`desOrSelf` also keeps the position's own text; a bare `des`
 * does not - this corpus has no fixture exercising a compound `des` second
 * token, so it is treated the same as `desOrSelf` rather than guessing a
 * narrower rule). Multiple resolved positions concatenate into ONE role's
 * content (the first position primary, the rest folded), matching the
 * existing single-token `desOrSelf` precedent of folding everything into one
 * box - no gallery fixture currently exercises 2+ remaining positions on the
 * SAME role to verify a per-position split against instead.
 */
export function compoundChildIds(
	role: PptxSmartArtLayoutNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): string[] {
	const axis = role.presentationOf?.axis ?? [];
	const chIndex = axis.indexOf('ch');
	if (chIndex < 0) {
		return [];
	}
	const children = childrenOf.get(node.id) ?? [];
	const start = role.presentationOf?.start?.[chIndex] ?? 1;
	const count = role.presentationOf?.count?.[chIndex];
	const positions = positionRange(start, count, 1, children.length);
	const ids: string[] = [];
	for (const position of positions) {
		const child = children[position - 1];
		if (!child || child.text.trim().length === 0) {
			continue;
		}
		ids.push(
			child.id,
			...smartArtDescendantsWithText(child, childrenOf).map((descendant) => descendant.id),
		);
	}
	return ids;
}
