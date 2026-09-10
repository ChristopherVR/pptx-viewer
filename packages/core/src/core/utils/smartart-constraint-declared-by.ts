/**
 * SmartArt DiagramML interpreter - arranger-scoped constraint resolution.
 *
 * Split out of `smartart-constraint-solver.ts` to keep that file under the
 * repo's per-file line budget: this is one extra, narrower resolution mode
 * layered on top of the general `ConstraintIndex` machinery there.
 */

import type { PptxSmartArtConstraint } from '../types';
import type { ConstraintIndex, IndexedConstraint } from './smartart-constraint-solver';
import { entryKey, resolveEntry } from './smartart-constraint-solver';

/**
 * Resolve a role's constraint of `type`, considering ONLY declarations made
 * by `declaringRole` (typically the ARRANGER itself, via its own `for="ch"
 * forName="<role>"`/`ptType="<role>"` entries) - a role's OWN self-scoped
 * constrLst entry for the same `type` is ignored at this top level (though a
 * reference chain from an accepted candidate still resolves normally, with no
 * such restriction, once underway).
 *
 * This distinction is measured, not incidental: real PowerPoint output honours
 * an ARRANGER-declared per-item aspect (verified against `animation-builds-
 * color.pptx` in `smartart-relative-constraint-roundtrip.test.ts`, a genuine
 * `for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact=
 * "0.6"` declaration), but does NOT apply an item's OWN self-scoped `h`/`w`
 * (e.g. "Basic Process"'s `tx` item template's own `<dgm:constr type="h"
 * refType="w" fact="0.6"/>`, and "Vertical Process"'s roundRect item's own
 * `<dgm:constr type="w" refType="h" fact="1.8"/>`) to the outer box at all -
 * both are genuinely full-cross-axis boxes in the cached drawing regardless.
 * Applying the item's own declaration as if it were arranger-declared
 * regressed both from ~2-4% deviation to over 70-90%
 * (`smartart-gallery-ground-truth.test.ts`).
 */
export function resolveConstraintDeclaredBy(
	index: ConstraintIndex,
	role: string,
	type: string,
	declaringRole: string,
): number | undefined {
	const candidates = index.entries.get(entryKey(role, type));
	const fromArranger = candidates?.filter(
		(c: IndexedConstraint) => c.declaringRole === declaringRole,
	);
	if (!fromArranger || fromArranger.length === 0) {
		return undefined;
	}
	const visiting = new Set<string>([entryKey(role, type)]);
	for (const candidate of fromArranger) {
		const value = resolveEntry(index, candidate, visiting);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

/**
 * The raw `dgm:constr` a role's `type` is declared by `declaringRole`, when
 * one exists - the SAME entry {@link resolveConstraintDeclaredBy} would
 * resolve, but unresolved (no factor/reference walk applied). Exposed for a
 * caller (`smartart-layout-interpreter-composite-slots.ts`) that needs the
 * constraint's own `referenceType` to pick which box axis (`w`/`h`) the
 * resolved NUMBER scales against - `resolveConstraintDeclaredBy` folds that
 * choice away internally.
 */
export function firstConstraintDeclaredBy(
	index: ConstraintIndex,
	role: string,
	type: string,
	declaringRole: string,
): PptxSmartArtConstraint | undefined {
	const candidates = index.entries.get(entryKey(role, type));
	return candidates?.find((candidate) => candidate.declaringRole === declaringRole)?.constraint;
}

/**
 * Find a `type`-typed constraint declared by one of `declaringRoleChain`
 * (nearest ancestor first), scanning the WHOLE index rather than one known
 * `(role, type)` key - for a lookup whose target role is not known in
 * advance (a `ptType`-targeted `userS` declaration keyed by a generic role
 * like `node`, not by the specific item's own `forName`; see
 * `smartart-layout-interpreter-cycle-hub-ratio.ts`'s `resolveHubToNodeRatioViaUserSize`).
 *
 * Disambiguates the SAME way `resolveConstraintDeclaredBy` already does for
 * a known role key: when multiple declarations of `type` exist across the
 * whole layout definition (e.g. `radial-cluster--hier5.pptx`'s own
 * `userS` declared BOTH at the diagram root `Name0` for its `dir=norm`/
 * `dir=rev` branches AND, unrelated, at the `singleCycle` alternative
 * branch for its OWN `n=1` structure), only a declaration made by a TRUE
 * ancestor of the current arranger should win - picking whichever candidate
 * merely sits first in document order is exactly the ambiguity this guards
 * against. `optionalMatch`, when given, further restricts which constraint
 * of `type` counts (e.g. "carries a `referenceForName`"). Returns the
 * nearest ancestor's own match first; `undefined` when no candidate's
 * `declaringRole` is anywhere in the chain.
 */
export function resolveByAncestorChain(
	index: ConstraintIndex,
	type: string,
	declaringRoleChain: readonly string[],
	optionalMatch?: (constraint: PptxSmartArtConstraint) => boolean,
): IndexedConstraint | undefined {
	for (const declaringRole of declaringRoleChain) {
		for (const entries of index.entries.values()) {
			for (const entry of entries) {
				if (entry.declaringRole !== declaringRole || entry.constraint.type !== type) {
					continue;
				}
				if (!optionalMatch || optionalMatch(entry.constraint)) {
					return entry;
				}
			}
		}
	}
	return undefined;
}
