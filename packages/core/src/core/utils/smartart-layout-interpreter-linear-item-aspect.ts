/**
 * SmartArt DiagramML interpreter - `lin` arranger item aspect resolution.
 *
 * Split out of `smartart-layout-interpreter-linear.ts` (the repo's per-file
 * line budget): `itemAspect`, the item's own height/width ratio as declared
 * by the OUTER arranger (as opposed to the item's own self-scoped `h`/`w`,
 * a separate fallback `arrangeLinear` applies itself).
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars } from '../types';
import {
	firstConstraintDeclaredBy,
	resolveConstraintDeclaredBy,
} from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import { isColumnWrapper } from './smartart-layout-interpreter-item-role-orientation';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { itemNode } from './smartart-layout-interpreter-model';

/**
 * Item aspect (height / width), resolved ONLY from the ARRANGER's own
 * `constrLst` (`for="ch" forName="<item role>"` / `ptType="<item ptType>"`),
 * via {@link resolveConstraintDeclaredBy} - the item's OWN self-scoped
 * `h`/`w` is a SEPARATE fallback the caller applies itself (`naturalAspect`
 * in `arrangeLinear`), not considered here.
 *
 * Round 25: a same-axis "inherit the arranger's own dimension" declaration
 * (`<dgm:constr type="h" for="ch" forName="linNode" refType="h"/>`, no
 * cross-axis reference or literal factor of its own - "Vertical Bracket
 * List"'s `linNode`) resolves to a spurious 1:1 "aspect" via this same
 * code path (both axes bottom out at the root's own implicit `w=h=1`) and
 * squashes a genuinely WIDE item template into a narrow square. A dedicated
 * fix EXCLUDING that pattern (unconditionally, for EVERY item) was
 * implemented, measured against the full 227-fixture corpus, and found to
 * REGRESS WIDELY (dozens of OTHER fixtures' FONT/GEOM values moved
 * measurably further from cached - e.g. `alternating-flow--hier5.pptx`
 * 44.0px->74.7px against a 37.3px cached target, `bullet-timeline--
 * hier5.pptx`'s `maxGeomDelta` 34%->88% - the SAME degenerate 1:1
 * resolution this fix targeted is, empirically, load-bearing for many
 * OTHER fixtures' correct box shape, not merely "coincidentally correct"
 * for them). REVERTED - see the round-25 successor doc's own section for
 * the measured regression numbers and the `smartart-layout-interpreter-
 * linear-item-aspect.ts` file that attempt added (deleted along with the
 * revert - this file is a DIFFERENT, round-27 extraction, not a resurrection
 * of that one). Round 25's own doc comment asked for a NARROWER trigger,
 * "possibly conditioned on the item template's own nested arranger being a
 * DIFFERENT-orientation `lin`" - round 27 built exactly that signal for the
 * SIBLING column-role-split mechanism (`smartart-layout-interpreter-item-
 * role-orientation.ts`'s `isColumnWrapper`: an EXPLICIT `linDir="fromL"|
 * "fromR"` wrapper, 2+ text roles, every one a genuinely plain rect - see
 * that function's own doc comment for why the plain-rect guard is load-
 * bearing here too, not just for the role-split geometry: "Vertical Block
 * List" shares "Vertical Bracket List"'s exact wrapper shape but its
 * descendant role is a rotated decorative connector, not a real column, and
 * WOULD have wrongly widened this item's own box under a check that only
 * looked at `linDir`) and reuses it here: the exemption now applies ONLY
 * when `item` itself is a genuine column wrapper (measured corpus-wide:
 * `vertical-bracket-list` is the ONLY fixture in the gallery whose item
 * template is BOTH a same-axis-inherit candidate AND a genuine column
 * wrapper - the intersection that regressed 25 fixtures under round 25's
 * unconditional exclusion is empty here).
 */
export function itemAspect(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): number | undefined {
	const item = itemNode(plan.node);
	if (!item) {
		return undefined;
	}
	if (isColumnWrapper(item, nodeCount, presLayoutVars)) {
		return undefined;
	}
	const role = roleOf(item);
	const arrangerRole = roleOf(plan.node);
	const height = resolveConstraintDeclaredBy(index, role, 'h', arrangerRole);
	const width = resolveConstraintDeclaredBy(index, role, 'w', arrangerRole);
	if (typeof height === 'number' && typeof width === 'number' && height > 0 && width > 0) {
		return height / width;
	}
	return undefined;
}

/**
 * The item's CROSS-axis extent, as a literal fraction of the diagram's own
 * width, for a VERTICAL `lin` arranger only - the counterpart to
 * {@link itemAspect} for the "Basic Block List"/"Vertical Block List"/
 * "Pyramid List" family of writer-fabricated (and matching genuine
 * PowerPoint `list1.xml`-style) definitions:
 *
 * ```xml
 * <dgm:constr type="w" for="ch" forName="node" refType="w"/>
 * <dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.3"/>
 * ```
 *
 * i.e. the item's width is declared OUTRIGHT as a fraction of the diagram's
 * own width (here 1, the whole box), and height is a further fraction OF
 * that same width. `itemAspect` resolves this same pair down to a single
 * `h/w` RATIO (0.3) and `arrangeLinear` applies it as `mainExtent * aspect`
 * - correct for a HORIZONTAL arranger (main axis `w`, cross axis `h`: cross
 * = main * (h/w)), but wrong for a VERTICAL one: there `mainExtent` is
 * already the (fitted) HEIGHT, so multiplying it by the SAME h/w fraction
 * again compounds it, producing a box narrower than tall (measured: a
 * 600x340 box, 3 nodes, this exact writer definition, gave 29x97 boxes
 * instead of near-full-width ~584-600 x ~97-104 rows). The item's width was
 * never meant to be DERIVED from the fitted main-axis height at all - it is
 * an independent, literal fraction of the box's own width, which this
 * resolves directly instead.
 *
 * Gated on the RAW `h` declaration's own `referenceType` being exactly `w`
 * (a genuine geometric "height is a fraction of width" relationship) so this
 * never engages for a role whose "aspect" is actually a `primFontSz`-derived
 * ratio with no real geometric meaning (`itemAspect`'s own doc comment: e.g.
 * `vertical-bullet-list--hier5.pptx`'s `parentText`, where the existing
 * always-multiply-then-clamp-to-`usableCross` behaviour is load-bearing and
 * must be left alone).
 */
export function itemCrossAxisFraction(
	plan: ArrangementPlan,
	index: ConstraintIndex,
): number | undefined {
	const item = itemNode(plan.node);
	if (!item) {
		return undefined;
	}
	const role = roleOf(item);
	const arrangerRole = roleOf(plan.node);
	const rawHeight = firstConstraintDeclaredBy(index, role, 'h', arrangerRole);
	if (!rawHeight || rawHeight.referenceType !== 'w') {
		return undefined;
	}
	const width = resolveConstraintDeclaredBy(index, role, 'w', arrangerRole);
	return typeof width === 'number' && width > 0 ? width : undefined;
}

/** Order the data nodes for the resolved flow direction. */
export function ordered(nodes: PptxSmartArtNode[], flow: FlowDirection): PptxSmartArtNode[] {
	return flow.reverse ? [...nodes].reverse() : nodes;
}
