/**
 * SmartArt DiagramML interpreter - sibling-role enumeration over a
 * {@link ConstraintIndex}.
 *
 * Split out of `smartart-constraint-solver.ts` (the repo's per-file line
 * budget, already at 300 LOC). `entryKey`/`ConstraintIndex.entries` are keyed
 * `${role}::${type}` with no reverse lookup by `(declaringRole, type)` alone -
 * every existing consumer queries ONE already-known target role at a time.
 * `smartart-layout-interpreter-item-role-stack.ts`'s `stackAsRect` (round 20)
 * needs the OPPOSITE direction: given an arranger role and a constraint
 * `type`, every role NAME that arranger declares one for, whether or not
 * that role ended up resolving actual content this point (a non-text
 * sibling like "Vertical Bullet List"'s `spacer` never resolves into
 * `ItemRoleContent`, but its own declared `h`-weight still reserves a real
 * share of the item box other roles must not silently absorb).
 */

import { firstConstraintDeclaredBy } from './smartart-constraint-declared-by';
import type { ConstraintIndex, IndexedConstraint } from './smartart-constraint-solver';
import { entryKey, hasReference } from './smartart-constraint-solver';

/**
 * Every role NAME `declaringRole` declares a `type` constraint for, scanning
 * the WHOLE index (not just one already-known target). Order is not
 * meaningful; a caller that needs to sum weights should just fold over the
 * result. Empty when `declaringRole` declares no `type` constraint for any
 * child at all.
 */
export function siblingRolesDeclaringType(
	index: ConstraintIndex,
	declaringRole: string,
	type: string,
): string[] {
	const suffix = `::${type}`;
	const roles = new Set<string>();
	for (const [key, candidates] of index.entries) {
		if (!key.endsWith(suffix)) {
			continue;
		}
		if (
			candidates.some((candidate: IndexedConstraint) => candidate.declaringRole === declaringRole)
		) {
			roles.add(key.slice(0, -suffix.length));
		}
	}
	return [...roles];
}

/**
 * Round 23: true when EVERY role `arrangerRole` declares an `h` constraint
 * for is `primFontSz`-relative to `itemRole` itself (`<dgm:constr type="h"
 * for="ch" forName="parentText" refType="primFontSz" refFor="ch"
 * refForName="parentText" fact="0.52"/>`, `forName="childText" ...
 * refForName="parentText" fact="0.46"`, ... - "Vertical Bullet List"'s own
 * pattern). Signals that any OTHER declared role's content (`childText`) is
 * a SEPARATE rendered box for `itemRole`'s own text, not a paragraph folded
 * into the SAME box the way `basic-process`'s bare `axis="ch"` folding is -
 * see `TieredFontFitItem.separateDescendantBox`'s doc comment for why that
 * distinction changes the font-fit's own `spcAft` term. `false` (not just
 * "no pattern") when the arranger declares no `h` constraint for any child
 * role at all, so a plain item template is unaffected.
 *
 * ALSO requires `itemRole`'s own `primFontSz` to carry a LITERAL ceiling
 * somewhere in the index (`op="equ" val="65"`, no `ref*` at all) - the
 * genuine top-level anchor a shared font-fit can key off. Round 23:
 * `vertical-circle-list--hier5.pptx`'s NESTED `lin` declares the SAME
 * shape one level down (`txLvl2`/`txLvl3`/`smCircle`/`indentDot1-3`, all
 * `primFontSz`-relative to `txLvl2`), but `txLvl2`'s OWN `primFontSz` is
 * ITSELF only ever declared as a REFERENCE (`0.78 * txLvl1`, from the OUTER
 * arranger) - not a real anchor, already a once-demoted descendant size.
 * Reusing `arrangeLinear`'s own fit for `txLvl2` there regressed it (25.3px
 * cached vs 68.0px, worse than the pre-round-23 34.7px) - requiring a
 * literal ceiling excludes this case while keeping "Vertical Bullet
 * List"'s own `parentText` (`<dgm:constr type="primFontSz" for="ch"
 * forName="parentText" op="equ" val="65"/>`, no reference at all).
 */
