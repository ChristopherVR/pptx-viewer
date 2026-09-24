/**
 * DiagramML iterator evaluation (ECMA-376 Part 1, 21.4.2.x `dgm:forEach`,
 * `dgm:presOf`, `dgm:if`): axis navigation over the engine's data tree,
 * point-type filtering, `hideLastTrans`, and the `st`/`cnt`/`step` window.
 *
 * Multi-valued attributes (`axis="ch ch" ptType="node node"`) are applied as
 * successive steps, each step starting from every point the previous one
 * produced.
 */

import type { DataPoint } from './data-points';
import type { LdIterator } from './layout-def-types';

function descendants(point: DataPoint, out: DataPoint[]): void {
	for (const child of point.children) {
		out.push(child);
		descendants(child, out);
	}
}

function rootOf(point: DataPoint): DataPoint {
	let current = point;
	while (current.parent) {
		current = current.parent;
	}
	return current;
}

function documentOrder(point: DataPoint): DataPoint[] {
	const all: DataPoint[] = [rootOf(point)];
	descendants(all[0], all);
	return all;
}

/** Points on one axis from `point`, in document order. */
export function axisPoints(point: DataPoint, axis: string): DataPoint[] {
	switch (axis) {
		case 'self':
			return [point];
		case 'ch':
			return [...point.children];
		case 'des': {
			const out: DataPoint[] = [];
			descendants(point, out);
			return out;
		}
		case 'desOrSelf': {
			const out: DataPoint[] = [point];
			descendants(point, out);
			return out;
		}
		case 'par':
			return point.parent ? [point.parent] : [];
		case 'ancst':
		case 'ancstOrSelf': {
			const out: DataPoint[] = axis === 'ancstOrSelf' ? [point] : [];
			let current = point.parent;
			while (current) {
				out.push(current);
				current = current.parent;
			}
			return out;
		}
		case 'followSib':
		case 'precedSib': {
			const siblings = point.parent?.children ?? [];
			const index = siblings.indexOf(point);
			if (index < 0) {
				return [];
			}
			// Both directions stay in document order: every built-in layout
			// reaches the NEAREST preceding sibling with `st="-1"`.
			return axis === 'followSib' ? siblings.slice(index + 1) : siblings.slice(0, index);
		}
		case 'follow':
		case 'preced': {
			const all = documentOrder(point);
			const index = all.indexOf(point);
			return axis === 'follow' ? all.slice(index + 1) : all.slice(0, index);
		}
		case 'root':
			return [rootOf(point)];
		case 'none':
			return [];
		default:
			return [point];
	}
}

/** ST_ElementType filter. `node` covers assistant points as well. */
export function matchesPointType(point: DataPoint, ptType: string | undefined): boolean {
	switch (ptType ?? 'all') {
		case 'all':
			return true;
		case 'node':
			return point.type === 'node' || point.type === 'asst';
		case 'norm':
			return point.type === 'node';
		case 'nonNorm':
			return point.type !== 'node';
		case 'asst':
			return point.type === 'asst';
		case 'nonAsst':
			return point.type === 'node';
		case 'doc':
			return point.type === 'doc';
		case 'parTrans':
			return point.type === 'parTrans';
		case 'sibTrans':
			return point.type === 'sibTrans';
		default:
			return false;
	}
}

const SIBLING_AXES = new Set([
	'ch',
	'des',
	'desOrSelf',
	'followSib',
	'precedSib',
	'follow',
	'preced',
]);

/** True for the last `sibTrans` among its parent's children. */
function isLastSiblingTransition(point: DataPoint): boolean {
	if (point.type !== 'sibTrans' || !point.parent) {
		return false;
	}
	const siblings = point.parent.children;
	for (let i = siblings.length - 1; i >= 0; i--) {
		if (siblings[i].type === 'sibTrans') {
			return siblings[i] === point;
		}
	}
	return false;
}

/** Apply `st`/`cnt`/`step` (1-based start, negative counts from the end). */
export function windowPoints(points: DataPoint[], st = 1, cnt = 0, step = 1): DataPoint[] {
	if (points.length === 0) {
		return [];
	}
	const stride = step === 0 ? 1 : step;
	let index = st > 0 ? st - 1 : st < 0 ? points.length + st : 0;
	const out: DataPoint[] = [];
	while (index >= 0 && index < points.length) {
		out.push(points[index]);
		if (cnt > 0 && out.length >= cnt) {
			break;
		}
		index += stride;
	}
	return out;
}

/** Evaluate one iterator step (`axis[i]`, `ptType[i]`, ...) from `point`. */
function iterateStep(point: DataPoint, iterator: LdIterator, step: number): DataPoint[] {
	const axis = iterator.axis[step] ?? 'none';
	const ptType = iterator.ptType[step] ?? iterator.ptType[iterator.ptType.length - 1] ?? 'all';
	// `hideLastTrans` hides the trailing transition of a sibling run; an axis
	// that does not enumerate siblings (`self`, `par`, `root`, ancestors)
	// re-selects a point already chosen and must not drop it.
	const hideLast = (iterator.hideLastTrans[step] ?? true) && SIBLING_AXES.has(axis);
	let points = axisPoints(point, axis).filter((candidate) => matchesPointType(candidate, ptType));
	if (hideLast) {
		points = points.filter((candidate) => !isLastSiblingTransition(candidate));
	}
	return windowPoints(
		points,
		iterator.st[step] ?? 1,
		iterator.cnt[step] ?? 0,
		iterator.step[step] ?? 1,
	);
}

/**
 * Every point an iterator selects from `point`. An iterator without any
 * `axis` selects nothing (a bare `dgm:presOf`), except that a `ptType`-only
 * iterator filters the point itself.
 */
export function iteratePoints(point: DataPoint, iterator: LdIterator): DataPoint[] {
	if (iterator.axis.length === 0) {
		if (iterator.ptType.length === 0) {
			return [];
		}
		return matchesPointType(point, iterator.ptType[0]) ? [point] : [];
	}
	let current: DataPoint[] = [point];
	for (let step = 0; step < iterator.axis.length; step++) {
		const next: DataPoint[] = [];
		for (const from of current) {
			for (const candidate of iterateStep(from, iterator, step)) {
				if (!next.includes(candidate)) {
					next.push(candidate);
				}
			}
		}
		current = next;
	}
	return current;
}
