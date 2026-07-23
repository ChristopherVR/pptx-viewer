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
 * solver. It only runs on the SVG-fallback path (diagrams with no cached `dsp`
 * drawing part), so faithful `dsp` rendering is unaffected.
 */

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { arrangeConn, arrangeSpacer, arrangeText } from './smartart-layout-interpreter-aux';
import { arrangeComposite } from './smartart-layout-interpreter-composite';
import { arrangeCycle } from './smartart-layout-interpreter-cycle';
import { selectArrangedNodes } from './smartart-layout-interpreter-flow';
import { arrangeHierarchy } from './smartart-layout-interpreter-hierarchy';
import { arrangeLinear, arrangeSnake } from './smartart-layout-interpreter-linear';
import { discoverArrangement, resolveFlowDirection } from './smartart-layout-interpreter-model';
import { arrangePyramid } from './smartart-layout-interpreter-pyramid';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

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
}

/**
 * Interpret the layout definition, or return `undefined` when it is not
 * understood (no recognised arrangement algorithm, or no nodes to place).
 */
export function interpretSmartArtLayout(
	input: InterpretLayoutInput,
): SmartArtLayoutResult | undefined {
	const { layoutDefinition, nodes, flat, box, palette, style, elementId, presLayoutVars } = input;
	if (!layoutDefinition || flat.length === 0) {
		return undefined;
	}
	const plan = discoverArrangement(layoutDefinition, flat.length);
	if (!plan) {
		return undefined;
	}

	// Hierarchy consumes the nested tree directly; every other family arranges the
	// flat points after applying the arranger's forEach selection (st/cnt/step +
	// hideLastTrans). When the selection empties the set, decline so the caller
	// keeps its legacy approximation.
	if (plan.kind === 'hierarchy') {
		return arrangeHierarchy(nodes, box, palette, style, elementId, presLayoutVars);
	}
	const arranged = selectArrangedNodes(plan.node, flat);
	if (arranged.length === 0) {
		return undefined;
	}

	switch (plan.kind) {
		case 'linear': {
			const flow = resolveFlowDirection(plan.node, presLayoutVars);
			return arrangeLinear(plan, flow, arranged, box, palette, style, elementId);
		}
		case 'snake':
			return arrangeSnake(plan, arranged, box, palette, style, elementId);
		case 'cycle':
			return arrangeCycle(plan, arranged, box, palette, style, elementId);
		case 'pyramid':
			return arrangePyramid(plan, arranged, box, palette, style, elementId);
		case 'composite':
			return arrangeComposite(plan, arranged, box, palette, style, elementId);
		case 'conn':
			return arrangeConn(plan, arranged, box, palette, style, elementId);
		case 'spacer':
			return arrangeSpacer(plan, arranged, box, palette, style, elementId);
		case 'text':
			return arrangeText(plan, arranged, box, palette, style, elementId);
	}
}
