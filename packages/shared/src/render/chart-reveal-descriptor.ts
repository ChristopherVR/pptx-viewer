/**
 * `chart-reveal-descriptor`: authored-index staged chart reveal.
 *
 * `chart-build.ts`'s `applyChartBuildReveal` infers how many series/categories
 * are revealed purely from elapsed-time PROGRESS (a click-count proxy): stage
 * N is shown once progress crosses N/total. That matches PowerPoint whenever
 * the per-series/per-category `p:par` effects PowerPoint writes fire in
 * natural forward index order, but ECMA-376 does not require that:
 * `p:spTgt/p:graphicEl` (CT_TLGraphicalObjectBuildElement, S19.5.34) names the
 * EXACT `@seriesIdx`/`@categoryIdx`/`@bldStep` each effect reveals, and
 * PowerPoint's own Effect Options exposes "Reverse Order", which authors
 * those effects out of index order.
 *
 * This module derives a reveal descriptor directly from which authored
 * `graphicEl`-carrying steps have actually FIRED so far (in any order),
 * rather than from a time-progress fraction. `chart-build.ts`'s
 * `resolveRevealedChartData` consumes it in place of the count-based path
 * whenever every fired step for a chart carries index data; a deck that mixes
 * indexed and un-indexed steps (or predates this parsing, or uses `bldAsOne`)
 * falls back to the legacy progress-based reveal, since
 * {@link resolveChartRevealDescriptor} returns `undefined` for that case.
 *
 * @module render/chart-reveal-descriptor
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type {
	AnimationTimeline,
	ChartBuildMode,
	ChartRevealDescriptor,
	TimelineStep,
	TimelineStepGraphicElement,
} from './animation-timeline-types';

/**
 * Extract a step's `p:spTgt/p:graphicEl` index data from its source
 * animation's target, when the target is a shape carrying one. Used by
 * `animation-timeline-builder` when constructing each {@link TimelineStep}.
 */
export function extractStepGraphicElement(
	anim: PptxNativeAnimation,
): TimelineStepGraphicElement | undefined {
	const target = anim.target;
	if (target?.type !== 'shape' || !target.graphicElement) {
		return undefined;
	}
	const { seriesIdx, categoryIdx, bldStep } = target.graphicElement;
	return { seriesIdx, categoryIdx, bldStep };
}

/**
 * Resolve a {@link ChartRevealDescriptor} from the chart-build steps that have
 * fired so far for one element, in any order.
 *
 * @param firedSteps - Every step belonging to the chart's `p:graphicEl` build
 *   that has ACTUALLY fired (survived `@restart` gating) up to the current
 *   playback position. Order does not affect the result: a reversed-order
 *   build reveals the same set regardless of when each stage fired.
 * @param animateBackground - The chart's static `a:bldChart/@animBg` (default
 *   `true`), independent of playback progress.
 * @returns `undefined` when any fired step lacks `graphicElement` index data
 *   (an older/hand-authored deck, or a build with no per-effect indices),
 *   signalling the caller to fall back to the count-based
 *   `applyChartBuildReveal`.
 */
export function resolveChartRevealDescriptor(
	firedSteps: readonly TimelineStep[],
	animateBackground: boolean,
): ChartRevealDescriptor | undefined {
	const series = new Set<number>();
	const categories = new Set<number>();
	const points: { seriesIdx: number; categoryIdx: number }[] = [];

	for (const step of firedSteps) {
		const graphicElement = step.graphicElement;
		if (!graphicElement) {
			return undefined;
		}
		const { seriesIdx, categoryIdx } = graphicElement;
		if (seriesIdx !== undefined && categoryIdx !== undefined) {
			points.push({ seriesIdx, categoryIdx });
		} else if (seriesIdx !== undefined) {
			series.add(seriesIdx);
		} else if (categoryIdx !== undefined) {
			categories.add(categoryIdx);
		}
		// Neither index present: an exotic `graphicEl` carrying only `@bldStep`.
		// Nothing to add; it neither blocks nor contributes reveal data.
	}

	return {
		background: firedSteps.length > 0 || !animateBackground,
		series,
		categories,
		points,
	};
}

/**
 * Collect each chart element's static build MODE + `animateBackground` flag
 * by scanning every step across the whole timeline (main sequence,
 * interactive sequences, and hover sequences), keyed by element id.
 *
 * Mode/animateBackground are authored constants, not playback state, so
 * `TimelineEngine` calls this once at construction rather than per tick.
 */
export function collectChartBuildInfo(
	timeline: AnimationTimeline,
): ReadonlyMap<string, { mode: ChartBuildMode; animateBackground: boolean }> {
	const info = new Map<string, { mode: ChartBuildMode; animateBackground: boolean }>();
	const visit = (steps: readonly TimelineStep[]): void => {
		for (const step of steps) {
			if (step.build?.kind === 'chart' && !info.has(step.elementId)) {
				info.set(step.elementId, {
					mode: step.build.mode,
					animateBackground: step.build.animateBackground ?? true,
				});
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
