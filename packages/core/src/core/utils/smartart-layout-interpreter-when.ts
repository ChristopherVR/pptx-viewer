/**
 * SmartArt DiagramML interpreter - `dgm:if` (`ST_FunctionType`) evaluation.
 *
 * Split out of `smartart-layout-interpreter-flow.ts` to keep that file under
 * the repo's per-file line budget. Implements ECMA-376's 8 `dgm:if/@func`
 * values (`cnt`/`pos`/`revPos`/`posEven`/`posOdd`/`var`/`depth`/`maxDepth`)
 * against every comparison operator (`equ`/`neq`/`gt`/`lt`/`gte`/`lte`).
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars, PptxSmartArtWhen } from '../types';
import { resolveAxisCount } from './smartart-layout-interpreter-axis-count';
import { resolveAxisMaxDepth } from './smartart-layout-interpreter-axis-depth';
import { compareNumeric, toNumber } from './smartart-layout-interpreter-when-numeric';
import { evaluateVar } from './smartart-layout-interpreter-when-var';

/**
 * Extra evaluation context beyond the node count, letting {@link evaluateWhen}
 * decide the `func` values ECMA-376 defines against a specific point's
 * position/depth or the diagram's own `presLayoutVars`, when a caller has that
 * context available. Every field is optional: `discoverArrangement`
 * (`smartart-layout-interpreter-model.ts`) supplies the declaring layout
 * node's own tree location (position among siblings, sibling count, depth,
 * the tree's max depth) for every `choose` it walks, so `pos`/`revPos`/
 * `posEven`/`posOdd`/`depth`/`maxDepth` are decidable in production, not just
 * in unit tests. A caller with no tree location to offer (e.g. a bare
 * `chooseAlgType` call from a test) simply omits these fields and those
 * functions stay undecidable, exactly as before - no regression.
 */
export interface WhenContext {
	/** 1-based ordinal position of the point being evaluated, for `pos`/`revPos`/`posEven`/`posOdd`. */
	position?: number;
	/** Sibling count the position is measured against, for `revPos`. */
	total?: number;
	/** Depth of the point/node being evaluated, for `func="depth"`. */
	depth?: number;
	/** Maximum depth of the tree, for `func="maxDepth"`. */
	maxDepth?: number;
	/** Diagram presentation layout variables, for `func="var"` (`@arg` names the variable). */
	presLayoutVars?: PptxSmartArtPresLayoutVars;
	/**
	 * The diagram's own flat data-model node array (`parentId`-linked), for a
	 * `func="cnt"` `dgm:if` whose `@axis` is declared at all - a single bare
	 * hop (`axis="ch"`, "the context point's own children"), a sub-range
	 * select (`@st`/`@cnt`), or a compound multi-hop chain (`axis="ch ch"`,
	 * "my first child's own children") - see {@link resolveAxisCount}.
	 * Omitted by a caller with no data-model tree to offer keeps the older,
	 * coarser `nodeCount`-only behaviour for `cnt` exactly as before (no
	 * regression for a caller that never had this).
	 */
	nodes?: PptxSmartArtNode[];
	/**
	 * The point(s) a `dgm:if`'s own enclosing `dgm:forEach` bound (its
	 * `PptxSmartArtLayoutNode.forEachOrigin`, already resolved to real data
	 * nodes), for a `func="maxDepth"` `dgm:if` whose `@axis` needs anchor-
	 * relative navigation rather than the diagram root - see {@link
	 * resolveAxisMaxDepth}'s own doc comment (`smartart-layout-interpreter-
	 * axis-depth.ts`) for the derivation. Omitted by a caller with no anchor
	 * to offer keeps the older `context.maxDepth`-only behaviour for
	 * `maxDepth` exactly as before (no regression for a caller that never had
	 * this - no existing caller populates this field yet).
	 */
	anchor?: PptxSmartArtNode[];
}

/** Evaluate `func="posEven"`/`"posOdd"` as a 1/0 numeric compare against `when.value` (default 1). */
function evaluateParity(
	when: PptxSmartArtWhen,
	position: number,
	wantEven: boolean,
): boolean | undefined {
	const isEven = position % 2 === 0;
	const actual = isEven === wantEven ? 1 : 0;
	const threshold = toNumber(when.value) ?? 1;
	return compareNumeric(actual, when.operator, threshold);
}

/**
 * Evaluate a single `dgm:if`. `func="cnt"` (against `resolveAxisCount` when
 * `when.axis` is declared and real tree navigation is available, else the
 * caller's own flat `nodeCount`) is always decidable; `pos`/`revPos`/
 * `posEven`/`posOdd`/`depth`/`maxDepth`/`var` are decidable only when
 * `context` supplies the matching field - otherwise this returns `undefined`
 * so the caller keeps its blind first-alg behaviour.
 */
