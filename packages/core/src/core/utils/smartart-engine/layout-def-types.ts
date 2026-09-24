/**
 * Typed, document-ordered model of a DiagramML `dgm:layoutDef`
 * (ECMA-376 Part 1, 21.4.2), as executed by the SmartArt layout engine.
 *
 * Unlike the editable `PptxSmartArtLayoutNode` metadata the loader keeps for
 * round-tripping, this model preserves the exact statement order inside every
 * layout node, `dgm:forEach` and `dgm:choose` branch, and keeps each
 * conditional branch intact, so the engine can evaluate the definition per
 * data point the way PowerPoint does.
 */

/** Iterator attributes shared by `dgm:forEach`, `dgm:presOf` and `dgm:if`. */
export interface LdIterator {
	axis: string[];
	ptType: string[];
	hideLastTrans: boolean[];
	st: number[];
	cnt: number[];
	step: number[];
}

/** `dgm:alg`. */
export interface LdAlgorithm {
	type: string;
	params: Record<string, string>;
}

/** `dgm:shape`. */
export interface LdShape {
	type?: string;
	rot: number;
	zOrderOff: number;
	hideGeom: boolean;
	lkTxEntry: boolean;
	blipPhldr: boolean;
	adj: Record<number, number>;
}

/** `dgm:constr` (CT_Constraint), with ECMA defaults already applied. */
export interface LdConstraint {
	type: string;
	for: 'self' | 'ch' | 'des';
	forName?: string;
	ptType: string;
	refType: string;
	refFor: 'self' | 'ch' | 'des';
	refForName?: string;
	refPtType: string;
	op: 'none' | 'equ' | 'gte' | 'lte';
	val: number;
	/** Whether `val` was written (an `op="equ"` without one only links values). */
	hasVal: boolean;
	fact: number;
}

/** `dgm:rule` (CT_NumericRule); NaN marks an absent value. */
export interface LdRule {
	type: string;
	for: 'self' | 'ch' | 'des';
	forName?: string;
	ptType: string;
	val: number;
	fact: number;
	max: number;
}

/** `dgm:if` condition. */
export interface LdCondition extends LdIterator {
	func: string;
	arg?: string;
	op: string;
	val: string;
}

export interface LdForEach {
	kind: 'forEach';
	name?: string;
	ref?: string;
	iterator: LdIterator;
	body: LdStatement[];
}

export interface LdChooseBranch {
	/** Absent for the `dgm:else` branch. */
	condition?: LdCondition;
	body: LdStatement[];
}

export interface LdChoose {
	kind: 'choose';
	branches: LdChooseBranch[];
}

export interface LdLayoutNode {
	kind: 'layoutNode';
	name: string;
	styleLbl?: string;
	chOrder: 'b' | 't';
	moveWith?: string;
	body: LdStatement[];
}

export type LdStatement =
	| LdLayoutNode
	| LdForEach
	| LdChoose
	| { kind: 'alg'; alg: LdAlgorithm }
	| { kind: 'shape'; shape: LdShape }
	| { kind: 'presOf'; iterator: LdIterator }
	| { kind: 'constrLst'; constraints: LdConstraint[] }
	| { kind: 'ruleLst'; rules: LdRule[] }
	| { kind: 'varLst'; vars: Record<string, string> };

/** A parsed layout definition: its root layout node plus named forEach bodies. */
export interface LdDefinition {
	uniqueId?: string;
	root: LdLayoutNode;
	/** Every named `dgm:forEach`, for `ref` resolution. */
	forEachByName: Map<string, LdForEach>;
}
