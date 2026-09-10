/**
 * SmartArt DiagramML interpreter - cycle ring constraint reading (`sibSp`,
 * item `h:w`, and the choose-branch-flattening workaround for a nested
 * `cycle` layoutNode).
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` to keep that file
 * under the repo's per-file line budget. See that module's doc comment for
 * the full COM-verified derivation this feeds into.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import { findConstraint, ratioConstraint } from './smartart-layout-interpreter-constraints';
import {
	resolveHubGapRatio,
	resolveHubToNodeRatio,
} from './smartart-layout-interpreter-cycle-hub-ratio';
import {
	deriveCompositeSelfChildLayout,
	resolveGraphAspectRatio,
} from './smartart-layout-interpreter-cycle-item-aspect';
import type { CompositeContentLayout } from './smartart-layout-interpreter-cycle-item-aspect';
import { resolveRingItemNode } from './smartart-layout-interpreter-cycle-item-node';
import { resolveSibTransBulgeRatio } from './smartart-layout-interpreter-cycle-sibtrans';

export { resolveHubToNodeRatio } from './smartart-layout-interpreter-cycle-hub-ratio';

/**
 * ECMA-376 21.4.2.x: a `dgm:constr`/`dgm:rule` numeric attribute with no
 * `fact`/`refType` (an absolute `val`, e.g. `sibSp val="15"`) is in POINTS,
 * PowerPoint's own unit for `CT_Constraint`, not a bare pixel or a percentage
 * - same convention `smartart-layout-item-font-size.ts` already established
 * for `primFontSz`. Duplicated here (rather than importing that module's
 * private constant) to avoid a cross-track dependency for one literal.
 */
export const POINTS_TO_PIXELS = 96 / 72;

/**
 * `sibSp`'s SCHEMA default is 0 (MS's "Cycle Algorithm" reference), but that
 * is a floor the layoutDef may raise, never a target the renderer hits
 * exactly: `basic-cycle`/`multidirectional-cycle` (declared 0.5/0.65) and
 * `nondirectional-cycle`/`block-cycle` (declared 0.15, a SMALLER floor) all
 * measure the SAME effective minimum gap once the declared value is at or
 * below this figure, i.e. the real engine enforces its own aesthetic
 * minimum regardless of a smaller declared `sibSp`. COM-verified exact for
 * the two layouts that declare >= 0.5; see the module doc comment.
 *
 * SESSION 10: does NOT generalise to a composite self+child ring item
 * (`resolveCycleRingParams`'s own `contentLayout`, e.g.
 * `radial-list--hier5.pptx`'s `node` ellipse+rect): its declared `sibSp`
 * (`~0.1333` once resolved) is relative to the COMPOSITE's own width, but
 * the ring's natural unit-width is the narrower SELF sub-shape
 * (`contentLayout.selfWidthFactor=0.4` - see `smartart-layout-interpreter-
 * cycle-item-aspect.ts`). Converting (`declaredRatio / selfWidthFactor =
 * 0.333`) and skipping this floor for a composite item reproduces the
 * fixture's own cached ring-item size (161px vs cached 154px, 4.5% off) far
 * closer than either the floored-at-0.5 reading (137px, 11% off) or the raw
 * unconverted `0.1333` (167px, 8.4% off) - the remaining ~4.5% was not
 * chased further this session, no 4th independent sample to re-derive it.
 */
export const DEFAULT_MIN_GAP_RATIO = 0.5;

/**
 * A `dgm:constr`'s genuinely ABSOLUTE `val` in POINTS (ECMA-376 21.4.2.x: no
 * `fact`, no `refType` at all, and a `value` that is not itself a sub-1
 * ratio - `ratioConstraint`'s own convention, see
 * `smartart-layout-interpreter-constraints.ts`, for treating a small literal
 * `val` as a ratio instead), or `undefined` when `constraint` is absent or is
 * a ratio (`fact`, `refType`, or a sub-1 `val`). `sibSp val="15"`
 * (continuous-cycle) resolves to `15`; `sibSp fact="0.5"` (basic-cycle) and
 * `sibSp refType="w" fact="0.15"` both resolve to `undefined`.
 */
export function absoluteConstraintPoints(
	constraint: ReturnType<typeof findConstraint>,
): number | undefined {
	if (
		constraint === undefined ||
		constraint.factor !== undefined ||
		constraint.referenceType !== undefined ||
		typeof constraint.value !== 'number' ||
		!Number.isFinite(constraint.value) ||
		constraint.value < 1
	) {
		return undefined;
	}
	return constraint.value;
}

