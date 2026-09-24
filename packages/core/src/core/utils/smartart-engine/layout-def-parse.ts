/**
 * Parse a DiagramML `dgm:layoutDef` part (as text) into the document-ordered
 * {@link LdDefinition} the SmartArt layout engine executes. Attribute
 * defaults follow the ECMA-376 Part 1 schema (21.4.2 / 21.4.7 simple types).
 */

import type {
	LdAlgorithm,
	LdChoose,
	LdCondition,
	LdConstraint,
	LdDefinition,
	LdForEach,
	LdIterator,
	LdLayoutNode,
	LdRule,
	LdShape,
	LdStatement,
} from './layout-def-types';
import { findOrderedDescendant, parseOrderedXml } from './ordered-xml';
import type { OrderedXmlElement } from './ordered-xml';

function list(value: string | undefined): string[] {
	return value === undefined ? [] : value.trim().split(/\s+/u).filter(Boolean);
}

function numberList(value: string | undefined): number[] {
	return list(value).map(Number);
}

function boolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}
	return value === '1' || value === 'true';
}

function num(value: string | undefined, fallback: number): number {
	if (value === undefined || value === '') {
		return fallback;
	}
	if (value === 'INF') {
		return Number.POSITIVE_INFINITY;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? fallback : parsed;
}

/** `NaN`-preserving number (rules use NaN for "absent"). */
function numOrNaN(value: string | undefined): number {
	if (value === undefined || value === 'NaN') {
		return Number.NaN;
	}
	if (value === 'INF') {
		return Number.POSITIVE_INFINITY;
	}
	return Number(value);
}

function relation(value: string | undefined): 'self' | 'ch' | 'des' {
	return value === 'ch' || value === 'des' ? value : 'self';
}

export function parseIterator(attrs: Record<string, string>): LdIterator {
	return {
		axis: list(attrs.axis),
		ptType: list(attrs.ptType),
		hideLastTrans: list(attrs.hideLastTrans).map((v) => v === '1' || v === 'true'),
		st: numberList(attrs.st),
		cnt: numberList(attrs.cnt),
		step: numberList(attrs.step),
	};
}

function parseAlgorithm(element: OrderedXmlElement): LdAlgorithm {
	const params: Record<string, string> = {};
	for (const child of element.children) {
		if (child.name === 'param' && child.attrs.type) {
			params[child.attrs.type] = child.attrs.val ?? '';
		}
	}
	return { type: element.attrs.type ?? 'sp', params };
}

function parseShape(element: OrderedXmlElement): LdShape {
	const adj: Record<number, number> = {};
	const adjList = element.children.find((child) => child.name === 'adjLst');
	for (const entry of adjList?.children ?? []) {
		if (entry.name === 'adj') {
			adj[Number(entry.attrs.idx)] = Number(entry.attrs.val);
		}
	}
	const type = element.attrs.type;
	return {
		type: type && type !== 'none' ? type : undefined,
		rot: num(element.attrs.rot, 0),
		zOrderOff: num(element.attrs.zOrderOff, 0),
		hideGeom: boolean(element.attrs.hideGeom, false),
		lkTxEntry: boolean(element.attrs.lkTxEntry, false),
		blipPhldr: boolean(element.attrs.blipPhldr, false),
		adj,
	};
}

function parseConstraint(attrs: Record<string, string>): LdConstraint {
	const op = attrs.op;
	return {
		type: attrs.type ?? 'none',
		for: relation(attrs.for),
		forName: attrs.forName || undefined,
		ptType: attrs.ptType ?? 'all',
		refType: attrs.refType ?? 'none',
		refFor: relation(attrs.refFor),
		refForName: attrs.refForName || undefined,
		refPtType: attrs.refPtType ?? 'all',
		op: op === 'equ' || op === 'gte' || op === 'lte' ? op : 'none',
		val: num(attrs.val, 0),
		hasVal: attrs.val !== undefined,
		fact: num(attrs.fact, 1),
	};
}

function parseRule(attrs: Record<string, string>): LdRule {
	return {
		type: attrs.type ?? 'none',
		for: relation(attrs.for),
		forName: attrs.forName || undefined,
		ptType: attrs.ptType ?? 'all',
		val: numOrNaN(attrs.val),
		fact: numOrNaN(attrs.fact),
		max: numOrNaN(attrs.max),
	};
}

function parseCondition(attrs: Record<string, string>): LdCondition {
	return {
		...parseIterator(attrs),
		func: attrs.func ?? 'cnt',
		arg: attrs.arg,
		op: attrs.op ?? 'equ',
		val: attrs.val ?? '',
	};
}

interface ParseState {
	forEachByName: Map<string, LdForEach>;
}

function parseBody(element: OrderedXmlElement, state: ParseState): LdStatement[] {
	const body: LdStatement[] = [];
	for (const child of element.children) {
		const statement = parseStatement(child, state);
		if (statement) {
			body.push(statement);
		}
	}
	return body;
}

function parseLayoutNode(element: OrderedXmlElement, state: ParseState): LdLayoutNode {
	return {
		kind: 'layoutNode',
		name: element.attrs.name ?? '',
		styleLbl: element.attrs.styleLbl || undefined,
		chOrder: element.attrs.chOrder === 't' ? 't' : 'b',
		moveWith: element.attrs.moveWith || undefined,
		body: parseBody(element, state),
	};
}

function parseChoose(element: OrderedXmlElement, state: ParseState): LdChoose {
	const branches = element.children
		.filter((child) => child.name === 'if' || child.name === 'else')
		.map((child) => ({
			condition: child.name === 'if' ? parseCondition(child.attrs) : undefined,
			body: parseBody(child, state),
		}));
	return { kind: 'choose', branches };
}

function parseStatement(element: OrderedXmlElement, state: ParseState): LdStatement | undefined {
	switch (element.name) {
		case 'layoutNode':
			return parseLayoutNode(element, state);
		case 'forEach': {
			const forEach: LdForEach = {
				kind: 'forEach',
				name: element.attrs.name || undefined,
				ref: element.attrs.ref || undefined,
				iterator: parseIterator(element.attrs),
				body: parseBody(element, state),
			};
			if (forEach.name) {
				state.forEachByName.set(forEach.name, forEach);
			}
			return forEach;
		}
		case 'choose':
			return parseChoose(element, state);
		case 'alg':
			return { kind: 'alg', alg: parseAlgorithm(element) };
		case 'shape':
			return { kind: 'shape', shape: parseShape(element) };
		case 'presOf':
			return { kind: 'presOf', iterator: parseIterator(element.attrs) };
		case 'constrLst':
			return {
				kind: 'constrLst',
				constraints: element.children
					.filter((c) => c.name === 'constr')
					.map((c) => parseConstraint(c.attrs)),
			};
		case 'ruleLst':
			return {
				kind: 'ruleLst',
				rules: element.children.filter((c) => c.name === 'rule').map((c) => parseRule(c.attrs)),
			};
		case 'varLst': {
			const vars: Record<string, string> = {};
			for (const entry of element.children) {
				vars[entry.name] = entry.attrs.val ?? '';
			}
			return { kind: 'varLst', vars };
		}
		default:
			return undefined;
	}
}

/**
 * Parse layout-definition XML text. Returns `undefined` when the text holds
 * no `layoutDef` with a root `layoutNode`.
 */
export function parseLayoutDefinitionXml(xml: string): LdDefinition | undefined {
	const document = parseOrderedXml(xml);
	const layoutDef =
		document?.name === 'layoutDef' ? document : findOrderedDescendant(document, 'layoutDef');
	const rootElement = layoutDef?.children.find((child) => child.name === 'layoutNode');
	if (!layoutDef || !rootElement) {
		return undefined;
	}
	const state: ParseState = { forEachByName: new Map() };
	return {
		uniqueId: layoutDef.attrs.uniqueId,
		root: parseLayoutNode(rootElement, state),
		forEachByName: state.forEachByName,
	};
}
