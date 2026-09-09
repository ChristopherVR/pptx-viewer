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
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
} from '../types';
import {
	hasStructuralDescendant,
	isContinuationForEach,
	isTransitionOnlyChild,
	itemTemplateNodes,
	mapsSlots,
} from './smartart-layout-interpreter-composite-detect';
import { chooseAlgorithm } from './smartart-layout-interpreter-flow';
import { treeMaxDepth, walkWithTreeLocation } from './smartart-layout-interpreter-tree-location';

export {
	clampByRules,
	findConstraint,
	ratioConstraint,
} from './smartart-layout-interpreter-constraints';

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

/**
 * Kinds driven by a real point-flow algorithm (preferred over conn/sp/tx),
 * and where every arranged point gets its own item box from a shared
 * per-item template - so `smartart-layout-interpreter-item-roles.ts`'s
 * multi-role expansion (a list layout's `childText`, a card layout's
 * `roleText`/`bodyText`, ...) applies uniformly to all four. `hierarchy` and
 * `composite` are excluded: hierarchy gives each node's own box independent
 * per-depth treatment, and a top-level `composite` arranger maps points 1:1
 * onto EXPLICIT named slots rather than repeating one item template.
 */
export const STRUCTURAL_ARRANGEMENT_KINDS = new Set<ArrangementKind>([
	'linear',
	'cycle',
	'pyramid',
	'snake',
]);

/**
 * True when a `conn`/`sp`/`tx` node carries enough to arrange as a standalone
 * primary (constraints or children). A bare leaf is meaningless on its own, so
 * the interpreter declines and the caller keeps its legacy approximation.
 */
function isMeaningfulAux(node: PptxSmartArtLayoutNode): boolean {
	return (node.constraints?.length ?? 0) > 0 || (node.children?.length ?? 0) > 0;
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
 *
 * `presLayoutVars`, when supplied, lets a `func="var"` `dgm:if` decide its
 * branch (see `smartart-layout-interpreter-flow.ts`'s `WhenContext`). Every
 * `dgm:choose` visited is also given its declaring node's sibling position
 * (1-based), sibling count, depth, and the tree's max depth, so `"pos"`/
 * `"revPos"`/`"posEven"`/`"posOdd"`/`"depth"`/`"maxDepth"` are decidable
 * here too, not just `"cnt"`/`"var"` (previously the only two reachable).
 *
 * `flatNodes`, when supplied, additionally lets a `func="cnt"` `dgm:if`
 * whose `@axis` needs real compound navigation decide too (ECMA-376
 * 21.4.7.5 - see `smartart-layout-interpreter-when.ts`'s `resolveAxisCount`
 * doc comment for the exact fixture this fixes, `basic-radial--hier5.pptx`'s
 * `axis="ch ch"` `stAng` choose). Omitted keeps every such `cnt` on the
 * older, coarser `nodeCount`-only comparison, exactly as before.
 */
export function discoverArrangement(
	definition: PptxSmartArtLayoutDefinition,
	nodeCount?: number,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
	flatNodes?: PptxSmartArtNode[],
): ArrangementPlan | undefined {
	let hierarchy: PptxSmartArtLayoutNode | undefined;
	let chosen: ArrangementPlan | undefined;
	let compositeSlot: PptxSmartArtLayoutNode | undefined;
	let structural: ArrangementPlan | undefined;
	let aux: ArrangementPlan | undefined;
	const maxDepth = treeMaxDepth(definition.rootNode);
	const itemTemplates = new Set<PptxSmartArtLayoutNode>();
	itemTemplateNodes(definition.rootNode, itemTemplates);
	walkWithTreeLocation(definition.rootNode, (node, location) => {
		if (
			!hierarchy &&
			!chosen &&
			nodeCount !== undefined &&
			node.choose &&
			node.choose.length > 0 &&
			!isContinuationForEach(node)
		) {
			// `chooseAlgorithm` keeps the winning branch's `dgm:param`s (see its doc comment).
			const resolvedAlg = chooseAlgorithm(node, nodeCount, {
				presLayoutVars,
				position: location.position,
				total: location.total,
				depth: location.depth,
				maxDepth,
				nodes: flatNodes,
			});
			const type = resolvedAlg?.type;
			// A genuine org-chart layoutDef wraps its OWN root `hierChild`/
			// `hierRoot` algorithm in a `dgm:choose` (`smartart-orgchart-
			// hierbranch.pptx`) - checked here too, alongside the STRUCTURAL
			// kinds below. Keeps the ORIGINAL `node` fallback (not the
			// param-carrying `withResolvedAlg` the non-hierarchy branch uses
			// below): hierarchy's own params resolve via `presLayoutVars`, not
			// `algorithmParam`, and hierarchy code elsewhere compares nodes by
			// REFERENCE against the original tree, which a `{...node}` copy
			// would defeat.
			if (type === 'hierRoot' || type === 'hierChild') {
				hierarchy = node.children?.find((child) => child.algorithm?.type === type) ?? node;
			} else {
				const withResolvedAlg = resolvedAlg ? { ...node, algorithm: resolvedAlg } : node;
				const kind = type ? PRIMARY_ALG[type] : undefined;
				const arranger =
					node.children?.find(
						(child) =>
							child.algorithm?.type === type &&
							!isTransitionOnlyChild(child) &&
							!isContinuationForEach(child),
					) ?? withResolvedAlg;
				if (kind && STRUCTURAL_ARRANGEMENT_KINDS.has(kind)) {
					chosen = { kind, node: arranger };
				} else if (kind === 'composite' && !itemTemplates.has(arranger) && mapsSlots(arranger)) {
					// A count/direction-decidable `dgm:choose` picking `composite`
					// for one branch (a fixed grid, `cycleMatrixDiagram`'s small-N
					// layout) and something else for another must win with the SAME
					// priority as a chosen STRUCTURAL kind - otherwise the blind
					// alg walk below (`compositeSlot`) can commit to whichever
					// alternative's `dgm:alg` happens to appear FIRST in the raw
					// XML, ignoring the choose's actual data-driven decision (a
					// regression `target-list`/`captioned-pictures`/`vertical-
					// accent-list` measured once `mapsSlots` started recognising
					// arranger-declared slot constraints).
					chosen = { kind, node: arranger };
				}
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
			if (
				!compositeSlot &&
				!itemTemplates.has(node) &&
				!hasStructuralDescendant(node) &&
				mapsSlots(node)
			) {
				compositeSlot = node;
			}
			return;
		}
		if (STRUCTURAL_ARRANGEMENT_KINDS.has(kind)) {
			if (!isContinuationForEach(node)) {
				structural ??= { kind, node };
			}
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