export function isPrimFontSzRoleSplitItem(
	index: ConstraintIndex,
	arrangerRole: string,
	itemRole: string,
): boolean {
	const declaredRoles = siblingRolesDeclaringType(index, arrangerRole, 'h');
	if (declaredRoles.length === 0) {
		return false;
	}
	const hasLiteralCeiling = (index.entries.get(entryKey(itemRole, 'primFontSz')) ?? []).some(
		(entry) => !hasReference(entry.constraint),
	);
	if (!hasLiteralCeiling) {
		return false;
	}
	return declaredRoles.every((role) => {
		const raw = firstConstraintDeclaredBy(index, role, 'h', arrangerRole);
		if (raw === undefined) {
			return false;
		}
		// Round 25: a role whose OWN declared `h` is a literal `val="INF"`
		// (content-sized) - "Vertical Box List"'s `parentLin`, the nested `lin`
		// sub-arranger wrapping `parentText` itself - is not a primFontSz-
		// weighted ROW at all; its real extent is resolved a level up (round
		// 24's `isMainAxisContentSized`). Treating it as a disqualifying,
		// unrelated declaration (the pre-round-25 behaviour) wrongly blocked
		// this whole construct from matching, even though every GENUINE
		// font-fit row it wraps (`parentText`, reached via `for="des"`) still
		// anchors correctly to `itemRole`.
		if (!hasReference(raw) && raw.value === Number.POSITIVE_INFINITY) {
			return true;
		}
		return (
			raw.referenceType === 'primFontSz' &&
			typeof raw.factor === 'number' &&
			raw.factor !== 0 &&
			(raw.referenceForName ?? raw.referencePointType ?? role) === itemRole
		);
	});
}

/**
 * Round 25: true when `itemRole` (the `isPrimFontSzRoleSplitItem` driving
 * role) is itself declared by `arrangerRole` with `for="des"` (a NESTED
 * descendant of the arranger, reached through a wrapper sub-arranger), not
 * `for="ch"` (a flat, direct sibling at the arranger's own level).
 *
 * "Vertical Bullet List"'s `parentText`/`childText` are BOTH literal
 * `for="ch"` roles of "linear" itself (`<dgm:constr type="h" for="ch"
 * forName="parentText" refType="primFontSz" refFor="ch" refForName=
 * "parentText" fact="0.52"/>`) - genuine flat siblings competing for ONE
 * shared, weight-split box. "Vertical Box List"'s `parentText` is declared
 * `for="des"` (`<dgm:constr type="h" for="des" forName="parentText"
 * refType="primFontSz" refFor="des" refForName="parentText" fact="0.82"/>`),
 * because it is only reachable as a DESCENDANT of "linear" - nested inside
 * `parentLin`, a wrapper sub-arranger - never a flat sibling of `childText`
 * (itself still a plain `for="ch"` role of "linear").
 *
 * This distinguishes two real, differently-rendered constructs that both
 * satisfy `isPrimFontSzRoleSplitItem`:
 *  - The `ch`-rooted case (`false`): `arrangeLinear`'s existing joint
 *    root+descendant fit (folding the descendant's text into the SAME
 *    height budget, `TieredFontFitItem.separateDescendantBox`'s own
 *    trailing-`spcAft`-skip aside) and `stackAsRect`'s `descendantFontSize`
 *    reuse (`SMARTART_DESCENDANT_FONT_SCALE=0.78`) are BOTH COM/cached-
 *    verified correct here: "Vertical Bullet List"'s `childText` cached at
 *    36pt against `parentText`'s 46pt (a genuine 0.78x ratio), and the joint
 *    fit against the item's own shared box is what CORRECTLY caps
 *    `parentText` at 46pt rather than its 65pt raw ceiling.
 *  - The `des`-rooted case (`true`): `childText` there is a genuinely
 *    SEPARATE, independently content-sized box (its own `dgm:rule
 *    h="INF"`), never sharing `parentText`'s box at all - folding its text
 *    into `parentText`'s OWN joint fit is a category error that measurably
 *    OVER-shoots the shared size further (49pt, against a cached 30pt -
 *    dragging even the leaf "Node Three", no descendant of its own, up with
 *    it, since the whole set shares one binary search); `arrangeLinear`
 *    keeps `separateDescendantBox` OFF (fits `parentText` alone, no
 *    folding) here, landing on 40pt - closer to cached, though NOT yet
 *    exact (a separate, not-yet-root-caused gap, likely margin resolution -
 *    see the round-25 successor doc). Regardless of the fitted value,
 *    `childText` shares that SAME driving-role size (ratio 1.0, not 0.78) -
 *    cached ground truth confirms every shape in this construct (`parentText`
 *    AND `childText`) is rendered at the identical 30pt, never the `ch`-
 *    rooted flat-sibling split's own diminished ratio.
 */
export function isDesRootedFontRole(
	index: ConstraintIndex,
	arrangerRole: string,
	itemRole: string,
): boolean {
	return firstConstraintDeclaredBy(index, itemRole, 'h', arrangerRole)?.for === 'des';
}
