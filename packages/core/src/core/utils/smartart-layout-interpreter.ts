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
 * `smartart-layout-interpreter-model.ts` for the honest scope note): it
 * honours the arrangement algorithm, direction/angle params, and scalar
 * `dgm:constr` factors, and executes the decidable parts of `dgm:forEach`
 * (st/cnt/step + hideLastTrans) and `dgm:choose` (count-decidable branch
 * selection), but does not run the full recursive constraint-reference solver.
 *
 * Lives in `pptx-viewer-core` (moved from `pptx-viewer-shared`) so it is the
 * SINGLE interpreter used both by the SVG-fallback preview path (every
 * binding, via `pptx-viewer-shared`'s re-export) and by this package's own
 * save/decompose pipeline (`smartart-decompose.ts`,
 * `smartart-interpreter-drawing-bridge.ts`). Only runs on the path with no
 * cached `dsp` drawing part; a pre-existing cache still wins (see
 * `PptxHandlerRuntimeSaveDocumentParts.ts`).
 */

import type {
	PptxSmartArtConnection,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { selectArrangedPoints } from './smartart-layout-interpreter-arranged-selection';
import {
	buildChildOrder,
	buildConnectorLabels,
} from './smartart-layout-interpreter-connector-order';
import { applyCustomLayoutOverrides } from './smartart-layout-interpreter-custom';
import { resolveCycleRingParams } from './smartart-layout-interpreter-cycle-constraints';
import { repositionCycleRingContent } from './smartart-layout-interpreter-cycle-ring-item';
import { dispatchArrangement } from './smartart-layout-interpreter-dispatch';
import { arrangeHierarchy } from './smartart-layout-interpreter-hierarchy';
import { buildHubRenderedNode } from './smartart-layout-interpreter-hub';
import { expandResultItemRoles } from './smartart-layout-interpreter-item-roles';
import { isRecursiveTableItemTemplate } from './smartart-layout-interpreter-linear-table';
import {
	discoverArrangement,
	itemNode,
	STRUCTURAL_ARRANGEMENT_KINDS,
} from './smartart-layout-interpreter-model';
import type { ArrangementKind } from './smartart-layout-interpreter-model';
import {
	applyNamedRuleOverride,
	collectNamedRules,
	resolveNamedRuleOverride,
} from './smartart-layout-interpreter-named-rules';
import { repositionPyramidBands } from './smartart-layout-interpreter-pyramid-bands';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';
import { applySmartArtRoleColors } from './smartart-node-role-colors';
import type { SmartArtColorRoleMap } from './smartart-node-role-colors';

/**
 * Arrangement kinds where one item layoutNode template covers every rendered
 * point, so a `forName`-scoped rule override resolves unambiguously (see
 * `smartart-layout-interpreter-named-rules.ts`). `hierarchy`/`composite`/the
 * `conn`/`spacer`/`text` aux fallback are excluded: none has one uniform role
 * name to key off.
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
	 * `PptxSmartArtColorTransform.roleColors`): a node whose {@link
	 * PptxSmartArtNode.styleRole} matches a key gets that role's own cycled
	 * fill colour instead of the generic `palette` cycling - see
	 * `smartart-node-role-colors.ts`.
	 */
	colorRoles?: SmartArtColorRoleMap;
	/**
	 * Data-model connections (from `PptxSmartArtData.connections`): labels a
	 * hierarchy `parOf` edge's connector from its `parTrans` text, and
	 * resolves a transition-bound item role's ordinal text (a numbered badge)
	 * from its `sibTrans`/`parTrans` text - via `connection.label`.
	 */
	connections?: PptxSmartArtConnection[];
	/**
	 * The deck's own theme minor-Latin font (`PptxSmartArtData.themeMinorFont`),
	 * threaded through to every arranger's font-fit so text is measured
	 * against the REAL font PowerPoint renders it in. `undefined` falls back
	 * to the default in `smartart-layout-item-font-size.ts`.
	 */
	fontName?: string;
}

/** Run the recognised arrangement algorithm, or `undefined` when none applies. */
function runArrangement(input: InterpretLayoutInput): SmartArtLayoutResult | undefined {
	const { layoutDefinition, nodes, flat, box, palette, style, elementId, presLayoutVars } = input;
	if (!layoutDefinition || flat.length === 0) {
		return undefined;
	}
	const plan = discoverArrangement(layoutDefinition, flat.length, presLayoutVars, flat);
	if (!plan) {
		return undefined;
	}
	const whenContext = { presLayoutVars, nodes: flat };
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
			buildConstraintIndex(layoutDefinition, flat.length, whenContext),
			buildChildOrder(input.connections),
			input.fontName,
		);
	}
	// Which points get arranged, plus the "hub + satellites" nested-forEach
	// expansion (if any) - see `selectArrangedPoints`'s own doc comment
	// (`smartart-layout-interpreter-arranged-selection.ts`, split out for the
	// file-size budget).
	const { childrenOf, hub, arranged } = selectArrangedPoints(plan, nodes, flat, input.connections);
	if (arranged.length === 0) {
		return undefined;
	}

	const constraintIndex = buildConstraintIndex(layoutDefinition, flat.length, whenContext);
	const result = dispatchArrangement(
		plan,
		arranged,
		box,
		palette,
		style,
		elementId,
		presLayoutVars,
		constraintIndex,
		childrenOf,
		hub !== undefined,
		input.fontName,
		flat,
	);
	if (!result) {
		return undefined;
	}
	// Apply any `dgm:rule/@forName` override that names the arranger's item
	// template (see `smartart-layout-interpreter-named-rules.ts`): declared
	// anywhere in the tree, resolved by the item layoutNode's own `name`.
	const withNamedRule = NAMED_OVERRIDE_KINDS.has(plan.kind)
		? applyNamedRuleOverride(
				result,
				resolveNamedRuleOverride(collectNamedRules(layoutDefinition), itemNode(plan.node)?.name),
				box,
			)
		: result;
	// Split each arranged point's box into its per-item text roles - see
	// `smartart-layout-interpreter-item-roles.ts`. Skipped for the recursive
	// table item template (`-linear-table.ts`), which already gave every
	// generation its own final box.
	const isTableTemplate = isRecursiveTableItemTemplate(plan.node, presLayoutVars);
	const withItemRoles =
		STRUCTURAL_ARRANGEMENT_KINDS.has(plan.kind) && !isTableTemplate
			? expandResultItemRoles(
					plan.node,
					withNamedRule,
					nodes,
					childrenOf,
					constraintIndex,
					input.connections,
					presLayoutVars,
				)
			: withNamedRule;
	// `pyraAcctRatio`'s own band-split geometry (see `repositionPyramidBands`'s
	// doc comment) - a post-pass keyed by `nodeId`/row, not folded into
	// `arrangePyramid` itself, so it never double-splits a row `stackRoleContent`
	// (just above) already left alone. A no-op when `pyraAcctRatio` is absent
	// (every pyramid layout except `basic-pyramid`/`inverted-pyramid`), or when
	// no top-level point actually has a child (`hasAccentSomewhere` - see that
	// param's own doc comment for why this can't be read off the constraint
	// index alone).
	const hasAccentSomewhere = arranged.some((node) => flat.some((n) => n.parentId === node.id));
	const withPyramidBands =
		plan.kind === 'pyramid'
			? repositionPyramidBands(
					withItemRoles,
					box,
					plan.node,
					arranged.map((n) => n.id),
					flat,
					hasAccentSomewhere,
					constraintIndex,
				)
			: withItemRoles;
	// A composite ring item's own content-dependent "child" sub-shape (see
	// `repositionCycleRingContent`'s own doc comment, `radial-list--hier5
	// .pptx`'s `parentNode`/`childNode` pair) - a no-op for every OTHER cycle
	// layout (`contentLayout` only resolves for this specific composite
	// self+child shape, see `deriveCompositeSelfChildLayout`'s doc comment).
	const withCycleRingContent =
		plan.kind === 'cycle'
			? repositionCycleRingContent(
					withPyramidBands,
					resolveCycleRingParams(plan.node, constraintIndex).contentLayout,
					flat,
				)
			: withPyramidBands;
	if (!hub) {
		return withCycleRingContent;
	}
	const hubNode = buildHubRenderedNode(
		plan.node,
		hub.hubNode,
		box,
		palette,
		style,
		elementId,
		hub.satellites.length,
		constraintIndex,
		childrenOf,
		input.fontName,
	);
	return { ...withCycleRingContent, nodes: [hubNode, ...withCycleRingContent.nodes] };
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
