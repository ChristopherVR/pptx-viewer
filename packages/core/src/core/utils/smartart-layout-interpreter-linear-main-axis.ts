/**
 * SmartArt DiagramML interpreter - `lin` main-axis extent/gap resolution.
 *
 * Split out of `smartart-layout-interpreter-linear.ts` (the file-size
 * budget): resolves the UNIFORM per-item main-axis extent and the gap
 * between consecutive items that `arrangeLinear` divides `usableMain` into,
 * before any per-item (content-sized) override applies - see
 * `smartart-layout-interpreter-linear-content-size.ts` for that.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { firstConstraintDeclaredBy } from './smartart-constraint-declared-by';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';

/** A decorative between-item gap, resolved as either a fraction of the item's own main-axis extent, or a fixed pixel amount. */
type MainAxisGap = { relative: number } | { absolutePx: number };

/**
 * When the arranger declares no `sibSp`/`sp` fraction of its own, the real
 * gap between consecutive items is whatever decorative role fills that space
 * - two measured shapes, both resolved via {@link firstConstraintDeclaredBy}
 * so only an ARRANGER-declared (not the role's own self-scoped) constraint
 * counts:
 *  - "Basic Process"'s `sibTrans` connector: its own WIDTH is `refType="w"
 *    refFor="ch" refForName="node" fact="0.4"` - relative to the item's own
 *    main-axis extent, composing with the pre-existing `sib * mainExtent`
 *    formula (same shape a literal `sibSp` ratio already produces).
 *  - "Vertical Bullet List"'s `spacer`: its own HEIGHT is `refType=
 *    "primFontSz" fact="0.08"` - a FIXED amount relative to the shared font
 *    ceiling, independent of `mainExtent` entirely (the gap does not grow or
 *    shrink with how many items fit the row/column).
 * `undefined` when no such role is declared (the common case), so the
 * caller's own flat `0.25` default is unaffected.
 */
function resolveMainAxisGap(
	index: ConstraintIndex,
	role: string,
	mainAxisType: 'w' | 'h',
	ceilingPx: number,
): MainAxisGap | undefined {
	for (const gapRole of ['sibTrans', 'spacer']) {
		const raw = firstConstraintDeclaredBy(index, gapRole, mainAxisType, role);
		if (!raw || typeof raw.factor !== 'number' || raw.factor <= 0) {
			continue;
		}
		if (raw.referenceType === 'primFontSz') {
			return { absolutePx: raw.factor * ceilingPx };
		}
		if (raw.referenceType === mainAxisType) {
			return { relative: raw.factor };
		}
	}
	return undefined;
}

/** Resolved main-axis item extent plus the gap between consecutive items. */
export function resolveMainAxisLayout(
	constraints: PptxSmartArtLayoutNode['constraints'],
	index: ConstraintIndex,
	role: string,
	mainAxisType: 'w' | 'h',
	ceilingPx: number,
	usableMain: number,
	begPad: number,
	endPad: number,
	n: number,
	clampRatio: (value: number) => number,
): { mainExtent: number; gap: number } {
	const explicitSib = resolveRatioConstraint(constraints, index, role, ['sibSp', 'sp'], Number.NaN);
	if (!Number.isNaN(explicitSib)) {
		const sib = clampRatio(explicitSib);
		const denom = begPad + endPad + n + Math.max(0, n - 1) * sib;
		const mainExtent = n > 0 ? usableMain / denom : usableMain;
		return { mainExtent, gap: sib * mainExtent };
	}
	const inferredGap = resolveMainAxisGap(index, role, mainAxisType, ceilingPx);
	if (inferredGap && 'absolutePx' in inferredGap) {
		// The gap is a FIXED pixel amount, independent of `mainExtent`: solve
		// `n * mainExtent + (n-1) * gapAbs + (begPad+endPad) * mainExtent =
		// usableMain` directly, rather than expressing the gap as a ratio of
		// the (not yet known) `mainExtent`.
		const gapAbs = Math.max(0, inferredGap.absolutePx);
		const denom = begPad + endPad + n;
		const mainExtent =
			n > 0 ? Math.max(0, usableMain - Math.max(0, n - 1) * gapAbs) / denom : usableMain;
		return { mainExtent, gap: gapAbs };
	}
	const sib = clampRatio(inferredGap && 'relative' in inferredGap ? inferredGap.relative : 0.25);
	const denom = begPad + endPad + n + Math.max(0, n - 1) * sib;
	const mainExtent = n > 0 ? usableMain / denom : usableMain;
	return { mainExtent, gap: sib * mainExtent };
}
