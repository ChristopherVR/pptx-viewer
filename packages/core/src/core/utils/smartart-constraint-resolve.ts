/**
 * SmartArt DiagramML interpreter - constraint reference-chain resolution.
 *
 * Split out of `smartart-constraint-solver.ts` (the repo's per-file line
 * budget): that module builds the `ConstraintIndex`, this module walks it -
 * resolving a `dgm:constr`'s own literal `val`/`fact`, or, when it carries a
 * `refType`/`refFor`/`refForName`/`refPtType`, following the reference chain
 * depth-first (with cycle and missing-target protection) until a literal
 * value is reached. See `smartart-constraint-solver.ts`'s own module doc
 * comment for the full targeting/degradation rules this implements.
 *
 * Pure graph/geometry code; no framework code, no DOM.
 */

import type { PptxSmartArtConstraint } from '../types';
import type { ConstraintIndex, IndexedConstraint } from './smartart-constraint-solver';
import { entryKey, hasReference, targetRole } from './smartart-constraint-solver';

function finite(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** A constraint's own literal `val`/`fact` (no reference involved). */
function literalValue(constraint: PptxSmartArtConstraint): number | undefined {
	if (finite(constraint.factor)) {
		return constraint.factor;
	}
	if (finite(constraint.value)) {
		return constraint.value;
	}
	return undefined;
}

/** Apply a resolved reference's factor, then any `gte`/`lte` bound against `val`. */
function combine(constraint: PptxSmartArtConstraint, referenced: number): number {
	const factor = finite(constraint.factor) ? constraint.factor : 1;
	let result = referenced * factor;
	if (finite(constraint.value)) {
		if (constraint.operator === 'gte') {
			result = Math.max(result, constraint.value);
		} else if (constraint.operator === 'lte') {
			result = Math.min(result, constraint.value);
		}
	}
	return result;
}

/** Exposed for `smartart-constraint-declared-by.ts` (see `IndexedConstraint`). */
export function resolveEntry(
	index: ConstraintIndex,
	entry: IndexedConstraint,
	visiting: Set<string>,
): number | undefined {
	const { constraint, declaringRole } = entry;
	if (!hasReference(constraint)) {
		const literal = literalValue(constraint);
		if (literal !== undefined) {
			return literal;
		}
		// A bare `t`/`l` (no `val`/`fact`/`ref*` at all - `basic-target--
		// flat3.pptx`'s composite declares `<dgm:constr type="t" for="ch"
		// forName="text1"/>` for its FIRST stacked label) anchors the role at
		// the box's own top/left edge: round 39 measured `text2`/`text3`'s own
		// `t` as a CHAIN off this one (`refType="b" refFor="ch" refForName=
		// "text1"`), which only resolves at all once `text1`'s own `t` is a
		// real number to add `h` to - ECMA-376 gives no other value a
		// content-free position constraint could sensibly mean.
		if (constraint.type === 't' || constraint.type === 'l') {
			return 0;
		}
		return undefined;
	}
	// Arranger-declared (`for="ch" forName="X"`), no EXPLICIT refFor/refForName/
	// refPointType, but its OWN fact/val: an axis-scale hint, not a cross-role
	// reference (`balance--hier5.pptx`'s `left_40_1`, `refType="w" fact="0.365"`
	// = "0.365 * box width", never "childrenComposite's own w" - usually
	// undeclared, so the walk below silently dropped every `balance` slot).
	// `literal !== undefined` matters: `outerBox` (`refType="w"`, no fact/val,
	// `nested-target--hier5.pptx`) means "inherit the arranger's own w" -
	// nothing to degrade to, so it still falls through to the walk.
	const hasExplicitRefTarget =
		constraint.referenceFor !== undefined ||
		constraint.referenceForName !== undefined ||
		constraint.referencePointType !== undefined;
	const literal = literalValue(constraint);
	const isArrangerDeclared = targetRole(constraint, declaringRole) !== declaringRole;
	if (isArrangerDeclared && !hasExplicitRefTarget && literal !== undefined) {
		return literal;
	}
	const refType = constraint.referenceType ?? constraint.type;
	const refRole = targetRole(
		{
			for: constraint.referenceFor,
			forName: constraint.referenceForName,
			pointType: constraint.referencePointType,
		},
		declaringRole,
	);
	const referenced = resolveInternal(index, refRole, refType, visiting);
	if (referenced === undefined) {
		// Unresolvable reference: degrade to this entry's own literal `val` (a
		// bound alongside an unresolved ref) when it carries one, else give up.
		return finite(constraint.value) ? constraint.value : undefined;
	}
	return combine(constraint, referenced);
}

function resolveInternal(
	index: ConstraintIndex,
	role: string,
	type: string,
	visiting: Set<string>,
): number | undefined {
	const k = entryKey(role, type);
	if (visiting.has(k)) {
		return undefined; // Cycle: degrade rather than recurse forever.
	}
	const candidates = index.entries.get(k);
	if (!candidates || candidates.length === 0) {
		// The root layoutNode's own w/h is the implicit whole-diagram unit that
		// every scalar `fact` is ultimately expressed against, and it is never
		// itself declared as a constraint.
		if (role === index.rootRole && (type === 'w' || type === 'h')) {
			return 1;
		}
		// `b`/`r` (the far edge) are geometric IDENTITIES of a role's own near
		// edge plus its extent (`b = t + h`, `r = l + w`), not separate
		// authored quantities - a real constraint set commonly REFERENCES a
		// sibling's own `b`/`r` (`basic-target--flat3.pptx`'s `text2.t =
		// refType="b" refFor="ch" refForName="text1"`) without ever declaring
		// that role's `b`/`r` directly. Derive it from the SAME role's `t`/`h`
		// (or `l`/`w`) when nothing declares it outright.
		if (type === 'b' || type === 'r') {
			const nearType = type === 'b' ? 't' : 'l';
			const sizeType = type === 'b' ? 'h' : 'w';
			visiting.add(k);
			try {
				const near = resolveInternal(index, role, nearType, visiting);
				const size = resolveInternal(index, role, sizeType, visiting);
				if (near !== undefined && size !== undefined) {
					return near + size;
				}
			} finally {
				visiting.delete(k);
			}
		}
		return undefined;
	}
	visiting.add(k);
	try {
		for (const candidate of candidates) {
			const value = resolveEntry(index, candidate, visiting);
			if (value !== undefined) {
				return value;
			}
		}
		return undefined;
	} finally {
		visiting.delete(k);
	}
}

/**
 * Resolve the value a role's constraint of `type` ultimately carries, walking
 * any `refType`/`refFor`/`refForName` chain. Returns `undefined` when nothing
 * declares it, a reference cannot be resolved, or resolution would cycle - the
 * caller is expected to fall back to its own default in every such case.
 */
export function resolveConstraint(
	index: ConstraintIndex,
	role: string,
	type: string,
): number | undefined {
	return resolveInternal(index, role, type, new Set());
}
