/**
 * SmartArt DiagramML interpreter - constraint/ratio resolution helpers.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (which was pushing past
 * the file-size guideline): these read `dgm:constr` entries off a parsed
 * layoutNode and resolve them to a scalar ratio, independent of the
 * arrangement-discovery logic that stayed behind. Pure TypeScript - no
 * framework code, no DOM.
 */

import type { PptxSmartArtConstraint, PptxSmartArtNumericRule } from '../types';

/** Find the first constraint of `type`, optionally restricted to a relationship. */
export function findConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	type: string,
	forRel?: PptxSmartArtConstraint['for'],
): PptxSmartArtConstraint | undefined {
	return constraints?.find(
		(constraint) => constraint.type === type && (forRel === undefined || constraint.for === forRel),
	);
}

/** Read a constraint's ratio (`fact`, or a sub-1 `val`), or `undefined`. */
function constraintRatio(constraint: PptxSmartArtConstraint): number | undefined {
	if (typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)) {
		return Math.max(0, constraint.factor);
	}
	if (
		typeof constraint.value === 'number' &&
		Number.isFinite(constraint.value) &&
		constraint.value >= 0 &&
		constraint.value < 1
	) {
		return constraint.value;
	}
	return undefined;
}

/** Clamp a ratio to a matching `dgm:ruleLst` numeric rule's `max`, when present. */
export function clampByRules(
	value: number,
	rules: PptxSmartArtNumericRule[] | undefined,
	type: string,
): number {
	const rule = rules?.find((entry) => entry.type === type);
	if (rule && typeof rule.max === 'number' && Number.isFinite(rule.max)) {
		return Math.min(value, rule.max);
	}
	return value;
}

/**
 * Resolve a spacing/padding constraint to a *ratio* of the item extent.
 *
 * DiagramML commonly expresses sibling spacing and padding as a factor of a
 * referenced dimension, e.g. `<dgm:constr type="sibSp" refType="w" fact="0.1"/>`.
 * We surface that factor directly. When only a small absolute `val` (< 1) is
 * present we treat it as a ratio too; otherwise the caller's default is used.
 *
 * A `for="ch"` constraint (the child-scoped form real diagrams use for sibling
 * spacing / padding) is preferred over an unscoped one, and the result is capped
 * by any matching `dgm:ruleLst` numeric rule `max` when `rules` is supplied.
 */
export function ratioConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	types: readonly string[],
	fallback: number,
	rules?: PptxSmartArtNumericRule[],
): number {
	for (const type of types) {
		const matches = (constraints ?? []).filter((constraint) => constraint.type === type);
		const ordered = [
			...matches.filter((constraint) => constraint.for === 'ch'),
			...matches.filter((constraint) => constraint.for !== 'ch'),
		];
		for (const constraint of ordered) {
			const ratio = constraintRatio(constraint);
			if (ratio !== undefined) {
				return clampByRules(ratio, rules, type);
			}
		}
	}
	return fallback;
}
