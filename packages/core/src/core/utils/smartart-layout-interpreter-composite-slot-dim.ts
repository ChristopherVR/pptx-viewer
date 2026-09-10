/**
 * SmartArt DiagramML interpreter - single-constraint dimension resolution.
 *
 * Split out of `smartart-layout-interpreter-composite-slots.ts` (the repo's
 * per-file line budget): {@link dimOf} resolves ONE `dgm:constr` `type` (self-
 * declared on the slot, or arranger-declared via `dimDeclaredBy`) to pixels
 * or an absolute raw; `readSlots` there calls it once per axis. Pure
 * geometry; no framework code.
 */

import type { PptxSmartArtConstraint } from '../types';
import {
	firstConstraintDeclaredBy,
	resolveConstraintDeclaredBy,
} from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { findConstraint } from './smartart-layout-interpreter-model';
import type { BoundingBox } from './smartart-layout-types';

/** A single resolved dimension, either box-relative pixels or an absolute raw. */
export interface Dim {
	/** Resolved pixels (from a `fact`, or a sub-1 `val` treated as a fraction). */
	px?: number;
	/** Raw absolute `val` (> 1); normalised later against the other slots. */
	abs?: number;
}

/** Pick the extent a constraint's `factor` multiplies, honouring `referenceType`. */
function axisExtent(referenceType: string | undefined, box: BoundingBox, fallback: number): number {
	if (referenceType === 'w') {
		return box.width;
	}
	if (referenceType === 'h') {
		return box.height;
	}
	return fallback;
}

/** Default axis extent for a constraint type when no `referenceType` is given. */
function defaultExtent(type: string, box: BoundingBox): number {
	return type === 'h' || type === 't' || type === 'ctrY' || type === 'b' ? box.height : box.width;
}

/**
 * True cross-role reference: `refFor`/`refForName` name ANOTHER layoutNode
 * (as opposed to omitted/`self`, which the existing `referenceType`-vs-box-axis
 * handling below already covers).
 */
function isCrossRoleReference(constraint: PptxSmartArtConstraint): boolean {
	return (
		(constraint.referenceFor === 'ch' || constraint.referenceFor === 'des') &&
		Boolean(constraint.referenceForName)
	);
}

/**
 * A slot's `type` dimension as declared by the ARRANGER (the composite
 * node's own `for="ch" forName="<slot role>"` constraint), for when the
 * slot's OWN constrLst says nothing - real built-ins (`gear`, `balance`,
 * `stacked-venn`, Meet the Team's `compNode`) position slots this way almost
 * exclusively, self-declared slot geometry being the rarer case. Mirrors the
 * self-declared branch's fraction/absolute-raw split: `resolveConstraintDeclaredBy`
 * already walks the reference chain (so a slot positioned relative to a
 * SIBLING slot, e.g. `t` = sibling's resolved `b`, resolves here too), this
 * only adds the axis (`w`/`h`) the resulting dimensionless number scales
 * against, from the declaring constraint's own `refType`.
 *
 * `declaringRole` is normally the ONE nearest enclosing arranger's role - but
 * a bare pass-through node with no `constrLst` of its own (`linV`, reached
 * inside `linH`'s own `for="des"`-declared `h`/`primFontSz` for `parTx`/
 * `desTx`, while `linV` itself separately declares their `w` via its OWN
 * `for="ch"`) can sit BETWEEN a role and the ancestor that actually declares
 * one of its dimensions - see `smartart-layout-interpreter-composite-
 * candidates.ts`'s `declaringRoleChain` (round 32). Accepting a chain
 * (nearest-first) and trying each in turn recovers that outer declaration
 * without discarding the nearer one for any `type` it DOES own. A plain
 * `string` (every pre-existing caller) is the same as a one-element chain.
 */
function dimDeclaredBy(
	role: string,
	type: string,
	declaringRole: string | readonly string[],
	box: BoundingBox,
	index: ConstraintIndex,
): Dim | undefined {
	const chain = typeof declaringRole === 'string' ? [declaringRole] : declaringRole;
	for (const candidateRole of chain) {
		const declared = firstConstraintDeclaredBy(index, role, type, candidateRole);
		if (!declared) {
			continue;
		}
		const resolved = resolveConstraintDeclaredBy(index, role, type, candidateRole);
		if (typeof resolved !== 'number' || !Number.isFinite(resolved)) {
			continue;
		}
		const extent = axisExtent(declared.referenceType, box, defaultExtent(type, box));
		if (resolved >= 0 && resolved <= 1) {
			return { px: resolved * extent };
		}
		if (resolved > 1) {
			return { abs: resolved };
		}
	}
	return undefined;
}

/** Resolve one constraint to pixels (factor / sub-1 value) or an absolute raw. */
export function dimOf(
	constraints: PptxSmartArtConstraint[] | undefined,
	type: string,
	box: BoundingBox,
	index: ConstraintIndex,
	role: string,
	declaringRole: string | readonly string[],
): Dim | undefined {
	const constraint = findConstraint(constraints, type);
	if (!constraint) {
		return dimDeclaredBy(role, type, declaringRole, box, index);
	}
	if (isCrossRoleReference(constraint)) {
		// "This slot's <type> is a factor of THAT sibling role's resolved
		// <refType>" - e.g. a caption slot sized relative to its picture
		// sibling. Walk the whole-definition constraint graph for the answer
		// (see `smartart-constraint-solver.ts`); fall through to the box-axis
		// approximation below only when it cannot be resolved.
		const refType = constraint.referenceType ?? constraint.type;
		const resolved = resolveConstraint(index, constraint.referenceForName!, refType);
		if (resolved !== undefined) {
			const factor =
				typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)
					? constraint.factor
					: 1;
			const extent = axisExtent(constraint.referenceType, box, defaultExtent(type, box));
			return { px: resolved * factor * extent };
		}
	}
	const extent = axisExtent(constraint.referenceType, box, defaultExtent(type, box));
	if (typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)) {
		return { px: constraint.factor * extent };
	}
	if (typeof constraint.value === 'number' && Number.isFinite(constraint.value)) {
		if (constraint.value >= 0 && constraint.value <= 1) {
			return { px: constraint.value * extent };
		}
		if (constraint.value > 1) {
			return { abs: constraint.value };
		}
	}
	return undefined;
}
