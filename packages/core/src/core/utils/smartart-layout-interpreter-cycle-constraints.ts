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
import { itemNode } from './smartart-layout-interpreter-model';

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
 * The ring's real per-point item template, when it is NOT simply
 * `constraintNode.children[0]` (`itemNode`'s own naive assumption).
 *
 * A hub+satellite composite ring (`radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`) declares its own `constrLst`
 * directly on the composite's TOP node (`centerShape`/`node`/`dummy`/
 * `sibTrans`/`oneComp`/... all as SIBLING children, not nested inside a
 * `"cycle"`-named descendant `resolveCycleConstraintNode` would find), so
 * `itemNode()` picks up whichever child happens to be FIRST in document
 * order - `centerShape` (the hub) for every sample checked, never the actual
 * repeating ring item (`node`). `sibSp` ("minimum distance between SIBLING
 * shapes") only has meaning between the REPEATING ring item, so whichever
 * name its own `referenceForName` points to - when that name matches one of
 * `constraintNode`'s actual children - is a genuine declarative signal for
 * "this is the ring's real per-point template", not a per-layout-name guess.
 * `basic-cycle`/`multidirectional-cycle` decline this path (their own
 * `sibSp` references `composite`/`w`, not one of their own children's
 * literal names) and keep `itemNode()`'s original children[0] behaviour,
 * which was already COM-verified exact for them.
 *
 * The name match alone is not sufficient, though: `radial-list--hier5.pptx`
 * ("Radial List") declares its `sibSp` as a fraction of the HUB's own width
 * (`sibSp refType="w" refFor="ch" refForName="centerShape" fact="0.08"`, the
 * per-satellite GAP sized off the hub, not the ring item) - the name match
 * picks `centerShape` itself, a SINGULAR node reached only through a
 * `dgm:choose` gate (never repeats per point), feeding the ring math the
 * hub's own near-square aspect instead of the true, much wider
 * ellipse+gap+rect ring-item aspect and corrupting every non-full-circle arc.
 * A genuine repeating ring item is reached through an ENCLOSING `dgm:forEach`
 * (`forEachOrigin` set - see that field's own doc comment on
 * `PptxSmartArtLayoutNode`; `centerShape` has none, `node` does, reached via
 * `forEach axis="ch"` then `forEach axis="self" ptType="node"`), so the name
 * match is only trusted when it also carries one; otherwise this falls back
 * to the first child that genuinely repeats, before `itemNode()`'s original
 * children[0] guess.
 */
function resolveRingItemNode(
	constraintNode: PptxSmartArtLayoutNode,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
): PptxSmartArtLayoutNode | undefined {
	const sibSpName = (arrangerConstraints ?? []).find(
		(c) => c.type === 'sibSp' && typeof c.referenceForName === 'string',
	)?.referenceForName;
	const named = sibSpName
		? (constraintNode.children ?? []).find((child) => child.name === sibSpName)
		: undefined;
	if (named?.forEachOrigin) {
		return named;
	}
	const repeating = (constraintNode.children ?? []).find((child) => child.forEachOrigin);
	return repeating ?? named ?? itemNode(constraintNode);
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
 */
export function resolveCycleRingParams(
	arrangerNode: PptxSmartArtLayoutNode,
	index: ConstraintIndex,
): {
	minGapRatio: number;
	heightOverWidth: number;
	absoluteGapPx?: number;
	hubRatio?: { hubName: string; factor: number };
	hubGapRatio?: number;
	absoluteHubGapPx?: number;
	contentLayout?: CompositeContentLayout;
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
	const hubRatio = resolveHubToNodeRatio(item, arrangerConstraints);
	const hubGapRatio = resolveHubGapRatio(item?.name, hubRatio, arrangerConstraints);
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
	return {
		minGapRatio: Math.max(DEFAULT_MIN_GAP_RATIO, minGapRatio),
		heightOverWidth,
		hubRatio,
		absoluteHubGapPx: absoluteHubGap !== undefined ? absoluteHubGap * POINTS_TO_PIXELS : undefined,
		contentLayout,
		hubGapRatio,
	};
}
