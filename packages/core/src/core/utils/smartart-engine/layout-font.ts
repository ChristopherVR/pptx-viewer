/**
 * Font sizes as the LAYOUT sees them, before the output stage fits text
 * (`font-groups.ts`). A node's font is known during layout only inside a
 * text-driven font search (`font-search.ts`): the search fixes a candidate
 * size on the nodes its `dgm:rule type="primFontSz"` addresses
 * (`EngineNode.forcedFontPt`), and every other node reaches that size
 * through its own `refType="primFontSz"`/`"secFontSz"` links ("Vertical
 * Bullet List"'s `childText` follows `parentText`; "Horizontal Bullet
 * List"'s `desTx` sizes by its `secFontSz`, which equals `parTx`'s
 * `primFontSz`). Outside a search every function here answers `undefined`
 * and font-relative lengths stay deferred, exactly as before.
 */

import type { EngineNode } from './engine-node';

const FONT_REFS = new Set(['primFontSz', 'secFontSz']);

/** A folded / bullet paragraph's size relative to the primary one. */
const SECONDARY_SCALE = 0.78;

/**
 * The font-size variable a node's text is sized by: `primFontSz`, unless the
 * node declares `<dgm:constr type="primFontSz" refType="secFontSz"/>` on
 * itself, in which case its text follows its own `secFontSz` and the
 * `secFontSz` rules ("Basic Pyramid"'s `acctTx` accent column: no
 * `primFontSz` rule at all, a `secFontSz` rule down to 5pt, cached at 35pt
 * instead of the 65pt start).
 */
export function sizingVariable(node: EngineNode): 'primFontSz' | 'secFontSz' {
	const linked = node.deferred.some(
		(d) => d.type === 'primFontSz' && d.refType === 'secFontSz' && d.ref === node,
	);
	return linked ? 'secFontSz' : 'primFontSz';
}

/** The size (points) `node`'s text is laid out at during a font search, if known. */
export function layoutFontOf(
	node: EngineNode,
	seen: Set<EngineNode> = new Set(),
): number | undefined {
	if (node.forcedFontPt !== undefined) {
		return node.forcedFontPt;
	}
	if (seen.has(node)) {
		return undefined;
	}
	seen.add(node);
	const variable = sizingVariable(node);
	for (const d of node.deferred) {
		if (d.type !== variable || d.ref === node || !FONT_REFS.has(d.refType)) {
			continue;
		}
		if (d.op !== 'none' && d.op !== 'equ') {
			continue;
		}
		const base = layoutFontRef(d.ref, d.refType, seen);
		if (base !== undefined) {
			return base * d.fact;
		}
	}
	return undefined;
}

/** `ref`'s value of font variable `refType` during a search (a primary-sized node's `secFontSz` is `round(0.78 x primFontSz)`). */
export function layoutFontRef(
	ref: EngineNode,
	refType: string,
	seen: Set<EngineNode> = new Set(),
): number | undefined {
	const size = layoutFontOf(ref, seen);
	if (size === undefined) {
		return undefined;
	}
	if (refType === 'secFontSz' && sizingVariable(ref) === 'primFontSz') {
		return Math.max(1, Math.round(size * SECONDARY_SCALE));
	}
	return size;
}
