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
