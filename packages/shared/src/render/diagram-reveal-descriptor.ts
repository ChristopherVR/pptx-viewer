/**
 * `diagram-reveal-descriptor`: authored-index staged SmartArt diagram reveal.
 *
 * `diagram-build.ts`'s `revealedSmartArtNodeCount` infers how many nodes are
 * revealed purely from elapsed-time PROGRESS (a click-count proxy): stage N is
 * shown once progress crosses N/total, in NODE-LIST order. That matches
 * PowerPoint whenever the per-node `p:par` effects a `p:bldDgm` build authors
 * fire in the same order the node list is walked, but ECMA-376 does not
 * require that: `p:spTgt/p:graphicEl/p:dgm` (CT_TLBuildDiagram, S19.5.10)
 * names the EXACT `@id` (the diagram data-model point id, matching
 * `PptxSmartArtNode.id`) each effect reveals, and PowerPoint's own Effect
 * Options exposes "Reverse Order" plus non-document-order traversals
 * (`cw`/`ccw`/`inByRing`/...), which author effects out of node-list order.
 *
 * This module derives a reveal descriptor directly from which authored
 * `p:graphicEl`-carrying steps have actually FIRED so far (in any order),
 * rather than from a time-progress fraction. `diagram-build.ts`'s
 * `resolveRevealedSmartArtNodes` consumes it in place of the count-based path
 * whenever every fired step for a diagram carries `@id` (or `bldStep="bg"`)
 * data; a deck that mixes indexed and un-indexed steps (or predates this
 * parsing, or uses `asOne`) falls back to the legacy progress-based reveal,
 * since {@link resolveDiagramRevealDescriptor} returns `undefined` for that
 * case.
 *
 * @module render/diagram-reveal-descriptor
 */

import type {
	AnimationTimeline,
	DiagramBuildMode,
	DiagramRevealDescriptor,
	TimelineStep,
} from './animation-timeline-types';

/**
 * Resolve a {@link DiagramRevealDescriptor} from the diagram-build steps that
 * have fired so far for one element, in any order.
 *
 * @param firedSteps - Every step belonging to the diagram's `p:graphicEl`
 *   build that has ACTUALLY fired (survived `@restart` gating) up to the
 *   current playback position. Order does not affect the result: a
 *   reversed-order or by-branch build reveals the same set regardless of when
 *   each stage fired.
 * @returns `undefined` when any fired step lacks `graphicElement` data (an
 *   older/hand-authored deck, or a build with no per-effect node ids),
 *   signalling the caller to fall back to the count-based
 *   `revealedSmartArtNodeCount`.
 */
export function resolveDiagramRevealDescriptor(
	firedSteps: readonly TimelineStep[],
): DiagramRevealDescriptor | undefined {
	const nodeIds = new Set<string>();
	let backgroundRevealed = false;

	for (const step of firedSteps) {
		const graphicElement = step.graphicElement;
		if (!graphicElement) {
			return undefined;
		}
		if (graphicElement.bldStep === 'bg') {
			backgroundRevealed = true;
			continue;
		}
		if (graphicElement.id !== undefined) {
			nodeIds.add(graphicElement.id);
		}
		// Neither `id` nor a `bg` step present: an exotic `graphicEl` carrying
		// only an unrecognised `@bldStep`. Nothing to add; it neither blocks nor
		// contributes reveal data.
	}

	return { background: backgroundRevealed || firedSteps.length > 0, nodeIds };
}

/**
 * Collect each diagram element's static build MODE by scanning every step
 * across the whole timeline (main sequence, interactive sequences, and hover
 * sequences), keyed by element id.
 *
 * The mode is an authored constant, not playback state, so `TimelineEngine`
 * calls this once at construction rather than per tick.
 */
export function collectDiagramBuildInfo(
	timeline: AnimationTimeline,
): ReadonlyMap<string, { mode: DiagramBuildMode }> {
	const info = new Map<string, { mode: DiagramBuildMode }>();
	const visit = (steps: readonly TimelineStep[]): void => {
		for (const step of steps) {
			if (step.build?.kind === 'diagram' && !info.has(step.elementId)) {
				info.set(step.elementId, { mode: step.build.mode });
			}
		}
	};
	for (const group of timeline.clickGroups) {
		visit(group.steps);
	}
	for (const groups of timeline.interactiveSequences.values()) {
		for (const group of groups) {
			visit(group.steps);
		}
	}
	for (const groups of timeline.hoverSequences.values()) {
		for (const group of groups) {
			visit(group.steps);
		}
	}
	return info;
}
