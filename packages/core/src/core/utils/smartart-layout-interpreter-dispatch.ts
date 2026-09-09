/**
 * SmartArt DiagramML interpreter - per-kind arranger dispatch.
 *
 * Split out of `smartart-layout-interpreter.ts` (the repo's per-file line
 * budget) so that module can stay focused on the overall `runArrangement`/
 * `interpretSmartArtLayout` orchestration: this half is the plain switch from
 * a discovered {@link ArrangementPlan}'s `kind` onto its concrete arranger
 * function. Pure TypeScript - no framework code.
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { arrangeConn, arrangeSpacer, arrangeText } from './smartart-layout-interpreter-aux';
import { arrangeComposite } from './smartart-layout-interpreter-composite';
import { arrangeCycle } from './smartart-layout-interpreter-cycle';
import { arrangeLinear, arrangeSnake } from './smartart-layout-interpreter-linear';
import { resolveFlowDirection } from './smartart-layout-interpreter-model';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { arrangePyramid } from './smartart-layout-interpreter-pyramid';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

/** Dispatch a discovered plan to its arranger, or `undefined` when declined. */
export function dispatchArrangement(
	plan: ArrangementPlan,
	arranged: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	index: ConstraintIndex,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	hubStripped = false,
	fontName?: string,
	flat: PptxSmartArtNode[] = arranged,
): SmartArtLayoutResult | undefined {
	switch (plan.kind) {
		case 'linear': {
			const flow = resolveFlowDirection(plan.node, presLayoutVars);
			// `childrenOf` lets the arranger fold a descendant added a level
			// deeper (the text pane's Tab/"Add Bullet") into its top-level
			// ancestor's own font-fit text - see `foldedItemText`'s doc comment.
			return arrangeLinear(
				plan,
				flow,
				arranged,
				box,
				palette,
				style,
				elementId,
				index,
				childrenOf,
				fontName,
			);
		}
		case 'snake':
			return arrangeSnake(
				plan,
				arranged,
				box,
				palette,
				style,
				elementId,
				index,
				childrenOf,
				fontName,
			);
		case 'cycle':
			// `hubStripped`: `arranged` already had its hub point pulled out by
			// `runArrangement`'s own `detectHubExpansion` when `hubStripped` is
			// true - `arrangeCycle` must NOT re-detect a hub from the first
			// SATELLITE in that case (`ctrShpMap` stays `'fNode'` on the
			// algorithm regardless of whether the hub was already removed) - see
			// `arrangeCycle`'s own doc comment on `hubAlreadyStripped`.
			return arrangeCycle(plan, arranged, box, palette, style, elementId, index, hubStripped);
		case 'pyramid':
			return arrangePyramid(plan, arranged, box, palette, style, elementId, index);
		case 'composite':
			return arrangeComposite(
				plan,
				arranged,
				box,
				palette,
				style,
				elementId,
				index,
				childrenOf,
				flat,
			);
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
