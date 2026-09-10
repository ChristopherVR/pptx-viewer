/** Typed, editable metadata from a DiagramML layout-definition part. */

import type { XmlObject } from './common';
import type { PptxSmartArtConstraint, PptxSmartArtNumericRule } from './smart-art-constraint-rules';

export interface PptxSmartArtLocalizedText {
	value: string;
	language?: string;
}

export interface PptxSmartArtLayoutCategory {
	type: string;
	priority: number;
}

export interface PptxSmartArtAlgorithmParameter {
	type: string;
	value?: string;
}

/** Typed DiagramML CT_Algorithm data attached to a layout node. */
export interface PptxSmartArtLayoutAlgorithm {
	type: string;
	revision?: number;
	parameters?: PptxSmartArtAlgorithmParameter[];
}

export interface PptxSmartArtIteratorAttributes {
	name?: string;
	reference?: string;
	axis?: string[];
	pointTypes?: string[];
	hideLastTransition?: boolean[];
	start?: number[];
	count?: number[];
	step?: number[];
}

export interface PptxSmartArtForEach extends PptxSmartArtIteratorAttributes {
	rawXml?: XmlObject;
}

export interface PptxSmartArtWhen extends PptxSmartArtIteratorAttributes {
	function: string;
	argument?: string;
	operator: string;
	value: string;
	rawXml?: XmlObject;
}

export interface PptxSmartArtChoose {
	name?: string;
	when: PptxSmartArtWhen[];
	otherwise?: { name?: string; rawXml?: XmlObject } | null;
	rawXml?: XmlObject;
}

/** A single `dgm:adj/@val` adjustment, keyed by its `@idx` (1-based, like `a:gd`). */
export interface PptxSmartArtShapeAdjustment {
	index: number;
	value: number;
}

/**
 * Typed DiagramML CT_Shape data (`dgm:shape`) attached to a layout node: the
 * per-node preset geometry override real (and third-party/custom) layout
 * definitions use so a layoutNode can be e.g. an ellipse or a chevron instead
 * of the arranger family's hardcoded default shape.
 */
export interface PptxSmartArtLayoutNodeShape {
	/** `dgm:shape/@type`: a preset geometry name (`roundRect`, `ellipse`, `chevron`, `conn`, ...). */
	presetGeometry?: string;
	/** `dgm:adjLst/dgm:adj` entries (adjustment index -> value, as authored). */
	adjustments?: PptxSmartArtShapeAdjustment[];
	/** `dgm:shape/@hideGeom`: the shape is present only to size text, never painted. */
	hideGeometry?: boolean;
	/**
	 * `dgm:shape/@lkTxEntry` (CT_Shape, boolean, default false): this node is a
	 * decorative shape that should mirror its paired content node's text
	 * rather than always rendering blank. See `smartart-layout-interpreter-
	 * pyramid.ts`'s `arrangePyramid`, the interpreter's one existing
	 * synthesized-decorative-shape call site.
	 */
	lkTxEntry?: boolean;
}

