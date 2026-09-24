/**
 * Expand a layout definition against the data model into the presentation
 * tree: one {@link PresNode} per `dgm:layoutNode` instance, created for the
 * data point in context when the statement is reached (ECMA-376 Part 1,
 * 21.4.2.19 / 21.4.4). `dgm:forEach` rebinds the context point for its body,
 * `dgm:choose` runs the first branch whose `dgm:if` holds for the context
 * point, and a node's own `alg`/`shape`/`presOf`/constraint/rule/variable
 * statements (including ones nested in a `choose`) configure that instance.
 */

import { iteratePoints } from './axis';
import { evaluateCondition } from './conditions';
import type { DataPoint } from './data-points';
import type {
	LdAlgorithm,
	LdConstraint,
	LdDefinition,
	LdForEach,
	LdLayoutNode,
	LdRule,
	LdShape,
	LdStatement,
} from './layout-def-types';

export interface PresNode {
	name: string;
	styleLbl?: string;
	/** Data point in context when this instance was created. */
	point: DataPoint;
	alg: LdAlgorithm;
	shape?: LdShape;
	/** Points whose text this node presents (`dgm:presOf`). */
	presOf: DataPoint[];
	/** Whether the node declared any `dgm:presOf` axis at all. */
	hasPresOf: boolean;
	constraints: LdConstraint[];
	rules: LdRule[];
	vars: Record<string, string>;
	children: PresNode[];
	parent?: PresNode;
	/** Document-order index, used for stable z-ordering. */
	order: number;
}

/** Diagram-level variable overrides stored in the data model. */
export interface PresTreeOptions {
	direction?: 'norm' | 'rev';
}

interface ExpandState {
	def: LdDefinition;
	options: PresTreeOptions;
	counter: number;
	depth: number;
}

const MAX_DEPTH = 96;

function lookupVariable(
	node: PresNode,
	name: string,
	options: PresTreeOptions,
): string | undefined {
	if (name === 'dir' && options.direction) {
		return options.direction;
	}
	let current: PresNode | undefined = node;
	while (current) {
		const value = current.vars[name];
		if (value !== undefined && value !== '') {
			return value;
		}
		current = current.parent;
	}
	return undefined;
}

function resolveForEach(forEach: LdForEach, state: ExpandState): LdForEach {
	if (!forEach.ref) {
		return forEach;
	}
	return state.def.forEachByName.get(forEach.ref) ?? forEach;
}

function walk(
	statements: LdStatement[],
	point: DataPoint,
	node: PresNode,
	state: ExpandState,
): void {
	for (const statement of statements) {
		switch (statement.kind) {
			case 'layoutNode': {
				const child = buildNode(statement, point, node, state);
				if (child) {
					node.children.push(child);
				}
				break;
			}
			case 'forEach': {
				const forEach = resolveForEach(statement, state);
				if (state.depth > MAX_DEPTH) {
					break;
				}
				state.depth++;
				for (const next of iteratePoints(point, forEach.iterator)) {
					walk(forEach.body, next, node, state);
				}
				state.depth--;
				break;
			}
			case 'choose': {
				const branch = statement.branches.find(
					(candidate) =>
						!candidate.condition ||
						evaluateCondition(candidate.condition, point, (name) =>
							lookupVariable(node, name, state.options),
						),
				);
				if (branch) {
					walk(branch.body, point, node, state);
				}
				break;
			}
			case 'alg':
				node.alg = statement.alg;
				break;
			case 'shape':
				node.shape = statement.shape;
				break;
			case 'presOf':
				node.presOf = iteratePoints(point, statement.iterator);
				node.hasPresOf = statement.iterator.axis.length > 0;
				break;
			case 'constrLst':
				node.constraints.push(...statement.constraints);
				break;
			case 'ruleLst':
				node.rules.push(...statement.rules);
				break;
			case 'varLst':
				Object.assign(node.vars, statement.vars);
				break;
		}
	}
}

function buildNode(
	def: LdLayoutNode,
	point: DataPoint,
	parent: PresNode | undefined,
	state: ExpandState,
): PresNode | undefined {
	if (state.depth > MAX_DEPTH) {
		return undefined;
	}
	const node: PresNode = {
		name: def.name,
		styleLbl: def.styleLbl,
		point,
		alg: { type: 'sp', params: {} },
		presOf: [],
		hasPresOf: false,
		constraints: [],
		rules: [],
		vars: {},
		children: [],
		parent,
		order: state.counter++,
	};
	state.depth++;
	walk(def.body, point, node, state);
	state.depth--;
	return node;
}

/** Expand `def` for the data model rooted at `doc`. */
export function buildPresentationTree(
	def: LdDefinition,
	doc: DataPoint,
	options: PresTreeOptions = {},
): PresNode | undefined {
	return buildNode(def.root, doc, undefined, { def, options, counter: 0, depth: 0 });
}

/** Every node of the tree in pre-order. */
export function flattenPresTree(root: PresNode): PresNode[] {
	const out: PresNode[] = [];
	const visit = (node: PresNode): void => {
		out.push(node);
		node.children.forEach(visit);
	};
	visit(root);
	return out;
}
