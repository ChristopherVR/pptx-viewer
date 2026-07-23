/**
 * SmartArt DiagramML interpreter - control-flow execution (forEach / choose).
 *
 * The typed layout model (see `smartart-layout-definition.ts`) flattens the
 * `dgm:forEach` / `dgm:choose` wrappers when it collects nested `layoutNode`s,
 * but it preserves the iterator attributes (`axis`/`ptType`/`st`/`cnt`/`step`/
 * `hideLastTrans`) on each node's `forEach`, and the branch conditions on each
 * node's `choose`. This module executes the decidable parts of that control flow
 * so the SVG-fallback interpreter selects the right number of data points and,
 * where a `dgm:choose` is decidable from the node count, the right branch's
 * arrangement algorithm.
 *
 * Scope / honesty: this is still a partial interpreter. It does NOT resolve
 * point references or run the full recursive solver. `selectArrangedNodes` maps
 * one flat data point per iteration slot and folds transitions into that stream,
 * so `hideLastTrans` trims one trailing slot rather than a separate connector.
 * Pure TypeScript - no framework code, no DOM.
 */

import type {
	PptxSmartArtChoose,
	PptxSmartArtForEach,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtWhen,
	XmlObject,
} from 'pptx-viewer-core';

const localName = (key: string): string => key.split(':').pop() ?? key;

/** Point types that denote a real data node (vs a transition placeholder). */
const NODE_POINT_TYPES = new Set(['node', 'norm', 'nonNorm', 'asst', 'nonAsst', 'doc', 'all']);

/** Structural algorithm types a decidable choose branch may select. */
const CHOOSE_ALG_TYPES = new Set(['lin', 'cycle', 'pyra', 'snake']);

/** First finite entry of a per-axis attribute list, or `undefined`. */
function firstNumber(values: number[] | undefined): number | undefined {
	const value = values?.[0];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Pick the `dgm:forEach` that iterates the data points. Built-ins iterate the
 * points with an `axis="ch" ptType="node"` forEach; a diagram may also carry a
 * transition (`sibTrans`) iterator. We prefer a node-point iterator, then a
 * child-axis iterator, then the first one present.
 */
function drivingIterator(node: PptxSmartArtLayoutNode): PptxSmartArtForEach | undefined {
	const list = node.forEach;
	if (!list || list.length === 0) {
		return undefined;
	}
	const nodeIter = list.find((each) => each.pointTypes?.some((type) => NODE_POINT_TYPES.has(type)));
	if (nodeIter) {
		return nodeIter;
	}
	const axisIter = list.find((each) =>
		each.axis?.some((axis) => axis === 'ch' || axis === 'des' || axis === 'self'),
	);
	return axisIter ?? list[0];
}

/**
 * Apply the driving `dgm:forEach` selection semantics (`st` / `cnt` / `step`) to
 * the flat data-model points and, when the iterator declares `hideLastTrans`,
 * drop the trailing slot. `st` is 1-based (DiagramML default 1); `cnt` of 0
 * means "all"; `step` defaults to 1. Returns `flat` unchanged when the arranger
 * node carries no iterator.
 */
export function selectArrangedNodes(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const iter = drivingIterator(node);
	if (!iter) {
		return flat;
	}
	const start = firstNumber(iter.start);
	const st0 = start !== undefined ? Math.max(0, start - 1) : 0;
	const stepRaw = firstNumber(iter.step);
	const step = stepRaw !== undefined && stepRaw > 0 ? stepRaw : 1;
	const cnt = firstNumber(iter.count) ?? 0;
	const selected: PptxSmartArtNode[] = [];
	for (let i = st0; i < flat.length; i += step) {
		selected.push(flat[i]);
		if (cnt > 0 && selected.length >= cnt) {
			break;
		}
	}
	if (iter.hideLastTransition?.[0] === true && selected.length > 0) {
		selected.pop();
	}
	return selected;
}

/** Parse a numeric branch threshold, or `undefined` when non-numeric. */
function toNumber(value: string): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Evaluate a single `dgm:if` against the node count. Only the count function
 * (`func="cnt"`) is decidable here; every other function (variables, position,
 * depth) returns `undefined` so the caller keeps its blind first-alg behaviour.
 */
function evaluateWhen(when: PptxSmartArtWhen, nodeCount: number): boolean | undefined {
	if (when.function !== 'cnt') {
		return undefined;
	}
	const threshold = toNumber(when.value);
	if (threshold === undefined) {
		return undefined;
	}
	switch (when.operator) {
		case 'equ':
			return nodeCount === threshold;
		case 'neq':
			return nodeCount !== threshold;
		case 'gt':
			return nodeCount > threshold;
		case 'lt':
			return nodeCount < threshold;
		case 'gte':
			return nodeCount >= threshold;
		case 'lte':
			return nodeCount <= threshold;
		default:
			return undefined;
	}
}

/**
 * Resolve the raw XML of the active `dgm:choose` branch for a node count, or
 * `undefined` when the choose is not decidable (an earlier branch is
 * undecidable) or no branch applies. DiagramML picks the first matching `if` in
 * order, so an undecidable earlier branch forces a bail.
 */
function activeBranch(choose: PptxSmartArtChoose, nodeCount: number): XmlObject | undefined {
	for (const when of choose.when) {
		const result = evaluateWhen(when, nodeCount);
		if (result === undefined) {
			return undefined;
		}
		if (result) {
			return when.rawXml;
		}
	}
	return choose.otherwise?.rawXml ?? undefined;
}

/** First recognised structural `dgm:alg` type declared inside a branch's XML. */
function branchAlgType(raw: XmlObject | undefined): string | undefined {
	if (!raw) {
		return undefined;
	}
	let found: string | undefined;
	const visit = (value: unknown): void => {
		if (found !== undefined || !value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		for (const [key, entry] of Object.entries(value as XmlObject)) {
			if (found !== undefined) {
				return;
			}
			if (key.startsWith('@_')) {
				continue;
			}
			if (localName(key) === 'alg') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					const type =
						candidate && typeof candidate === 'object'
							? String((candidate as XmlObject)['@_type'] ?? '')
							: '';
					if (CHOOSE_ALG_TYPES.has(type)) {
						found = type;
						return;
					}
				}
			} else {
				visit(entry);
			}
		}
	};
	visit(raw);
	return found;
}

/**
 * Resolve a count-decidable `dgm:choose` on `node` to the structural algorithm
 * type it selects, or `undefined` when no choose is decidable from the count (in
 * which case the caller keeps the blind first-recognised-alg behaviour).
 */
export function chooseAlgType(node: PptxSmartArtLayoutNode, nodeCount: number): string | undefined {
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	for (const choose of node.choose) {
		const type = branchAlgType(activeBranch(choose, nodeCount));
		if (type !== undefined) {
			return type;
		}
	}
	return undefined;
}
