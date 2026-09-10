/**
 * SmartArt DiagramML interpreter - relative constraint resolver.
 *
 * `dgm:constr` (`PptxSmartArtConstraint`) can express a value relative to
 * ANOTHER layoutNode role's resolved value via `@refType`/`@refFor`/
 * `@refForName`/`@refPtType`, instead of (or alongside) an absolute
 * `@val`/`@fact`. Every existing consumer of `constrLst` in this interpreter
 * (`ratioConstraint`, the item-aspect lookup, the `composite` slot resolver)
 * only ever read a constraint's OWN `val`/`fact`, so a relative-only
 * constraint silently produced nothing and the caller fell back to a
 * hard-coded default. Confirmed against genuine PowerPoint content: `ppt/
 * diagrams/layout1.xml` inside `e2e/fixtures/animation-builds-color.pptx`
 * declares (on its root `diagram` layoutNode):
 *
 * ```xml
 * <dgm:constr type="w" for="ch" forName="node" refType="w"/>
 * <dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.6"/>
 * <dgm:constr type="w" for="ch" forName="sibTrans" refType="w" refFor="ch" refForName="node" fact="0.1"/>
 * <dgm:constr type="sp" refType="w" refFor="ch" refForName="sibTrans"/>
 * ```
 *
 * i.e. every item's height is 0.6x its own (box-relative) width, the spacer
 * between items is 0.1x an item's width, and the inter-item gap equals the
 * spacer's width exactly - none of that resolves without walking references.
 *
 * This module builds a one-shot index of every `dgm:constr` in a layout
 * definition, keyed by the ROLE it targets (the `name=` of the `dgm:layoutNode`
 * it constrains), and resolves a (role, constraint-type) pair to a number by
 * walking the reference chain depth-first, with cycle and missing-target
 * protection. Pure graph/geometry code; no framework code, no DOM.
 *
 * ## Targeting
 *
 * A `dgm:constr` declared inside layoutNode `D`'s `constrLst`:
 *   - `for` omitted or `"self"` -> targets `D` itself.
 *   - `for="ch"` / `for="des"` with `forName="X"` -> targets the layoutNode
 *     named `X` (a structural ROLE, not a data point - `forName` names a
 *     `dgm:layoutNode`, confirmed against the genuine sample above; see
 *     `smartart-layout-interpreter-named-rules.ts` for the same finding
 *     against `dgm:rule`).
 *   - `for="ch"` / `for="des"` with no `forName` -> no single named role is
 *     identified, so it is attributed to `D` itself (its own configuration for
 *     its children collectively), matching how callers already read a plain
 *     `constrLst` array before this module existed.
 *
 * A reference (`refType`/`refFor`/`refForName`) resolves the same way, relative
 * to the SAME declaring node `D`: `refFor` omitted/`"self"` refers to `D`'s own
 * resolved value of `refType` (defaulting to the constraint's own `type` when
 * `refType` is omitted); `refFor="ch"`/`"des"` with `refForName` refers to that
 * named role instead.
 *
 * ## Degradation
 *
 * - A reference to a (role, type) with no declaration anywhere resolves to
 *   `undefined`, EXCEPT the root layoutNode's own `w`/`h`: those default to
 *   `1` (the box's own full extent), the implicit "whole diagram" unit every
 *   `fact` in a real definition is ultimately expressed against.
 * - A cycle (`A` needs `B` needs `A`) is caught by a resolution-stack guard and
 *   resolves to `undefined` rather than recursing forever.
 * - Both degrade to "not resolved": callers fall back to their own hard-coded
 *   default, exactly as they did before any relative constraint existed.
 */

import type {
	PptxSmartArtConstraint,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
} from '../types';
import { selectConstraints } from './smartart-constraint-branch-index';
import type { WhenContext } from './smartart-layout-interpreter-when';

/** Sentinel role for an unnamed layoutNode (most commonly the root arranger). */
const ROOT_ROLE = '\u0000root';

/** One `dgm:constr` plus the role that declared it. Exposed for
 * `smartart-constraint-declared-by.ts`, which needs to filter candidates by
 * `declaringRole` before running the same reference-walking logic. */
export interface IndexedConstraint {
	constraint: PptxSmartArtConstraint;
	/** Name of the layoutNode whose `constrLst` declared this entry ("self"). */
	declaringRole: string;
}

/** One-shot index over every `dgm:constr` in a layout definition. */
export interface ConstraintIndex {
	entries: Map<string, IndexedConstraint[]>;
	rootRole: string;
}