export function evaluateWhen(
	when: PptxSmartArtWhen,
	nodeCount: number,
	context: WhenContext,
): boolean | undefined {
	switch (when.function) {
		case 'cnt': {
			const threshold = toNumber(when.value);
			if (threshold === undefined) {
				return undefined;
			}
			// ANY declared `@axis` (a bare single hop included) needs real tree
			// navigation: ECMA-376 21.4.7.5's `axis="ch"` means "the CONTEXT
			// point's own children", which the caller's flat `nodeCount` (every
			// point at every depth) only coincides with when no matched point has
			// a deeper descendant of its own. `radial-list--hier5.pptx`'s own
			// `axis="ch" ptType="node" func="cnt"` satellite-count choose is the
			// fixture that exposed this: 3 top-level satellites (the real answer
			// ECMA wants), but a flat total of 5 once two satellites fold in a
			// child's own text. Also fixes `tabbed-arc--hier5.pptx` (14.82% ->
			// 5.25%). This ONCE measured worse for `radial-list` alone
			// (87.43% -> 109-115%) because of a SEPARATE bug in
			// `resolveCycleRingParams`'s `heightOverWidth` resolution for a
			// side-by-side (not self-aspect-declaring) composite ring item -
			// see that function's own doc comment for the fix landed alongside
			// this one; both together, verify `radial-list` does not regress
			// below its own prior number before trusting this scope change.
			// Falls back to `nodeCount` only when `context.nodes` is absent, or
			// `resolveAxisCount` itself declines (an axis hop it doesn't
			// recognise) - never a silent behaviour change for a caller with no
			// tree to navigate.
			// `context.anchor`, when supplied, is threaded through to
			// `resolveAxisCount` exactly as `maxDepth` already threads it to
			// `resolveAxisMaxDepth` below: hop 0 then navigates from that
			// explicit anchor point set rather than the diagram's own top level.
			// Needed for a `dgm:choose` living INSIDE a nested composite slot,
			// whose `axis="ch"`/`"ch ch"` etc. means "MY anchor's own children",
			// not "the diagram root's children" - for a diagram whose data model
			// is a single root with everything else nested underneath (one
			// `topLevelSmartArtNodes` entry), the anchor-less reading can never
			// distinguish `cnt` thresholds a nested choose needs
			// (`radial-cluster--hier5.pptx`'s `cycle_3` own `stAng`/`spanAng`
			// choose, resolved via a `WhenContext.anchor` a composite call site
			// supplies). No existing caller populates `context.anchor` for a
			// `cnt` predicate yet, so this is pure additive plumbing: a full
			// 227-fixture regen shows zero deltas from this change alone.
			const axis = when.axis;
			if (axis !== undefined && context.nodes) {
				const resolved = resolveAxisCount(
					context.nodes,
					axis,
					when.pointTypes,
					when.start,
					when.count,
					context.anchor,
				);
				if (resolved !== undefined) {
					return compareNumeric(resolved, when.operator, threshold);
				}
			}
			return compareNumeric(nodeCount, when.operator, threshold);
		}
		case 'pos': {
			if (context.position === undefined) {
				return undefined;
			}
			const threshold = toNumber(when.value);
			return threshold === undefined
				? undefined
				: compareNumeric(context.position, when.operator, threshold);
		}
		case 'revPos': {
			if (context.position === undefined || context.total === undefined) {
				return undefined;
			}
			const threshold = toNumber(when.value);
			if (threshold === undefined) {
				return undefined;
			}
			const revPos = context.total - context.position + 1;
			return compareNumeric(revPos, when.operator, threshold);
		}
		case 'posEven':
			return context.position === undefined
				? undefined
				: evaluateParity(when, context.position, true);
		case 'posOdd':
			return context.position === undefined
				? undefined
				: evaluateParity(when, context.position, false);
		case 'depth': {
			if (context.depth === undefined) {
				return undefined;
			}
			const threshold = toNumber(when.value);
			return threshold === undefined
				? undefined
				: compareNumeric(context.depth, when.operator, threshold);
		}
		case 'maxDepth': {
			const threshold = toNumber(when.value);
			if (threshold === undefined) {
				return undefined;
			}
			// An `@axis`-declared condition anchored to a real forEach-bound point
			// navigates the ACTUAL data tree from there (see `resolveAxisMaxDepth`'s
			// own doc comment for why this differs from `context.maxDepth`, and the
			// fixture - `radial-cluster--hier5.pptx` - that needs it). Falls back to
			// the coarser `context.maxDepth` when either ingredient is missing, or
			// the axis-aware resolution itself declines - never a regression for a
			// caller with nothing more to offer.
			if (when.axis !== undefined && context.anchor && context.nodes) {
				const axisDepth = resolveAxisMaxDepth(
					context.nodes,
					when.axis,
					when.pointTypes,
					when.start,
					when.count,
					context.anchor,
				);
				if (axisDepth !== undefined) {
					return compareNumeric(axisDepth, when.operator, threshold);
				}
			}
			return context.maxDepth === undefined
				? undefined
				: compareNumeric(context.maxDepth, when.operator, threshold);
		}
		case 'var':
			return context.presLayoutVars ? evaluateVar(when, context.presLayoutVars) : undefined;
		default:
			return undefined;
	}
}

// `resolvePresentationOf` moved to `smartart-layout-interpreter-presof-
// choose.ts` (the file-size budget); re-exported here so every existing
// import site (`smartart-layout-interpreter-composite-anchor.ts` and
// friends) is unaffected.
export { resolvePresentationOf } from './smartart-layout-interpreter-presof-choose';
