/**
 * SmartArt DiagramML interpreter - shared model helpers.
 *
 * These back the *real* (partial) layout interpreter that walks a parsed
 * `dgm:layoutDef` (`PptxSmartArtLayoutDefinition`) and produces per-node
 * geometry for the common `dgm:alg` families, instead of the legacy
 * name-based family switch. Pure TypeScript - no framework code, no DOM.
 *
 * Scope / honesty: the typed layout model flattens `dgm:forEach` / `dgm:choose`
 * wrappers when collecting nested `layoutNode`s (see
 * `smartart-layout-definition.ts`), so this interpreter does NOT run the full
 * recursive control-flow / constraint-reference solver. Instead it:
 *   - reads the primary `dgm:alg` type from the definition to pick an
 *     arrangement family (lin / cycle / hierRoot|hierChild / pyra / snake),
 *   - reads the arranger node's direction params (`linDir`, `stAng`, `spanAng`),
 *   - applies the scalar `dgm:constr` factors (sp / sibSp / begPad / endPad and
 *     w/h aspect) that are already parsed,
 *   - arranges the *actual data-model nodes* accordingly.
 * When the definition contains no recognised arrangement algorithm the
 * interpreter declines (returns `undefined`) and the caller keeps the legacy
 * approximation. This module only exposes the discovery + constraint helpers.
 */

import type {
	PptxSmartArtConstraint,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNumericRule,
	PptxSmartArtPresLayoutVars,
} from 'pptx-viewer-core';

import { chooseAlgType } from './smartart-layout-interpreter-flow';

/** Arrangement families the interpreter can execute. */
export type ArrangementKind =
	| 'linear'
	| 'cycle'
	| 'hierarchy'
	| 'pyramid'
	| 'snake'
	| 'composite'
	| 'conn'
	| 'spacer'
	| 'text';

/** The arranger `layoutNode` plus the resolved arrangement family. */
export interface ArrangementPlan {
	kind: ArrangementKind;
	/** The `layoutNode` carrying the arrangement algorithm + its constraints. */
	node: PptxSmartArtLayoutNode;
}

/** Map a non-hierarchy `dgm:alg` type to an arrangement family. */
const PRIMARY_ALG: Readonly<Record<string, ArrangementKind>> = {
	lin: 'linear',
	cycle: 'cycle',
	pyra: 'pyramid',
	snake: 'snake',
	composite: 'composite',
	conn: 'conn',
	sp: 'spacer',
	tx: 'text',
};

/** Kinds driven by a real point-flow algorithm (preferred over conn/sp/tx). */
const STRUCTURAL = new Set<ArrangementKind>(['linear', 'cycle', 'pyramid', 'snake']);

/** Constraint types that position a composite child into an explicit slot. */
const SLOT_CONSTRAINTS = new Set(['l', 't', 'w', 'h', 'ctrX', 'ctrY']);

/**
 * True when a composite's child `layoutNode`s carry positioning constraints that
 * map data points into fixed slots. Only then does `composite` win; otherwise it
 * is a passive wrapper and the interpreter recurses to the inner arrangement.
 */
function mapsSlots(node: PptxSmartArtLayoutNode): boolean {
	return (node.children ?? []).some((child) =>
		(child.constraints ?? []).some((constraint) => SLOT_CONSTRAINTS.has(constraint.type)),
	);
}

/**
 * True when a `conn`/`sp`/`tx` node carries enough to arrange as a standalone
 * primary (constraints or children). A bare leaf is meaningless on its own, so
 * the interpreter declines and the caller keeps its legacy approximation.
 */
function isMeaningfulAux(node: PptxSmartArtLayoutNode): boolean {
	return (node.constraints?.length ?? 0) > 0 || (node.children?.length ?? 0) > 0;
}

/** Depth-first walk of the flattened layout-node tree. */
function walk(node: PptxSmartArtLayoutNode, visit: (node: PptxSmartArtLayoutNode) => void): void {
	visit(node);
	for (const child of node.children ?? []) {
		walk(child, visit);
	}
}

/**
 * Determine which arrangement algorithm drives the diagram.
 *
 * Precedence (highest first):
 *   1. hierarchy    - any `hierRoot`/`hierChild` (org-chart / tree) always wins.
 *   2. choose        - a `dgm:choose` that is decidable from `nodeCount` selects
 *                      its branch's structural algorithm instead of the blind
 *                      first-found one. Undecidable chooses fall through.
 *   3. composite     - a `composite` whose child slots carry positioning
 *                      constraints (maps data points into fixed slots). A passive
 *                      composite wrapper is skipped so its inner arrangement wins.
 *   4. structural    - the first `lin`/`cycle`/`pyra`/`snake` in document order.
 *   5. conn/sp/tx     - only when they are the dominant/only algorithm (no
 *                      structural or slot-mapping composite present) and carry
 *                      constraints/children.
 *
 * `nodeCount` (the flat data-point count) is optional; when omitted the choose
 * step is skipped and the blind first-alg behaviour is preserved. Returns
 * `undefined` when nothing is recognised, so the caller keeps the legacy family
 * approximation.
 */
