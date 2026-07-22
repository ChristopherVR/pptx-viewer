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
	PptxSmartArtPresLayoutVars,
} from 'pptx-viewer-core';

/** Arrangement families the interpreter can execute. */
export type ArrangementKind = 'linear' | 'cycle' | 'hierarchy' | 'pyramid' | 'snake';

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
};

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
 * Hierarchy wins whenever any `hierRoot`/`hierChild` algorithm is present
 * (org-chart / tree). Otherwise the first recognised `lin`/`cycle`/`pyra`/
 * `snake` algorithm found in document order is used. Returns `undefined` when
 * no recognised arrangement algorithm exists, signalling the caller to fall
 * back to the legacy family approximation.
 */
export function discoverArrangement(
	definition: PptxSmartArtLayoutDefinition,
): ArrangementPlan | undefined {
	let hierarchy: PptxSmartArtLayoutNode | undefined;
	let primary: ArrangementPlan | undefined;
	walk(definition.rootNode, (node) => {
		const type = node.algorithm?.type;
		if (!type) {
			return;
		}
		if (type === 'hierRoot' || type === 'hierChild') {
			hierarchy ??= node;
			return;
		}
		if (!primary && type in PRIMARY_ALG) {
			primary = { kind: PRIMARY_ALG[type], node };
		}
	});
	if (hierarchy) {
		return { kind: 'hierarchy', node: hierarchy };
	}
	return primary;
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

/**
 * Resolve a spacing/padding constraint to a *ratio* of the item extent.
 *
 * DiagramML commonly expresses sibling spacing and padding as a factor of a
 * referenced dimension, e.g. `<dgm:constr type="sibSp" refType="w" fact="0.1"/>`.
 * We surface that factor directly. When only a small absolute `val` (< 1) is
 * present we treat it as a ratio too; otherwise the caller's default is used.
 */
export function ratioConstraint(
	constraints: PptxSmartArtConstraint[] | undefined,
	types: readonly string[],
	fallback: number,
): number {
	for (const type of types) {
		const constraint = findConstraint(constraints, type);
		if (!constraint) {
			continue;
		}
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
