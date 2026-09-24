/**
 * Per-node font-size resolution for the per-point layout engine's output
 * stage. Not a full implementation of ECMA-376's deferred font-linked
 * constraints (`constraint-eval.ts`'s `FONT_TYPES` deferral); this resolves
 * the common case (a literal `primFontSz` ceiling declared on the node
 * itself or inherited via a non-deferred constraint) and falls back to a
 * fixed default otherwise, then fits it to the node's own box net of its
 * resolved margins.
 *
 * All arithmetic here is in POINTS, matching the engine's internal
 * coordinate space (`constraint-eval.ts`'s literal-length conversion); the
 * caller converts the result to pixels once, at the same point it converts
 * geometry.
 */

import { fitFontSize } from '../smartart-layout-style-helpers';
import type { EngineNode } from './engine-node';

/** Default font-size ceiling (points) when no `primFontSz` constraint resolved. */
const DEFAULT_CEILING_PT = 18;

/** Default per-side margin (points) when no `*Marg` constraint resolved. */
const DEFAULT_MARGIN_PT = 4;

function marginPt(node: EngineNode, near: string, far: string): number {
	const a = node.values.get(near);
	const b = node.values.get(far);
	if (a === undefined && b === undefined) {
		return DEFAULT_MARGIN_PT * 2;
	}
	return (a ?? 0) + (b ?? 0);
}

/**
 * Resolve `node`'s font size in POINTS for `text`, fitted to its own box
 * (already laid out) net of its resolved `lMarg`/`rMarg`/`tMarg`/`bMarg`.
 */
export function resolveEngineFontSizePt(node: EngineNode, text: string): number {
	const box = node.box;
	if (!box) {
		return DEFAULT_CEILING_PT;
	}
	const ceiling = node.values.get('primFontSz') ?? DEFAULT_CEILING_PT;
	const netW = Math.max(1, box.w - marginPt(node, 'lMarg', 'rMarg'));
	const netH = Math.max(1, box.h - marginPt(node, 'tMarg', 'bMarg'));
	return fitFontSize(text || ' ', netW, netH, ceiling);
}
