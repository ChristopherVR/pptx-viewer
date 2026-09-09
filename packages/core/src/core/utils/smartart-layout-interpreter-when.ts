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

/** Parse a numeric branch threshold, or `undefined` when non-numeric. */
function toNumber(value: string): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

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
}

/** Apply `when.operator` to compare `actual` against a numeric `threshold`. */
function compareNumeric(actual: number, operator: string, threshold: number): boolean | undefined {
	switch (operator) {
		case 'equ':
			return actual === threshold;
		case 'neq':
			return actual !== threshold;
		case 'gt':
			return actual > threshold;
		case 'lt':
			return actual < threshold;
		case 'gte':
			return actual >= threshold;
		case 'lte':
			return actual <= threshold;
		default:
			return undefined;
	}
}

/** `dgm:if/@arg` variable name -> the `presLayoutVars` field it names (`dgm:varLst` tag names). */
const VAR_LOOKUP: Readonly<
	Record<string, (vars: PptxSmartArtPresLayoutVars) => string | number | boolean | undefined>
> = {
	dir: (v) => v.direction,
	hierBranch: (v) => v.hierarchyBranch,
	orgChart: (v) => v.orgChart,
	chMax: (v) => v.childMax,
	chPref: (v) => v.childPreferred,
	bulletEnabled: (v) => v.bulletEnabled,
	animLvl: (v) => v.animationLevel,
	animOne: (v) => v.animateOne,
	resizeHandles: (v) => v.resizeHandles,
};

/**
 * ECMA-376 `CT_DirectionVarSet`/etc. default a `dgm:varLst` variable NOT
 * written to the file, rather than leaving it "unknown": most built-in
 * layoutDefs (every `lin`/`snake`/`cycle`/`pyra` family, at minimum) gate
 * their primary arrangement algorithm behind
 * `<dgm:if func="var" arg="dir" op="equ" val="norm">` and never write an
 * explicit `dgm:dir` unless the diagram is actually reversed - so treating
 * "absent" as undecidable (rather than "norm", the spec default) meant this
 * choose was NEVER decided for the common case, and `discoverArrangement`
 * fell through to the legacy family approximation for the majority of the
 * built-in gallery (measured via `smartart-gallery-ground-truth.test.ts`:
 * "Basic Process" and most List/Process/Cycle/Pyramid layouts). Only `dir`
 * is defaulted here; the other `dgm:varLst` variables (`hierBranch`,
 * `chMax`/`chPref`, ...) are resolved with their own defaults already
 * applied at parse time (`smartart-pres-layout-vars.ts`), so they reach here
 * with a concrete value or a deliberate "genuinely absent" `undefined`.
 */
const VAR_DEFAULT: Readonly<Partial<Record<string, string>>> = { dir: 'norm' };

/** Evaluate `func="var"`: compare `presLayoutVars[@arg]` against `when.value`. */
function evaluateVar(
	when: PptxSmartArtWhen,
	presLayoutVars: PptxSmartArtPresLayoutVars,
): boolean | undefined {
	if (!when.argument) {
		return undefined;
	}
	const resolved = VAR_LOOKUP[when.argument]?.(presLayoutVars);
	const actual = resolved ?? VAR_DEFAULT[when.argument];
	if (actual === undefined) {
		return undefined;
	}
	if (typeof actual === 'number') {
		const threshold = toNumber(when.value);
		return threshold === undefined ? undefined : compareNumeric(actual, when.operator, threshold);
	}
	// Boolean/string variables (`orgChart`, `dir`, `hierBranch`, ...) only support
	// equality: ECMA-376 doesn't define an ordering for them.
	const actualStr = String(actual);
	if (when.operator === 'equ') {
		return actualStr === when.value;
	}
	if (when.operator === 'neq') {
		return actualStr !== when.value;
	}
	return undefined;
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
			const axis = when.axis;
			if (axis !== undefined && context.nodes) {
				const resolved = resolveAxisCount(
					context.nodes,
					axis,
					when.pointTypes,
					when.start,
					when.count,
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
			if (context.maxDepth === undefined) {
				return undefined;
			}
			const threshold = toNumber(when.value);
			return threshold === undefined
				? undefined
				: compareNumeric(context.maxDepth, when.operator, threshold);
		}
		case 'var':
			return context.presLayoutVars ? evaluateVar(when, context.presLayoutVars) : undefined;
		default:
			return undefined;
	}
}
