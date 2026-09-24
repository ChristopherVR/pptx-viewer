/**
 * `dgm:if` evaluation (ECMA-376 Part 1, 21.4.2.13 and ST_FunctionType
 * 21.4.7.29): `cnt`, `pos`, `revPos`, `posEven`, `posOdd`, `depth`,
 * `maxDepth` and `var`, compared with ST_FunctionOperator.
 */

import { axisPoints, iteratePoints, matchesPointType, windowPoints } from './axis';
import type { DataPoint } from './data-points';
import type { LdCondition, LdIterator } from './layout-def-types';

/** ECMA-376 defaults for the layout variables a condition can read. */
const VARIABLE_DEFAULTS: Record<string, string> = {
	dir: 'norm',
	hierBranch: 'std',
	chMax: '-1',
	chPref: '-1',
	bulletEnabled: '0',
	orgChart: '0',
	animLvl: 'none',
	animOne: 'one',
	resizeHandles: 'rel',
};

/** Resolves a layout variable for the node currently being built. */
export type VariableLookup = (name: string) => string | undefined;

function pointDepth(point: DataPoint): number {
	let depth = 0;
	let current = point.parent;
	while (current) {
		depth++;
		current = current.parent;
	}
	return depth;
}

/** 1-based position of `point` among its parent's children of type `ptType`. */
function siblingPosition(point: DataPoint, ptType: string): { pos: number; count: number } {
	const siblings = (point.parent?.children ?? [point]).filter((candidate) =>
		matchesPointType(candidate, ptType === 'all' ? point.type : ptType),
	);
	const index = siblings.indexOf(point);
	return { pos: index + 1, count: siblings.length };
}

/** Points selected by every step but the last, i.e. the origins of the last step. */
function lastStepOrigins(point: DataPoint, iterator: LdIterator): DataPoint[] {
	if (iterator.axis.length <= 1) {
		return [point];
	}
	const prefix: LdIterator = {
		axis: iterator.axis.slice(0, -1),
		ptType: iterator.ptType.slice(0, iterator.axis.length - 1),
		hideLastTrans: iterator.hideLastTrans.slice(0, iterator.axis.length - 1),
		st: iterator.st.slice(0, iterator.axis.length - 1),
		cnt: iterator.cnt.slice(0, iterator.axis.length - 1),
		step: iterator.step.slice(0, iterator.axis.length - 1),
	};
	return iteratePoints(point, prefix);
}

function maxDepth(point: DataPoint, iterator: LdIterator): number {
	const last = iterator.axis.length - 1;
	let best = 0;
	for (const origin of lastStepOrigins(point, iterator)) {
		const base = pointDepth(origin);
		const ptType = iterator.ptType[last] ?? 'all';
		const selected = windowPoints(
			axisPoints(origin, iterator.axis[last] ?? 'self').filter((p) => matchesPointType(p, ptType)),
			iterator.st[last] ?? 1,
			iterator.cnt[last] ?? 0,
			iterator.step[last] ?? 1,
		);
		for (const candidate of selected) {
			best = Math.max(best, pointDepth(candidate) - base);
		}
	}
	return best;
}

function functionValue(
	condition: LdCondition,
	point: DataPoint,
	lookup: VariableLookup,
): number | string | undefined {
	const ptType = condition.ptType[condition.ptType.length - 1] ?? 'all';
	switch (condition.func) {
		case 'cnt':
			return iteratePoints(point, condition).length;
		case 'pos':
		case 'revPos':
		case 'posEven':
		case 'posOdd': {
			const selected = condition.axis.length > 0 ? iteratePoints(point, condition) : [point];
			const target = selected[0];
			if (!target) {
				return undefined;
			}
			const { pos, count } = siblingPosition(target, ptType);
			if (condition.func === 'pos') {
				return pos;
			}
			if (condition.func === 'revPos') {
				return count - pos + 1;
			}
			return condition.func === 'posEven' ? (pos % 2 === 0 ? 1 : 0) : pos % 2 === 1 ? 1 : 0;
		}
		case 'depth': {
			const selected = condition.axis.length > 0 ? iteratePoints(point, condition) : [point];
			return selected[0] ? pointDepth(selected[0]) : 0;
		}
		case 'maxDepth':
			return maxDepth(point, condition);
		case 'var':
			return lookup(condition.arg ?? '') ?? VARIABLE_DEFAULTS[condition.arg ?? ''];
		default:
			return undefined;
	}
}

function compare(left: number | string, op: string, rightRaw: string): boolean {
	const leftNumber = typeof left === 'number' ? left : Number(left);
	const rightNumber = Number(rightRaw);
	const numeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && rightRaw !== '';
	const a: number | string = numeric ? leftNumber : String(left);
	const b: number | string = numeric ? rightNumber : rightRaw;
	switch (op) {
		case 'equ':
			return a === b;
		case 'neq':
			return a !== b;
		case 'gt':
			return a > b;
		case 'lt':
			return a < b;
		case 'gte':
			return a >= b;
		case 'lte':
			return a <= b;
		default:
			return false;
	}
}

/** Normalise boolean-ish variable spellings so `val="1"` matches `true`. */
function normaliseVariable(value: number | string): number | string {
	if (value === 'true') {
		return '1';
	}
	if (value === 'false') {
		return '0';
	}
	return value;
}

/** Evaluate a `dgm:if` for `point`. An undecidable function is false. */
export function evaluateCondition(
	condition: LdCondition,
	point: DataPoint,
	lookup: VariableLookup,
): boolean {
	const value = functionValue(condition, point, lookup);
	if (value === undefined) {
		return false;
	}
	const expected =
		condition.func === 'var' ? String(normaliseVariable(condition.val)) : condition.val;
	return compare(normaliseVariable(value), condition.op, expected);
}
