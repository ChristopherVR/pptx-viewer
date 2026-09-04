/**
 * SmartArt DiagramML interpreter - `dgm:if` (`ST_FunctionType`) evaluation.
 *
 * Split out of `smartart-layout-interpreter-flow.ts` to keep that file under
 * the repo's per-file line budget. Implements ECMA-376's 8 `dgm:if/@func`
 * values (`cnt`/`pos`/`revPos`/`posEven`/`posOdd`/`var`/`depth`/`maxDepth`)
 * against every comparison operator (`equ`/`neq`/`gt`/`lt`/`gte`/`lte`).
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtPresLayoutVars, PptxSmartArtWhen } from '../types';

/** Parse a numeric branch threshold, or `undefined` when non-numeric. */
function toNumber(value: string): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Extra evaluation context beyond the node count, letting {@link evaluateWhen}
 * decide the `func` values ECMA-376 defines against a specific point's
 * position/depth or the diagram's own `presLayoutVars`, when a caller has that
 * context available. Every field is optional: `chooseAlgType`'s own call site
 * (deciding the whole diagram's structural algorithm, not one point) only ever
 * has `presLayoutVars` to offer, so `pos`/`revPos`/`posEven`/`posOdd`/`depth`/
 * `maxDepth` stay undecidable there exactly as before - no regression.
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

/** Evaluate `func="var"`: compare `presLayoutVars[@arg]` against `when.value`. */
function evaluateVar(
	when: PptxSmartArtWhen,
	presLayoutVars: PptxSmartArtPresLayoutVars,
): boolean | undefined {
	if (!when.argument) {
		return undefined;
	}
	const actual = VAR_LOOKUP[when.argument]?.(presLayoutVars);
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
 * Evaluate a single `dgm:if`. `func="cnt"` (against `nodeCount`) is always
 * decidable; `pos`/`revPos`/`posEven`/`posOdd`/`depth`/`maxDepth`/`var` are
 * decidable only when `context` supplies the matching field - otherwise this
 * returns `undefined` so the caller keeps its blind first-alg behaviour.
 */
export function evaluateWhen(
	when: PptxSmartArtWhen,
	nodeCount: number,
	context: WhenContext,
): boolean | undefined {
	switch (when.function) {
		case 'cnt': {
			const threshold = toNumber(when.value);
			return threshold === undefined
				? undefined
				: compareNumeric(nodeCount, when.operator, threshold);
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
