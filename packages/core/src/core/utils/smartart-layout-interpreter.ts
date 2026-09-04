/**
 * SmartArt DiagramML interpreter - public entry point + dispatch.
 *
 * Walks a parsed `dgm:layoutDef` (`PptxSmartArtLayoutDefinition`) and, when it
 * recognises the primary `dgm:alg` family, executes a real (partial) layout for
 * the actual data-model nodes: linear (`lin`), cycle (`cycle`), hierarchy
 * (`hierRoot`/`hierChild`), pyramid (`pyra`), snake (`snake`), composite
 * (`composite`), and the auxiliary connector/spacer/text leaves (`conn`/`sp`/
 * `tx`). Otherwise it returns `undefined` so the caller keeps the legacy family
 * approximation.
 *
 * This is intentionally a *partial* interpreter (see
 * `smartart-layout-interpreter-model.ts` for the honest scope note): it honours
 * the arrangement algorithm, its direction/angle parameters, and the scalar
 * `dgm:constr` factors, and executes the decidable parts of `dgm:forEach`
 * (st/cnt/step + hideLastTrans point selection) and `dgm:choose` (count-decidable
 * branch selection), but does not run the full recursive constraint-reference
 * solver.
 *
 * Lives in `pptx-viewer-core` (moved from `pptx-viewer-shared`) so it is the
 * SINGLE interpreter used both by the SVG-fallback preview path (every
 * binding, via `pptx-viewer-shared`'s re-export) and by this package's own
 * save/decompose pipeline, which fabricates the cached `dsp:` diagram drawing
 * when PowerPoint's own is absent (`smartart-decompose.ts`,
 * `smartart-interpreter-drawing-bridge.ts`). `pptx-viewer-core` cannot import
 * `pptx-viewer-shared` (shared depends on core, not the reverse), so this is
 * the only direction that avoids a circular dependency; see
 * `smartart-layout-types.ts` for the same note. It only runs on the path with
 * no cached `dsp` drawing part; a valid pre-existing cached drawing still wins
 * (see `PptxHandlerRuntimeSaveDocumentParts.ts`).
 */