/**
 * The layoutNode that ACTUALLY carries the ring's own `constrLst` (`sibSp`,
 * `diam`, `w`) and item template, when `arrangerNode` is not it directly.
 *
 * `continuous-cycle`'s ("cycle3") top layoutNode is a `dgm:choose` between a
 * dedicated 2-node `composite` layout and, for 3+ nodes, a nested
 * `dgm:layoutNode name="cycle"` carrying the real ring `constrLst` and item
 * templates. `smartart-layout-definition.ts`'s parser flattens BOTH branches'
 * children onto the top node's own `.children` (it does not model
 * choose-branch scoping - the same simplification
 * `smartart-layout-interpreter-hub.ts`'s module doc comment describes for
 * nested `forEach`), so `itemNode(arrangerNode)` on the top node picks up the
 * WRONG branch's item (`node1`, the 2-node composite's, not `nodeFirstNode`).
 * `arrangerNode.algorithm` itself is unaffected (already correctly resolved
 * to the chosen branch by `discoverArrangement`), so `stAng`/`spanAng` are
 * fine either way - only the item/constraint lookups need this.
 *
 * `basic-cycle`/`multidirectional-cycle`/`nondirectional-cycle`/`block-cycle`
 * all declare a single, ungated top `dgm:layoutNode name="cycle"`, so
 * `arrangerNode` already IS this node for them (returned unchanged).
 * Depth-first search for a descendant literally named `"cycle"` - the naming
 * convention every built-in cycle-family gallery layout examined uses for
 * its actual ring layoutNode, whether or not it is the top node.
 */
export function resolveCycleConstraintNode(
	arrangerNode: PptxSmartArtLayoutNode,
): PptxSmartArtLayoutNode {
	if (arrangerNode.name === 'cycle') {
		return arrangerNode;
	}
	for (const child of arrangerNode.children ?? []) {
		if (child.name === 'cycle') {
			return child;
		}
	}
	return arrangerNode;
}

/**
 * Resolve the ring's `sibSp` (either a dimensionless `minGapRatio`, floored
 * at `DEFAULT_MIN_GAP_RATIO` when it is a genuine ratio - see that constant's
 * doc comment - or an absolute `absoluteGapPx`, converted points -> pixels,
 * when the layout declares a bare `val` - see `computeCycleRingLayout`'s doc
 * comment), `heightOverWidth` (the item node's own `h` fact), `hubRatio` (see
 * `resolveHubToNodeRatio`, `undefined` for a plain ring with no hub), and
 * `hubGapRatio` (see {@link resolveHubGapRatio}, `undefined` when no hub is
 * present or `sp` does not resolve) from the arranger's own declared
 * constraints. Takes the raw arranger `PptxSmartArtLayoutNode` (not an
 * `ArrangementPlan`) so `smartart-layout-interpreter-hub.ts` can call it for
 * a hub's ring without constructing a synthetic plan.
 *
 * `satelliteCount` (SESSION 17, optional): the ring's own satellite count
 * (hub excluded), fed straight through to `resolveHubToNodeRatio`'s own
 * count-gated `dgm:rule` override - see that function's own doc comment.
 * `undefined` from a caller with no count yet (the ratio still resolves via
 * `constrLst` alone then, exactly as before this session).
 */