/**
 * The role a target (`for`/`forName`/`ptType`, or `refFor`/`refForName`/
 * `refPtType`) resolves to.
 *
 * `forName` names a `dgm:layoutNode` directly and wins when present. Absent
 * that, `ptType` (`node`/`sibTrans`/`asst`/...) is the DiagramML-level
 * targeting dimension real built-ins actually use for a `for="ch"` constraint
 * with no `forName` - e.g. "Basic Process"'s real layoutDef declares BOTH
 * `<dgm:constr type="w" for="ch" ptType="node" .../>` (the item box) AND
 * `<dgm:constr type="w" for="ch" ptType="sibTrans" .../>` (the connector) on
 * the SAME declaring node with NO `forName` on either. Before `ptType` was
 * part of the role key, both collapsed onto `declaringRole` and clobbered
 * each other in the index (whichever was inserted first silently won every
 * lookup for BOTH the item's own w/h and the connector's), which is why
 * `itemAspect` (`smartart-layout-interpreter-linear.ts`) could never resolve
 * a per-item aspect for these layouts even though the constraint order was
 * unambiguous in the XML. Used as the role key verbatim (not scoped under
 * `declaringRole`) because every built-in item template's own `dgm:layoutNode
 * name=` conventionally equals its `ptType` string ("node"), which is also
 * what `roleOf(itemNode(arranger))` reads at the call site - so this need not
 * invent a synthetic key the rest of the interpreter would never look up.
 */
/** Exposed for `smartart-constraint-resolve.ts` (reference-role targeting
 * uses the SAME logic as forward targeting). */
export function targetRole(
	target: { for?: string; forName?: string; pointType?: string },
	declaringRole: string,
): string {
	if ((target.for === 'ch' || target.for === 'des') && target.forName) {
		return target.forName;
	}
	if ((target.for === 'ch' || target.for === 'des') && target.pointType) {
		return target.pointType;
	}
	return declaringRole;
}

/** Exposed for `smartart-constraint-declared-by.ts` (see {@link IndexedConstraint}). */
export function entryKey(role: string, type: string): string {
	return `${role}::${type}`;
}

/** True when a constraint carries any `ref*` attribute (a relative constraint). */
export function hasReference(constraint: PptxSmartArtConstraint): boolean {
	return (
		constraint.referenceType !== undefined ||
		constraint.referenceFor !== undefined ||
		constraint.referenceForName !== undefined ||
		constraint.referencePointType !== undefined
	);
}

/** The role name a layoutNode's own constraints/references resolve under. */
export function roleOf(node: PptxSmartArtLayoutNode | undefined): string {
	return node?.name ?? ROOT_ROLE;
}

/**
 * An index over no constraints at all. Every arranger that consults a
 * `ConstraintIndex` accepts this as its default, so adding the parameter
 * never breaks an existing caller that arranges without one (it just gets
 * exactly the pre-existing scalar-only behaviour: every lookup degrades).
 */
export const EMPTY_CONSTRAINT_INDEX: ConstraintIndex = { entries: new Map(), rootRole: '' };

/**
 * Build a resolvable index of every `dgm:constr` in the whole layout tree.
 *
 * `nodeCount`/`context` (round 39) enable choose-AWARE selection for a node
 * whose `constrLst` is genuinely branched (`node.constraintCandidates`, see
 * `smartart-constraint-branch-index.ts`'s `selectConstraints`): when the
 * live branch decides, only ITS constraints are indexed for that node,
 * instead of blindly unioning every branch. Omit both (every pre-existing
 * caller) to keep the old blind-union behaviour exactly as before - a
 * caller with no diagram to evaluate against cannot decide a branch anyway.
 */
export function buildConstraintIndex(
	definition: PptxSmartArtLayoutDefinition,
	nodeCount?: number,
	context?: WhenContext,
): ConstraintIndex {
	const entries = new Map<string, IndexedConstraint[]>();

	const walk = (node: PptxSmartArtLayoutNode): void => {
		const declaringRole = roleOf(node);
		// `allConstraints` (when present) is a superset of `constraints` that
		// also includes ones declared inside a `dgm:choose`/`dgm:if`/`dgm:else`
		// wrapping THIS node's own constrLst (see its doc comment - `gear`'s
		// composite positions its slots this way exclusively). Prefer the
		// choose-aware branch selection when it decides; fall back to the blind
		// union otherwise.
		const constraints =
			selectConstraints(node, nodeCount, context) ?? node.allConstraints ?? node.constraints ?? [];
		for (const constraint of constraints) {
			const role = targetRole(constraint, declaringRole);
			const list = entries.get(entryKey(role, constraint.type));
			const entry: IndexedConstraint = { constraint, declaringRole };
			if (list) {
				list.push(entry);
			} else {
				entries.set(entryKey(role, constraint.type), [entry]);
			}
		}
		for (const child of node.children ?? []) {
			walk(child);
		}
	};
	walk(definition.rootNode);

	return { entries, rootRole: roleOf(definition.rootNode) };
}

// Reference-chain resolution (`resolveEntry`/`resolveConstraint`) lives in
// `smartart-constraint-resolve.ts` (split out to keep this file under the
// repo's per-file line budget); re-exported here so every pre-existing
// import path (`from './smartart-constraint-solver'`) keeps working.
export { resolveConstraint, resolveEntry } from './smartart-constraint-resolve';
