/**
 * SmartArt DiagramML interpreter - choose-aware `dgm:presOf` resolution.
 *
 * Split out of `smartart-layout-interpreter-when.ts` (the file-size budget):
 * {@link resolvePresentationOf} is the ONE consumer of `PptxSmartArtLayoutNode.
 * presentationOfCandidates`, layered on top of `evaluateWhen` from that
 * module. Pure TypeScript - no framework code, no DOM.
 */

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { evaluateWhen } from './smartart-layout-interpreter-when';

/**
 * The `dgm:presOf` `node` actually resolves to, choose-aware: when
 * `node.presentationOfCandidates` is populated (2+ real branches, see its
 * own doc comment - `funnel--flat3.pptx`'s `item1`/`item2`/`item3`, one
 * literal axis per data-point count), evaluate each candidate's own guard
 * chain against `flat` in document order and return the FIRST one every
 * condition holds for (an undecidable condition defaults to "allow", the
 * same convention `guardAllows`/`collectRawCandidates`
 * (`smartart-layout-interpreter-composite-choose.ts`) already use elsewhere
 * in this interpreter - a `dgm:else` candidate's own empty guard chain
 * always matches, so it is the natural fallback when reached). Falls back to
 * `node.presentationOf` (the static single guess
 * `smartart-layout-definition-constraints.ts`'s `choosePresentationOf`
 * already made at parse time) when there is nothing to choose between, or no
 * candidate's guard chain resolves - never a behaviour change for the
 * overwhelming majority of nodes, which carry no `presentationOfCandidates`
 * at all.
 */
export function resolvePresentationOf(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtIteratorAttributes | undefined {
	const candidates = node.presentationOfCandidates;
	if (!candidates || candidates.length === 0) {
		return node.presentationOf;
	}
	const winner = candidates.find((candidate) =>
		candidate.guard.every((guard) => evaluateWhen(guard, flat.length, { nodes: flat }) !== false),
	);
	return winner?.presentationOf ?? node.presentationOf;
}
