/**
 * Constraint evaluation (ECMA-376 Part 1, 21.4.2.x `dgm:constr`,
 * CT_Constraint). A node's `constrLst` assigns values to itself
 * (`for="self"`), its children (`for="ch"`) or any descendant
 * (`for="des"`), filtered by layout-node name and data-point type. A value
 * is either a literal `val` or another node's value times `fact`.
 *
 * Literal lengths are millimetres per the schema and are converted to points
 * here; the engine works in points throughout. Constraints that read a font
 * size (margins at `fact` x `primFontSz`, fonts linked across nodes) cannot be
 * known until text is fitted, so they are recorded as deferred constraints
 * and resolved by the text fitter.
 */

import { matchesPointType } from './axis';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

const POINTS_PER_MM = 72 / 25.4;

/** Constraint types that are lengths (literal values in millimetres). */
const LENGTH_TYPES = new Set([
	'w',
	'h',
	'l',
	't',
	'r',
	'b',
	'ctrX',
	'ctrY',
	'lOff',
	'tOff',
	'rOff',
	'bOff',
	'ctrXOff',
	'ctrYOff',
	'wOff',
	'hOff',
	'sp',
	'sibSp',
	'secSibSp',
	'begPad',
	'endPad',
	'connDist',
	'bendDist',
	'diam',
	'stemThick',
	'lMarg',
	'rMarg',
	'tMarg',
	'bMarg',
]);

export const FONT_TYPES = new Set(['primFontSz', 'secFontSz']);

/** Types an algorithm computes itself; a bare constraint must not zero them. */
const COMPUTED_TYPES = new Set(['connDist']);

/** Nodes a constraint addresses relative to `node`. */
export function relatedNodes(
	node: EngineNode,
	relation: 'self' | 'ch' | 'des',
	name: string | undefined,
	ptType: string,
): EngineNode[] {
	const matches = (candidate: EngineNode): boolean =>
		(!name || candidate.name === name) && matchesPointType(candidate.point, ptType);
	if (relation === 'self') {
		return name && node.name !== name ? [] : [node];
	}
	if (relation === 'ch') {
		return node.children.filter(matches);
	}
	const out: EngineNode[] = [];
	const visit = (current: EngineNode): void => {
		for (const child of current.children) {
			if (matches(child)) {
				out.push(child);
			}
			visit(child);
		}
	};
	visit(node);
	return out;
}

interface AxisKeys {
	start: string;
	end: string;
	center: string;
	size: string;
}

const HORIZONTAL: AxisKeys = { start: 'l', end: 'r', center: 'ctrX', size: 'w' };
const VERTICAL: AxisKeys = { start: 't', end: 'b', center: 'ctrY', size: 'h' };

/** Solve one axis: any two of start/end/centre/size determine the others. */
function axisValue(node: EngineNode, keys: AxisKeys, want: keyof AxisKeys): number | undefined {
	const get = (key: keyof AxisKeys): number | undefined => node.values.get(keys[key]);
	const start = get('start');
	const end = get('end');
	const center = get('center');
	let size = get('size');
	if (size === undefined) {
		if (start !== undefined && end !== undefined) {
			size = end - start;
		} else if (center !== undefined && start !== undefined) {
			size = (center - start) * 2;
		} else if (center !== undefined && end !== undefined) {
			size = (end - center) * 2;
		} else {
			size = keys.size === 'w' ? node.box?.w : node.box?.h;
		}
	}
	if (want === 'size') {
		return size;
	}
	let origin = start;
	if (origin === undefined && size !== undefined) {
		if (end !== undefined) {
			origin = end - size;
		} else if (center !== undefined) {
			origin = center - size / 2;
		}
	}
	if (origin === undefined || size === undefined) {
		return undefined;
	}
	switch (want) {
		case 'start':
			return origin;
		case 'end':
			return origin + size;
		default:
			return origin + size / 2;
	}
}

const AXIS_LOOKUP: Record<string, [AxisKeys, keyof AxisKeys]> = {
	l: [HORIZONTAL, 'start'],
	r: [HORIZONTAL, 'end'],
	ctrX: [HORIZONTAL, 'center'],
	w: [HORIZONTAL, 'size'],
	t: [VERTICAL, 'start'],
	b: [VERTICAL, 'end'],
	ctrY: [VERTICAL, 'center'],
	h: [VERTICAL, 'size'],
};

/**
 * A node's current value of `type`: an assigned constraint value, or one
 * derived from the others on the same axis (`r = l + w`, `b = ctrY + h/2`,
 * ...), or its box size.
 */
export function valueOf(node: EngineNode, type: string): number | undefined {
	const direct = node.values.get(type);
	if (direct !== undefined) {
		return direct;
	}
	const axis = AXIS_LOOKUP[type];
	return axis ? axisValue(node, axis[0], axis[1]) : undefined;
}

function literal(constraint: LdConstraint): number {
	return LENGTH_TYPES.has(constraint.type) ? constraint.val * POINTS_PER_MM : constraint.val;
}

function assign(target: EngineNode, constraint: LdConstraint, value: number): void {
	switch (constraint.op) {
		case 'gte':
			target.minValues.set(
				constraint.type,
				Math.max(target.minValues.get(constraint.type) ?? -Infinity, value),
			);
			return;
		case 'lte':
			target.maxValues.set(
				constraint.type,
				Math.min(target.maxValues.get(constraint.type) ?? Infinity, value),
			);
			return;
		default:
			target.values.set(constraint.type, value);
	}
}

/** Apply one constraint declared on `node`. */
export function applyConstraint(node: EngineNode, constraint: LdConstraint): void {
	const targets = relatedNodes(node, constraint.for, constraint.forName, constraint.ptType);
	if (targets.length === 0) {
		return;
	}
	if (constraint.op === 'equ' && targets.length > 0) {
		node.groups.push({ type: constraint.type, members: targets });
	}
	if (constraint.refType !== 'none') {
		const ref =
			constraint.refFor === 'self' && !constraint.refForName
				? node
				: relatedNodes(node, constraint.refFor, constraint.refForName, constraint.refPtType)[0];
		if (!ref) {
			return;
		}
		if (FONT_TYPES.has(constraint.refType)) {
			for (const target of targets) {
				target.deferred = target.deferred.filter((entry) => entry.source !== constraint);
				target.deferred.push({
					source: constraint,
					type: constraint.type,
					op: constraint.op,
					ref,
					refType: constraint.refType,
					fact: constraint.fact,
				});
			}
			if (constraint.op === 'equ') {
				node.groups.push({ type: constraint.type, members: [...targets, ref] });
			}
			return;
		}
		const base = valueOf(ref, constraint.refType);
		if (base === undefined) {
			return;
		}
		for (const target of targets) {
			assign(target, constraint, base * constraint.fact);
		}
		return;
	}
	if (!constraint.hasVal && (constraint.op !== 'none' || COMPUTED_TYPES.has(constraint.type))) {
		return;
	}
	const value = literal(constraint);
	for (const target of targets) {
		assign(target, constraint, value);
	}
}

/** Apply every constraint declared on `node`, in document order. */
export function evaluateConstraints(node: EngineNode): void {
	node.groups = [];
	for (const constraint of node.constraints) {
		applyConstraint(node, constraint);
	}
}