import type {
	PptxSmartArtConnection,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { arrangeConn, arrangeSpacer, arrangeText } from './smartart-layout-interpreter-aux';
import { arrangeComposite } from './smartart-layout-interpreter-composite';
import { applyCustomLayoutOverrides } from './smartart-layout-interpreter-custom';
import { arrangeCycle } from './smartart-layout-interpreter-cycle';
import { selectArrangedNodes } from './smartart-layout-interpreter-flow';
import { arrangeHierarchy } from './smartart-layout-interpreter-hierarchy';
import { arrangeLinear, arrangeSnake } from './smartart-layout-interpreter-linear';
import {
	discoverArrangement,
	itemNode,
	resolveFlowDirection,
} from './smartart-layout-interpreter-model';
import type { ArrangementKind, ArrangementPlan } from './smartart-layout-interpreter-model';
import {
	applyNamedRuleOverride,
	collectNamedRules,
	resolveNamedRuleOverride,
} from './smartart-layout-interpreter-named-rules';
import { arrangePyramid } from './smartart-layout-interpreter-pyramid';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';
import { applySmartArtRoleColors } from './smartart-node-role-colors';
import type { SmartArtColorRoleMap } from './smartart-node-role-colors';

/**
 * Arrangement kinds where one item layoutNode template covers every rendered
 * point, so a `forName`-scoped rule override resolves unambiguously (see
 * `smartart-layout-interpreter-named-rules.ts`). `hierarchy` and `composite`
 * are deliberately excluded: they have no single uniform role name to key
 * off, and neither does the `conn`/`spacer`/`text` aux fallback.
 */
const NAMED_OVERRIDE_KINDS = new Set<ArrangementKind>(['linear', 'snake', 'cycle', 'pyramid']);

/** Inputs for a single interpreter run. */
export interface InterpretLayoutInput {
	/** Parsed layout definition (from `PptxSmartArtData.layoutDefinition`). */
	layoutDefinition: PptxSmartArtLayoutDefinition | undefined;
	/** Original (possibly nested) data-model nodes - used for hierarchy. */
	nodes: PptxSmartArtNode[];
	/** Depth-first flattened nodes - used for flat arrangements. */
	flat: PptxSmartArtNode[];
	box: BoundingBox;
	palette: string[];
	style: SmartArtStyle;
	elementId: string;
	/** Presentation layout variables (direction / hierBranch / orgChart). */
	presLayoutVars?: PptxSmartArtPresLayoutVars;
	/**
	 * Per-styleLbl-role resolved colour lists (from
	 * `PptxSmartArtColorTransform.roleColors`). When present, a node whose
	 * {@link PptxSmartArtNode.styleRole} matches a key gets that role's own
	 * cycled fill colour instead of the generic `palette` cycling - see
	 * `smartart-node-role-colors.ts`.
	 */
	colorRoles?: SmartArtColorRoleMap;
	/**
	 * Data-model connections (from `PptxSmartArtData.connections`). Only
	 * consulted by the hierarchy arranger, to label a `parOf` edge's rendered
	 * connector from its linked `parTrans` point's text (a
	 * `connection.label` set by `parseSmartArtConnections`).
	 */
	connections?: PptxSmartArtConnection[];
}

/** Build `${parentId}>${childId} -> label` from labelled `parOf` connections. */
function buildConnectorLabels(
	connections: PptxSmartArtConnection[] | undefined,
): Map<string, string> | undefined {
	if (!connections || connections.length === 0) {
		return undefined;
	}
	const labels = new Map<string, string>();
	for (const connection of connections) {
		if (!connection.label) {
			continue;
		}
		const isParentChildEdge = !connection.type || connection.type === 'parOf';
		if (isParentChildEdge) {
			labels.set(`${connection.sourceId}>${connection.destId}`, connection.label);
		}
	}
	return labels.size > 0 ? labels : undefined;
}

/** Run the recognised arrangement algorithm, or `undefined` when none applies. */
function runArrangement(input: InterpretLayoutInput): SmartArtLayoutResult | undefined {
	const { layoutDefinition, nodes, flat, box, palette, style, elementId, presLayoutVars } = input;
	if (!layoutDefinition || flat.length === 0) {
		return undefined;
	}
	const plan = discoverArrangement(layoutDefinition, flat.length, presLayoutVars);
	if (!plan) {
		return undefined;
	}

	// Hierarchy consumes the nested tree directly; every other family arranges the
	// flat points after applying the arranger's forEach selection (st/cnt/step +
	// hideLastTrans). When the selection empties the set, decline so the caller
	// keeps its legacy approximation.
	if (plan.kind === 'hierarchy') {
		return arrangeHierarchy(
			nodes,
			box,
			palette,
			style,
			elementId,
			presLayoutVars,
			buildConnectorLabels(input.connections),
			plan.node,
		);
	}
	const arranged = selectArrangedNodes(plan.node, flat);
	if (arranged.length === 0) {
		return undefined;
	}

	const constraintIndex = buildConstraintIndex(layoutDefinition);
	const result = dispatchArrangement(
		plan,
		arranged,
		box,
		palette,
		style,
		elementId,
		presLayoutVars,
		constraintIndex,
	);
	if (!result || !NAMED_OVERRIDE_KINDS.has(plan.kind)) {
		return result;
	}
	// Apply any `dgm:rule/@forName` override that names the arranger's item
	// template (see `smartart-layout-interpreter-named-rules.ts`): declared
	// anywhere in the tree, resolved by the item layoutNode's own `name`.
	const override = resolveNamedRuleOverride(
		collectNamedRules(layoutDefinition),
		itemNode(plan.node)?.name,
	);
	return applyNamedRuleOverride(result, override, box);
}

/** Dispatch a discovered plan to its arranger, or `undefined` when declined. */
function dispatchArrangement(
	plan: ArrangementPlan,
	arranged: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	index: ConstraintIndex,
): SmartArtLayoutResult | undefined {
	switch (plan.kind) {
		case 'linear': {
			const flow = resolveFlowDirection(plan.node, presLayoutVars);
			return arrangeLinear(plan, flow, arranged, box, palette, style, elementId, index);
		}
		case 'snake':
			return arrangeSnake(plan, arranged, box, palette, style, elementId, index);
		case 'cycle':
			return arrangeCycle(plan, arranged, box, palette, style, elementId);
		case 'pyramid':
			return arrangePyramid(plan, arranged, box, palette, style, elementId, index);
		case 'composite':
			return arrangeComposite(plan, arranged, box, palette, style, elementId, index);
		case 'conn':
			return arrangeConn(plan, arranged, box, palette, style, elementId, index);
		case 'spacer':
			return arrangeSpacer(plan, arranged, box, palette, style, elementId);
		case 'text':
			// `arrangeText` places only the FIRST point (a composite `tx` leaf
			// describes one region). Reached as a standalone plan it is the
			// last-resort aux branch, so accepting it for a multi-point diagram
			// silently drops every point but one. Decline instead and let the
			// caller's family approximation place them all. Seen on real decks
			// whose `.../layout/default` definition hides its `snake` arrangers
			// inside a `dgm:choose` this interpreter cannot decide.
			if (arranged.length > 1) {
				return undefined;
			}
			return arrangeText(plan, arranged, box, palette, style, elementId);
	}
}

/**
 * Interpret the layout definition, or return `undefined` when it is not
 * understood (no recognised arrangement algorithm, or no nodes to place).
 *
 * When an arrangement is produced, every node's manual `dgm:pt/dgm:prSet`
 * `cust*` override (drag/resize/rotate/flip performed in PowerPoint's own
 * diagram editor) is applied as a final transform, so a manually-placed node
 * does not revert to its algorithmic position.
 */
export function interpretSmartArtLayout(
	input: InterpretLayoutInput,
): SmartArtLayoutResult | undefined {
	const result = runArrangement(input);
	if (!result) {
		return undefined;
	}
	const withCustomLayout = applyCustomLayoutOverrides(result, input.flat, input.box);
	return applySmartArtRoleColors(withCustomLayout, input.flat, input.colorRoles);
}
