/**
 * SmartArt DiagramML interpreter - relative-constraint ratio fallback.
 *
 * Split out of `smartart-constraint-solver.ts` to keep that file under the
 * repo's per-file line budget: this is the `resolveRatioConstraint` drop-in
 * replacement for a bare `ratioConstraint(...)` scalar-literal scan, layered
 * on top of the general `ConstraintIndex` machinery there.
 */

import type { PptxSmartArtConstraint, PptxSmartArtNumericRule } from '../types';
import { entryKey, hasReference, resolveConstraint } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { clampByRules, ratioConstraint } from './smartart-layout-interpreter-model';

/**
 * Resolve a relative-only fallback for the ratio-style constraint types a
 * flow arranger already scans literally (`sibSp`/`sp`/`begPad`/`endPad`, and
 * the pyramid/snake gap ratio). Only considers `type`s that have at least one
 * REFERENCE-bearing declaration for `role`: a pure-literal declaration is the
 * existing scalar path's job (`ratioConstraint`), and re-interpreting it here
 * without that path's ratio-vs-absolute magnitude check would risk treating an
 * absolute value (e.g. a point margin) as a fraction.
 */
function resolveReferencedRatio(
	index: ConstraintIndex,
	role: string,
	types: readonly string[],
	rules: PptxSmartArtNumericRule[] | undefined,
): number | undefined {
	for (const type of types) {
		const candidates = index.entries.get(entryKey(role, type));
		if (!candidates?.some((entry) => hasReference(entry.constraint))) {
			continue;
		}
		const resolved = resolveConstraint(index, role, type);
		if (resolved !== undefined) {
			return clampByRules(resolved, rules, type);
		}
	}
	return undefined;
}

/**
 * Drop-in replacement for a bare `ratioConstraint(...)` call: tries the exact
 * same literal scan first (so every already-passing behaviour is unchanged),
 * then falls back to resolving a relative constraint declared for `role`
 * before giving up to `fallback`.
 */
export function resolveRatioConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	index: ConstraintIndex,
	role: string,
	types: readonly string[],
	fallback: number,
	rules?: PptxSmartArtNumericRule[],
): number {
	const literal = ratioConstraint(constraints, types, Number.NaN, rules);
	if (!Number.isNaN(literal)) {
		return literal;
	}
	const relative = resolveReferencedRatio(index, role, types, rules);
	return relative ?? fallback;
}