export function resolveCycleRingParams(
	arrangerNode: PptxSmartArtLayoutNode,
	index: ConstraintIndex,
	satelliteCount?: number,
	declaringRoleChain?: readonly string[],
): {
	minGapRatio: number;
	heightOverWidth: number;
	absoluteGapPx?: number;
	hubRatio?: { hubName: string; factor: number };
	hubGapRatio?: number;
	absoluteHubGapPx?: number;
	contentLayout?: CompositeContentLayout;
	sibTransBulgeRatio?: number;
} {
	const constraintNode = resolveCycleConstraintNode(arrangerNode);
	// A `dgm:choose`/`dgm:if`/`dgm:else`-wrapped `constrLst` (every "cycle"
	// layout with a `dir`-dependent stAng/spanAng branch, `continuous-cycle`
	// included) lands in `allConstraints`, not the plain `constraints` array -
	// see `smartart-constraint-solver.ts`'s `buildConstraintIndex` doc
	// comment, which already reads `allConstraints ?? constraints` for the
	// SAME reason. Missing this here silently found nothing for `sibSp`
	// (falling through to the ratio floor even for an absolute `val`).
	const arrangerConstraints = constraintNode.allConstraints ?? constraintNode.constraints;
	const item = resolveRingItemNode(constraintNode, arrangerConstraints);
	const itemConstraints = item?.allConstraints ?? item?.constraints;
	// A LITERAL `h` fact/sub-1 val (e.g. `basic-cycle`'s own item, `h fact
	// ="0.667"`) is unambiguous and always wins first. When the item declares
	// no literal ratio at all, `resolveGraphAspectRatio`'s own doc comment:
	// the item's own `h` and `w` may BOTH be graph-resolved (via `refType`/
	// `refFor`/`refForName` chains) to absolute root-normalized units rather
	// than a plain fraction of each other - the ratio is `resolvedH /
	// resolvedW`, not `resolvedH` alone (`diverging-radial--hier5.pptx`'s own
	// `node`, whose `w` itself chains through `centerShape`). Only when
	// NEITHER resolves does this check `deriveCompositeSelfChildLayout` (a
	// composite ring item with no direct `h` constraint of its own,
	// `radial-list`'s `node`, ellipse+rect side by side): its own doc comment
	// explains why the ring's OWN uniform unit is the "self" shape's own
	// square aspect (`1`), never the composite's full (content-dependent)
	// aspect - the earlier `1` bare default and this pattern's own fallback
	// are therefore the SAME value, just for a documented reason instead of
	// an arbitrary one.
	const literalHeightOverWidth = ratioConstraint(
		itemConstraints ?? [],
		['h'],
		Number.NaN,
		item?.rules,
	);
	const contentLayout = deriveCompositeSelfChildLayout(item);
	const heightOverWidth = !Number.isNaN(literalHeightOverWidth)
		? literalHeightOverWidth
		: (resolveGraphAspectRatio(item, index) ??
			resolveRatioConstraint(itemConstraints, index, roleOf(item), ['h'], 1, item?.rules));
	const hubRatio = resolveHubToNodeRatio(
		item,
		arrangerConstraints,
		index,
		constraintNode.ruleCandidates,
		satelliteCount,
		declaringRoleChain,
	);
	const hubGapRatio = resolveHubGapRatio(item?.name, hubRatio, arrangerConstraints);
	// See `smartart-layout-interpreter-cycle-sibtrans.ts`'s own module doc
	// comment for the full derivation - `radial-cycle`'s own `sibTrans`
	// curve connector bulges past the satellites' own edges, needing extra
	// room in the ring's natural bounding box (`computeCycleRingLayout`).
	const sibTransBulgeRatio = resolveSibTransBulgeRatio(constraintNode, arrangerConstraints);
	// An ABSOLUTE `sp` (no `fact` at all, e.g. `radial-list--hier5.pptx`'s own
	// `<dgm:constr type="sp" val="20"/>`) is a hub-to-satellite gap too, but
	// `resolveHubGapRatio` only ever resolves a RATIO-form `sp` (a declared
	// `fact`) - see `computeCycleRingLayout`'s own `absoluteHubGapPx` doc
	// comment for how this feeds the SAME fixed-point iteration
	// `absoluteGapPx` already uses.
	const absoluteHubGap = absoluteConstraintPoints(findConstraint(arrangerConstraints, 'sp'));
	const absolutePoints = absoluteConstraintPoints(findConstraint(arrangerConstraints, 'sibSp'));
	if (absolutePoints !== undefined) {
		// An absolute `sibSp` is a MINIMUM distance too (per MS's "Cycle
		// Algorithm" reference), same as the ratio form, but there is no
		// equivalent engine floor to verify here: every genuine absolute-`val`
		// sample found so far (`continuous-cycle`) declares a value already
		// bigger than what the ratio-only layouts' floor would imply, so
		// `DEFAULT_MIN_GAP_RATIO` is only ever used as the fixed-point
		// iteration's starting guess (see `computeCycleRingLayout`), not
		// applied as a floor over the resolved absolute value.
		return {
			minGapRatio: DEFAULT_MIN_GAP_RATIO,
			heightOverWidth,
			absoluteGapPx: absolutePoints * POINTS_TO_PIXELS,
			hubRatio,
			hubGapRatio,
			absoluteHubGapPx:
				absoluteHubGap !== undefined ? absoluteHubGap * POINTS_TO_PIXELS : undefined,
			contentLayout,
			sibTransBulgeRatio,
		};
	}
	const minGapRatio = resolveRatioConstraint(
		arrangerConstraints,
		index,
		roleOf(constraintNode),
		['sibSp'],
		DEFAULT_MIN_GAP_RATIO,
		constraintNode.rules,
	);
	const selfRelativeGapRatio = contentLayout
		? minGapRatio / contentLayout.selfWidthFactor
		: minGapRatio;
	return {
		minGapRatio: contentLayout
			? selfRelativeGapRatio
			: Math.max(DEFAULT_MIN_GAP_RATIO, selfRelativeGapRatio),
		heightOverWidth,
		hubRatio,
		absoluteHubGapPx: absoluteHubGap !== undefined ? absoluteHubGap * POINTS_TO_PIXELS : undefined,
		contentLayout,
		hubGapRatio,
		sibTransBulgeRatio,
	};
}