/** Identity and ordering metadata from DiagramML CT_LayoutNode. */
export interface PptxSmartArtLayoutNode {
	name?: string;
	styleLabel?: string;
	childOrder?: 'b' | 't';
	moveWith?: string;
	algorithm?: PptxSmartArtLayoutAlgorithm;
	forEach?: PptxSmartArtForEach[];
	choose?: PptxSmartArtChoose[];
	constraints?: PptxSmartArtConstraint[];
	rules?: PptxSmartArtNumericRule[];
	/** `dgm:shape`: this node's own preset geometry override, when present. */
	shape?: PptxSmartArtLayoutNodeShape;
	/**
	 * `dgm:presOf` (CT_PresentationOf, same iterator shape as `dgm:forEach`):
	 * which data-model point(s) this node's OWN text/geometry binds to -
	 * `axis: ['self']` the point currently being iterated, `['des']` all of
	 * its descendants, `['ch']` its direct children, and so on. Absent or
	 * empty `axis` (including a bare `<dgm:presOf/>`) means the node carries
	 * no text of its own (a pure positioning/decoration wrapper - `composite`,
	 * `sp` spacer, connector cap). See `smartart-layout-interpreter-item-
	 * roles.ts`, the one consumer: it is what lets the interpreter tell a
	 * text-bearing per-item role (a list layout's `childText`, a card
	 * layout's `roleText`/`bodyText`) apart from a same-generation sibling
	 * that positions or decorates instead.
	 */
	presentationOf?: PptxSmartArtIteratorAttributes;
	/**
	 * EVERY `dgm:constr` reachable from this node, including ones declared
	 * inside a `dgm:choose`/`dgm:if`/`dgm:else` that wraps THIS layoutNode's
	 * `constrLst` (a genuinely conditional constraint set, e.g. one branch
	 * per data-point count - `gear`'s composite positions its `gear1`/
	 * `gear2`/`gear3` slots this way, so its plain, direct-child-only
	 * `constraints` above is empty for it). Stops at a nested `dgm:layoutNode`
	 * boundary: that child's own conditional constrLst becomes ITS
	 * `allConstraints`, not folded into the parent's. Read-only /
	 * interpretation-only - `constraints` above (this node's own DIRECT
	 * constrLst) remains the one `applySmartArtLayoutDefinition` round-trips,
	 * so editing an unrelated property can never collapse a genuinely
	 * conditional constrLst into a single branch. `undefined` when this node
	 * declares no constrLst at all, in or out of a choose (the common case);
	 * otherwise a superset of `constraints` (every branch, blindly unioned -
	 * this interpreter does not evaluate `dgm:choose` conditions when
	 * indexing constraints, matching the same "flatten both branches"
	 * convention `nestedLayoutNodes` already uses for `children`). See
	 * `smartart-constraint-solver.ts`'s `buildConstraintIndex`, the only
	 * consumer.
	 */
	allConstraints?: PptxSmartArtConstraint[];
	children?: PptxSmartArtLayoutNode[];
	/**
	 * The iterator attributes of the ENCLOSING `dgm:forEach` this node was
	 * found through, when `nestedLayoutNodes` (`smartart-layout-definition
	 * .ts`) reached it by walking one - as opposed to being a direct child of
	 * its parent layoutNode, or reached only through a `dgm:choose` wrapper
	 * (a condition, not an iteration, leaves this `undefined`).
	 *
	 * `forEach` above records a node's OWN direct `dgm:forEach` children
	 * (which wrap ITS descendants); this is the opposite direction - the
	 * forEach that wraps the node ITSELF, one level up. A layoutNode can sit
	 * inside more than one enclosing forEach only via nesting, so this is
	 * always the SINGLE nearest one, not a list.
	 *
	 * This is what tells a genuinely repeated per-child template
	 * (`axis="ch"`, `ptType` absent or `"node"`) apart from a once-only or
	 * transition-only sibling that merely happens to sit inside SOME
	 * `dgm:forEach` (a `ptType="parTrans"`/`"sibTrans"` connector, or
	 * `axis="followSib" cnt="1"`) - both can be direct siblings under the
	 * SAME parent layoutNode (`lProcess1`'s `vertFlow` has one forEach for
	 * its `parTrans` connector and a SEPARATE one, `axis="ch"`, for its
	 * repeated `child` items; `vertFlow.forEach` bundles both, but only
	 * `child.forEachOrigin` says which ONE produced it). See
	 * `smartart-layout-interpreter-item-roles-recursive.ts`, the one
	 * consumer. Read-only / interpretation-only, like `allConstraints`:
	 * never round-tripped by `applySmartArtLayoutDefinition`.
	 */
	forEachOrigin?: PptxSmartArtIteratorAttributes;
	/**
	 * The conditions of EVERY enclosing `dgm:if` this node was found through,
	 * outermost first, when `nestedLayoutNodes` (`smartart-layout-
	 * definition.ts`) reached it via one or more `dgm:choose`'s `if` branches
	 * (as opposed to a direct child, a `dgm:else` branch contributing no
	 * condition of its own - see below - or a `dgm:forEach`, which sets
	 * {@link forEachOrigin} instead). ALL must hold (evaluate `!== false`,
	 * per {@link chooseGuard}'s own AND semantics - see `evaluateWhen`) for
	 * this node's branch to be genuinely live. A caller that already has the
	 * data-model node list can use this instead of treating every
	 * choose-flattened branch as unconditionally present
	 * (`nestedLayoutNodes`' pre-existing "flatten every branch" convention,
	 * still the default when this is absent or a caller does not evaluate
	 * it) - e.g. `cycle-matrix--fallback-n2.pptx`'s `child1group`..
	 * `child4group`, each gated on a DIFFERENT top-level point existing and
	 * having its own child (`axis="ch ch" st="N 1" cnt="1 0" func="cnt"
	 * op="gte" val="1"`).
	 *
	 * A CHAIN, not a single condition, because a node can sit inside NESTED
	 * `dgm:choose`s whose OWN conditions are each individually necessary -
	 * `sub-step-process--hier5.pptx`'s `chLin1`..`chLin7` each sit inside
	 * BOTH an outer `dgm:if func="pos" op="equ" val="N"` (which one of the
	 * 7 hand-duplicated per-position templates this is) AND an inner,
	 * nearly-vacuous `dgm:if func="cnt" op="gte" val="1"` (has >= 1 point at
	 * all) - keeping only the NEAREST (inner) one, as an earlier single-
	 * condition design did, loses the ONE piece of information (the outer
	 * `pos` guard) that actually discriminates `chLin1` from `chLin2`.
	 *
	 * A `dgm:else` branch contributes NO condition of its own (ECMA-376
	 * defines it as "none of the sibling ifs matched", which would need the
	 * FULL sibling list's conditions negated and ANDed together, not a
	 * single condition - no gallery fixture measured needs an else branch's
	 * own guard yet, so it is left unconditional, matching the pre-existing
	 * flatten-everything behaviour) but does NOT clear any OUTER ancestor
	 * guard already accumulated before it. Evaluate with `smartart-layout-
	 * interpreter-when.ts`'s `evaluateWhen`, once per entry, ANDed.
	 */
	chooseGuard?: PptxSmartArtWhen[];
	/**
	 * The chain of every enclosing `dgm:choose`'s own GROUP identity + this
	 * node's ordinal position within it + THAT branch's own condition,
	 * outermost first - identifies WHICH `dgm:choose` instance and WHERE
	 * within its own `dgm:if`/`dgm:else` list this node's branch sits, unlike
	 * {@link chooseGuard} (a flat AND-chain of every condition with no group/
	 * position identity, and no entry at all for a `dgm:else` branch, which
	 * has no condition of its own - see that field's doc comment). `id` is a
	 * synthetic, process-unique identifier assigned per `dgm:choose` instance
	 * during flattening (`smartart-layout-definition-nesting.ts`'s
	 * `nestedLayoutNodes`, a monotonic counter - NOT round-tripped, NOT the
	 * choose's own `@_name`, which is not guaranteed unique across a whole
	 * layoutDef); `ordinal` is 0-based document order within that ONE choose
	 * (every `dgm:if` in order, then `dgm:else` last, if present); `guard` is
	 * that branch's OWN condition (`undefined` for a `dgm:else` entry, which
	 * has none - deliberately kept PER-ENTRY rather than cross-referenced by
	 * index against {@link chooseGuard}, whose own length can diverge from
	 * this chain's whenever an ancestor `dgm:else` contributed a group
	 * position but no guard).
	 *
	 * Lets a consumer recover ECMA-376's real `dgm:choose` semantics - "the
	 * FIRST branch whose condition holds wins, siblings never coexist" -
	 * from the flattened `.children` array, where that grouping would
	 * otherwise be lost: `balance--hier5.pptx`'s `balance_NN`/`left_NN_M`/
	 * `right_NN_M` family (127 members across ~30 NESTED `dgm:choose`
	 * instances, not one flat 127-branch choose) needs first-match-wins
	 * WITHIN each individual choose to resolve to the single genuinely-live
	 * arrangement, not the "every guard-true node is an independent
	 * candidate" reading `smartart-layout-interpreter-composite-choose.ts`'s
	 * `collectRawCandidates` used before this field existed - see that
	 * module's own consumer of this field for the actual selection rule.
	 * `undefined` (or an empty array) for a node reached without any
	 * enclosing choose (a direct child, or a `dgm:forEach`-only path) -
	 * every PRE-EXISTING caller that does not consult this field is
	 * unaffected by its mere presence.
	 */
	chooseGroups?: { id: string; ordinal: number; guard?: PptxSmartArtWhen }[];
	/**
	 * Every `dgm:presOf` candidate reachable through a `dgm:choose`/`dgm:if`/
	 * `dgm:else` wrapping THIS node's OWN presOf (as opposed to
	 * {@link chooseGuard}, which gates the layoutNode's own EXISTENCE), each
	 * tagged with the FULL chain of enclosing `dgm:if` conditions that select
	 * it (`guard`, empty for an unconditional or `dgm:else`-reached
	 * candidate), in document order (every `dgm:if` then `dgm:else` last).
	 * `undefined` when this node's presOf is not choose-guarded at all (the
	 * overwhelmingly common case) - {@link presentationOf} already carries
	 * the one-and-only value then. Exists for a genuinely conditional presOf
	 * where TWO OR MORE branches each declare a real, DIFFERENT axis
	 * (`funnel--flat3.pptx`'s `item1`/`item2`/`item3`, one literal axis per
	 * data-point count): `smartart-layout-definition-constraints.ts`'s
	 * `choosePresentationOf` (feeding {@link presentationOf}) can only ever
	 * guess ONE branch statically, at parse time, with no diagram to
	 * evaluate against; this field lets an interpret-time caller with the
	 * actual diagram (`smartart-layout-interpreter-when.ts`'s
	 * `resolvePresentationOf`, the one consumer) pick the branch PowerPoint's
	 * own runtime would, first-match-wins.
	 */
	presentationOfCandidates?: {
		guard: PptxSmartArtWhen[];
		presentationOf: PptxSmartArtIteratorAttributes;
	}[];
	/**
	 * SESSION 17: every `dgm:rule` reachable through a `dgm:choose`/`dgm:if`/
	 * `dgm:else` wrapping THIS node's `ruleLst` (a genuinely count-gated rule
	 * set, e.g. `diverging-radial`'s own `w for="ch" forName="node"` ceiling:
	 * 6 `dgm:if cnt<=N` branches, each its own `fact`), tagged with its guard
	 * chain - the SAME shape {@link presentationOfCandidates} uses for
	 * choose-guarded `presOf`, applied to `dgm:rule`. `undefined` when not
	 * choose-guarded (`rules` above then carries the one set, the common
	 * case). See `smartart-layout-interpreter-cycle-hub-ratio.ts`'s
	 * `resolveHubToNodeRatio` (COM-verified live mechanism, not a guess) for
	 * how the guard is evaluated against the real satellite count.
	 */
	ruleCandidates?: {
		guard: PptxSmartArtWhen[];
		rule: PptxSmartArtNumericRule;
	}[];
}

/** Metadata and root node from DiagramML CT_DiagramDefinition. */
export interface PptxSmartArtLayoutDefinition {
	uniqueId?: string;
	minimumVersion?: string;
	defaultStyle?: string;
	titles?: PptxSmartArtLocalizedText[];
	descriptions?: PptxSmartArtLocalizedText[];
	categories?: PptxSmartArtLayoutCategory[];
	rootNode: PptxSmartArtLayoutNode;
	/** Original definition retained for constraint evaluation and foreign rules. */
	rawXml?: XmlObject;
}