export function discoverArrangement(
	definition: PptxSmartArtLayoutDefinition,
	nodeCount?: number,
): ArrangementPlan | undefined {
	let hierarchy: PptxSmartArtLayoutNode | undefined;
	let chosen: ArrangementPlan | undefined;
	let compositeSlot: PptxSmartArtLayoutNode | undefined;
	let structural: ArrangementPlan | undefined;
	let aux: ArrangementPlan | undefined;
	walk(definition.rootNode, (node) => {
		if (!chosen && nodeCount !== undefined && node.choose && node.choose.length > 0) {
			const type = chooseAlgType(node, nodeCount);
			const kind = type ? PRIMARY_ALG[type] : undefined;
			if (kind && STRUCTURAL.has(kind)) {
				const arranger = node.children?.find((child) => child.algorithm?.type === type) ?? node;
				chosen = { kind, node: arranger };
			}
		}
		const type = node.algorithm?.type;
		if (!type) {
			return;
		}
		if (type === 'hierRoot' || type === 'hierChild') {
			hierarchy ??= node;
			return;
		}
		const kind = PRIMARY_ALG[type];
		if (!kind) {
			return;
		}
		if (kind === 'composite') {
			if (!compositeSlot && mapsSlots(node)) {
				compositeSlot = node;
			}
			return;
		}
		if (STRUCTURAL.has(kind)) {
			structural ??= { kind, node };
			return;
		}
		if (!aux && isMeaningfulAux(node)) {
			aux = { kind, node };
		}
	});
	if (hierarchy) {
		return { kind: 'hierarchy', node: hierarchy };
	}
	if (chosen) {
		return chosen;
	}
	if (compositeSlot) {
		return { kind: 'composite', node: compositeSlot };
	}
	return structural ?? aux;
}

/** The first nested item `layoutNode` under an arranger (the per-point shape). */
export function itemNode(arranger: PptxSmartArtLayoutNode): PptxSmartArtLayoutNode | undefined {
	return arranger.children?.[0];
}

/** Find the first constraint of `type`, optionally restricted to a relationship. */
export function findConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	type: string,
	forRel?: PptxSmartArtConstraint['for'],
): PptxSmartArtConstraint | undefined {
	return constraints?.find(
		(constraint) => constraint.type === type && (forRel === undefined || constraint.for === forRel),
	);
}

/** Read a constraint's ratio (`fact`, or a sub-1 `val`), or `undefined`. */
function constraintRatio(constraint: PptxSmartArtConstraint): number | undefined {
	if (typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)) {
		return Math.max(0, constraint.factor);
	}
	if (
		typeof constraint.value === 'number' &&
		Number.isFinite(constraint.value) &&
		constraint.value >= 0 &&
		constraint.value < 1
	) {
		return constraint.value;
	}
	return undefined;
}

/** Clamp a ratio to a matching `dgm:ruleLst` numeric rule's `max`, when present. */
function clampByRules(
	value: number,
	rules: PptxSmartArtNumericRule[] | undefined,
	type: string,
): number {
	const rule = rules?.find((entry) => entry.type === type);
	if (rule && typeof rule.max === 'number' && Number.isFinite(rule.max)) {
		return Math.min(value, rule.max);
	}
	return value;
}

/**
 * Resolve a spacing/padding constraint to a *ratio* of the item extent.
 *
 * DiagramML commonly expresses sibling spacing and padding as a factor of a
 * referenced dimension, e.g. `<dgm:constr type="sibSp" refType="w" fact="0.1"/>`.
 * We surface that factor directly. When only a small absolute `val` (< 1) is
 * present we treat it as a ratio too; otherwise the caller's default is used.
 *
 * A `for="ch"` constraint (the child-scoped form real diagrams use for sibling
 * spacing / padding) is preferred over an unscoped one, and the result is capped
 * by any matching `dgm:ruleLst` numeric rule `max` when `rules` is supplied.
 */
export function ratioConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	types: readonly string[],
	fallback: number,
	rules?: PptxSmartArtNumericRule[],
): number {
	for (const type of types) {
		const matches = (constraints ?? []).filter((constraint) => constraint.type === type);
		const ordered = [
			...matches.filter((constraint) => constraint.for === 'ch'),
			...matches.filter((constraint) => constraint.for !== 'ch'),
		];
		for (const constraint of ordered) {
			const ratio = constraintRatio(constraint);
			if (ratio !== undefined) {
				return clampByRules(ratio, rules, type);
			}
		}
	}
	return fallback;
}

/** Read an algorithm parameter value by its `dgm:param` type. */
export function algorithmParam(node: PptxSmartArtLayoutNode, type: string): string | undefined {
	return node.algorithm?.parameters?.find((param) => param.type === type)?.value;
}

/** Read a numeric algorithm parameter, returning `fallback` when absent/invalid. */
export function numericParam(node: PptxSmartArtLayoutNode, type: string, fallback: number): number {
	const raw = algorithmParam(node, type);
	if (raw === undefined) {
		return fallback;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/** Orientation + ordering resolved from `linDir` and presentation variables. */
export interface FlowDirection {
	orientation: 'horizontal' | 'vertical';
	reverse: boolean;
}

/**
 * Resolve linear flow direction from the arranger's `linDir` param and the
 * data model's `dgm:dir` (`presLayoutVars.direction`). `fromR`/`fromB` and a
 * reversed direction both flip the placement order.
 */
export function resolveFlowDirection(
	arranger: PptxSmartArtLayoutNode,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): FlowDirection {
	const linDir = algorithmParam(arranger, 'linDir');
	const vertical = linDir === 'fromT' || linDir === 'fromB';
	let reverse = linDir === 'fromR' || linDir === 'fromB';
	if (presLayoutVars?.direction === 'rev') {
		reverse = !reverse;
	}
	return { orientation: vertical ? 'vertical' : 'horizontal', reverse };
}
