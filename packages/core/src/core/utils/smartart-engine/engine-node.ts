/**
 * Runtime state the SmartArt layout engine attaches to each presentation
 * node while laying it out: resolved constraint values, deferred
 * font-relative constraints, equality groups, and the final box.
 */

import type { PresNode } from './pres-tree';

/** A constraint whose value can only be known once text is fitted. */
export interface DeferredConstraint {
	/** The declaring constraint, so a re-evaluation replaces rather than duplicates. */
	source: object;
	type: string;
	op: 'none' | 'equ' | 'gte' | 'lte';
	/** Node whose `refType` value the constraint reads (after fitting). */
	ref: EngineNode;
	refType: string;
	fact: number;
}

/** A set of nodes whose value of `type` must end up equal (`op="equ"`). */
export interface EqualityGroup {
	type: string;
	members: EngineNode[];
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface EngineNode extends PresNode {
	children: EngineNode[];
	parent?: EngineNode;
	/** Resolved constraint values, in points (lengths, font sizes) or raw numbers. */
	values: Map<string, number>;
	/** Numeric lower/upper bounds from `op="gte"`/`"lte"` constraints. */
	minValues: Map<string, number>;
	maxValues: Map<string, number>;
	/** Constraints that reference a fitted font size (margins, linked fonts). */
	deferred: DeferredConstraint[];
	/** Equality groups this node declared for its children/descendants. */
	groups: EqualityGroup[];
	/** Final box, absolute within the diagram, in points. */
	box?: Box;
	/** Rotation in degrees (shape `rot` plus algorithm rotation). */
	rotation: number;
	/** Final primary font size in points once fitted. */
	fontSize?: number;
	/** Final secondary (child-level) font size in points once fitted. */
	secondaryFontSize?: number;
	/** Text box (absolute) when it differs from the shape box. */
	textBox?: Box;
}

/** Promote a presentation tree to engine nodes in place. */
export function toEngineTree(node: PresNode): EngineNode {
	const engine = node as EngineNode;
	engine.values = new Map();
	engine.minValues = new Map();
	engine.maxValues = new Map();
	engine.deferred = [];
	engine.groups = [];
	engine.rotation = 0;
	for (const child of node.children) {
		toEngineTree(child);
	}
	return engine;
}

/** Every node of an engine tree in pre-order. */
export function flattenEngineTree(root: EngineNode): EngineNode[] {
	const out: EngineNode[] = [];
	const visit = (node: EngineNode): void => {
		out.push(node);
		node.children.forEach(visit);
	};
	visit(root);
	return out;
}
