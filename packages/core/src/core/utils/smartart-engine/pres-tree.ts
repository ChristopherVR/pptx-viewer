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
	/**
	 * `dgm:layoutNode/@moveWith`: the name of a SIBLING layout node (within the
	 * same parent) this node's geometry tracks (ECMA-376 Part 1, 21.4.2.19).
	 * Combined with a `hideGeom` shape, this is how a decorative background
	 * (e.g. `bgRect`) and a borderless text carrier (e.g. `nodeText`) that both
	 * present the same data point are authored as two layout nodes but meant
	 * to read as ONE visual shape; see `engine-to-result.ts`'s sibling-merge
	 * pass, which is the only place this field is consumed.
	 */
	moveWith?: string;
	/** Data point in context when this instance was created. */
	point: DataPoint;
	alg: LdAlgorithm;
	shape?: LdShape;
	/** Points whose text this node presents (`dgm:presOf`). */
	presOf: DataPoint[];
	/** Whether the node declared any `dgm:presOf` axis at all. */
	hasPresOf: boolean;
	/**
	 * Whether the `dgm:presOf` iterator's last axis step includes the point
	 * itself (`self`, `desOrSelf`, `ancstOrSelf`): the first presented point is
	 * then the text's own top-level paragraph and the rest fold under it as
	 * smaller bullets ("Basic Pie"'s wedge: "Node One" 23pt, its child 18pt).
	 * A pure `des`/`ch` iterator presents every point as an equal bullet
	 * ("Vertical Bullet List"'s `childText`: child and grandchild both 27pt).
	 */
	presOfAnchored: boolean;
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
				node.presOfAnchored = /self/i.test(statement.iterator.axis.at(-1) ?? '');
				break;
			case 'constrLst':
				node.constraints.push(...statement.constraints);
				break;
			case 'ruleLst':
				node.rules.push(...statement.rules);
				break;
			case 'varLst':
				Object.assign(node.vars, statement.vars, recordedVars(point, node.name));
				break;
		}
	}
}

/**
 * The variables PowerPoint recorded for this instance on its presentation
 * point (a per-node "Left Hanging" `hierBranch`), which override the
 * definition's own `dgm:varLst` defaults.
 */
function recordedVars(point: DataPoint, name: string): Record<string, string> {
	return point.source?.presLayoutVarsByName?.[name] ?? {};
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
		moveWith: def.moveWith,
		point,
		alg: { type: 'sp', params: {} },
		presOf: [],
		hasPresOf: false,
		presOfAnchored: false,
		constraints: [],
		rules: [],
		vars: { ...recordedVars(point, def.name) },
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
