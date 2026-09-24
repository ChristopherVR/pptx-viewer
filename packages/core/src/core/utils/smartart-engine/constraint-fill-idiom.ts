/**
 * The `ctrX`/`w` (or `ctrY`/`h`) "fill and centre" idiom (ECMA-376 Part 1,
 * 21.4.2.x `dgm:constr`), split out of `constraint-eval.ts` to keep that file
 * under the repo's per-file line budget.
 *
 * A composite child's size/position types (`w`, `h`, `l`, `t`, `r`, `b`,
 * `ctrX`, `ctrY`) are ordinarily genuine absolute lengths in the same
 * millimetre convention `constraint-eval.ts` applies to every other bare
 * literal (e.g. Gear's `gear1srcNode`/`gear1dstNode` anchor points declare
 * `w val="1"` / `h val="1"` alongside an `l`/`t`/`r` position - a real, tiny
 * ~2.83pt marker box the `conn` algorithm routes a connector through;
 * treating that pair as anything else regresses Gear's measured geometry).
 * But when a `constrLst` declares BOTH a centre (`ctrX`/`ctrY`) AND its
 * paired size (`w`/`h`) as bare literals for the SAME target (no
 * `l`/`t`/`r`/`b` at all) - real "Basic Pyramid"'s layout1.xml:
 * `<dgm:constr type="ctrX" for="ch" forName="level" val="1"/>` beside
 * `<dgm:constr type="w" for="ch" forName="level" val="1"/>` (and the same
 * pairing for `ctrY`/`h`, and for `acctBkgd`/`acctTx`) - no consistent
 * absolute-length reading of `val="1"` can produce "fill the box": `ctrX = w`
 * under ANY single unit conversion places the box from `w/2` to `3w/2`, never
 * centred edge-to-edge. COM-verified against Basic Pyramid, the actual
 * rendered "level" band fills its WHOLE slot, which is exactly the composite
 * algorithm's own DEFAULT for an unconstrained child (`compositeChildBoxes`'s
 * `resolveSize`/`resolveAxis` fall back to the preferred/full size when
 * nothing is set) - so this idiom is read as "a fraction of the declaring
 * node's own already-resolved size" per axis, the same convention the legacy
 * family interpreter independently derived (`resolveRatioConstraint` /
 * `smartart-constraint-ratio-fallback.ts`) and `alg-cycle.ts`'s own
 * `resolveGapRatio`: a literal `val` in `[0, 1)` is that fraction; `val >= 1`
 * (including the pyramid's own redundant `val="1"`, which just restates the
 * composite's default) does not correspond to any valid fraction and is
 * treated as unconstrained, falling back to the algorithm's natural sizing -
 * a no-op that matches COM output exactly.
 *
 * Scanning the whole 229-fixture gallery corpus for this exact `ctrX`+`w`
 * (or `ctrY`+`h`) bare-literal pairing finds it ONLY in `basic-pyramid--*`
 * and `inverted-pyramid--*`, so this reading never touches Gear's anchor
 * points, the numbered linear arrow process's own hairline connector (`h
 * val="0.002"`, which has no `ctrX`/`ctrY` peer and so keeps the ordinary
 * millimetre reading - 0.002mm, still an effectively-invisible line), or any
 * other fixture's `w`/`h`/`l`/`t`/`r`/`b`/`ctrX`/`ctrY` literal.
 */

import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

/**
 * `ctrX` and `w` size the SAME (horizontal) axis; `ctrY` and `h` size the
 * vertical axis. Used to detect the idiom: a centre type's paired size type,
 * and vice versa.
 */
const AXIS_AND_PEER: ReadonlyMap<string, { peer: string; horizontal: boolean }> = new Map([
	['ctrX', { peer: 'w', horizontal: true }],
	['w', { peer: 'ctrX', horizontal: true }],
	['ctrY', { peer: 'h', horizontal: false }],
	['h', { peer: 'ctrY', horizontal: false }],
]);

/**
 * Whether `constraint` (a `ctrX`/`w`/`ctrY`/`h` bare literal) has a matching
 * bare-literal peer declared for the SAME `for`/`forName`/`ptType` target in
 * `node`'s own `constrLst`. Only then is the literal read as a fraction
 * (via {@link fillIdiomFraction}) rather than a length.
 */
export function hasFillIdiomPeer(node: EngineNode, constraint: LdConstraint): boolean {
	const peerType = AXIS_AND_PEER.get(constraint.type)?.peer;
	if (!peerType) {
		return false;
	}
	return node.constraints.some(
		(other) =>
			other !== constraint &&
			other.type === peerType &&
			other.for === constraint.for &&
			other.forName === constraint.forName &&
			other.ptType === constraint.ptType &&
			other.refType === 'none' &&
			other.hasVal,
	);
}

/**
 * `constraint`'s bare literal `val`, read as a fraction of `node`'s (the
 * declaring node's) own already-resolved size on that axis. Only call this
 * once {@link hasFillIdiomPeer} confirms the idiom applies: a fraction in
 * `[0, 1)`, or `undefined` when `val` is out of that range (no valid
 * fraction, hence unconstrained) or the declaring node's own size isn't
 * resolved yet.
 */
export function fillIdiomFraction(node: EngineNode, constraint: LdConstraint): number | undefined {
	if (constraint.val < 0 || constraint.val >= 1) {
		return undefined;
	}
	const reference = AXIS_AND_PEER.get(constraint.type)?.horizontal
		? node.values.get('w')
		: node.values.get('h');
	return reference === undefined ? undefined : constraint.val * reference;
}
