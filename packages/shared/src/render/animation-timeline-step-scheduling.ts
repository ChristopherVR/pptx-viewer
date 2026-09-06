/**
 * `animation-timeline-step-scheduling` - click-group start/flush decisions
 * and delay-ms computation for a single step in the main (non-interactive,
 * non-hover) timeline pass. Split out of `animation-timeline-regular-step`
 * (itself split out of `animation-timeline-builder`) to keep these modules
 * under the file-size limit. Pure extraction: no logic changed, only
 * relocated.
 *
 * @module render/animation-timeline-step-scheduling
 */

import type { PptxNativeAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';

import type { EffectiveStartCondition } from './animation-advanced-triggers';
import { finalizeClickGroup } from './animation-timeline-helpers';
import type { RegularBuildState } from './animation-timeline-regular-step';

/**
 * Decide whether `singleAnim` starts a new click-group (flushing the
 * current one first), track entrance-element visibility, and compute the
 * step's `delayMs` relative to the start of its click-group. Mutates
 * `state`'s group/sub-group bookkeeping in place; returns the computed
 * `delayMs`.
 */
export function scheduleRegularStep(
	state: RegularBuildState,
	singleAnim: PptxNativeAnimation,
	effective: EffectiveStartCondition,
	trigger: PptxAnimationTrigger,
	animDelay: number,
	triggerDelay: number,
	presetClass: PptxNativeAnimation['presetClass'] | 'emph',
	elementId: string,
): number {
	// Track entrance elements
	if (presetClass === 'entr' && elementId) {
		state.entranceIds.add(elementId);
	}

	// Determine whether to start a new click-group. A compound condition
	// that resolves to a click (onClick, or an inline shape click that was
	// not split into an interactive sequence) also starts a new group.
	const isOnClick = trigger === 'onClick' || trigger === 'onShapeClick';
	const isFirstAnimation = state.clickGroups.length === 0 && state.currentGroup.length === 0;

	if (isOnClick || isFirstAnimation) {
		// Flush current group if non-empty
		if (state.currentGroup.length > 0) {
			const group = finalizeClickGroup(state.currentGroup);
			if (
				state.currentGroupAutoStart ||
				(!state.currentGroupIsClick && state.clickGroups.length > 0)
			) {
				group.autoAdvance = true;
			}
			state.clickGroups.push(group);
		}
		state.currentGroup = [];
		state.currentGroupLastParallelIndex = undefined;
		state.currentGroupIsClick = isOnClick || isFirstAnimation;
		// A group the deck marks as auto-starting plays on slide entry. This
		// is how PowerPoint renders a deck whose opening effects are "With
		// Previous"; without it the first group was always click-gated and
		// the slide showed nothing until the viewer clicked.
		// `isOnClick` alone is the wrong test: `resolveAnimationStart` keeps
		// the node's fallback trigger (`onClick`) whenever its condition list
		// carries no actionable semantics, so a step the deck marks as
		// auto-starting AND whose only condition is `<p:cond delay="0"/>`
		// looked click-gated. `requiresInteraction` distinguishes the two,
		// which is what makes a slide-entry `p:cmd` media command (the
		// `playFrom(0.0)` on solution-explorer slide 2) start with the slide
		// instead of waiting for a Next press.
		state.currentGroupAutoStart =
			singleAnim.groupAutoStart === true && !effective.requiresInteraction;
		state.subGroupIndex = singleAnim.parGroupIndex;
		state.subGroupStartMs = singleAnim.parGroupDelayMs ?? 0;
	}

	// Compute delay relative to start of this click-group
	const prevStep =
		state.currentGroup.length > 0 ? state.currentGroup[state.currentGroup.length - 1] : undefined;
	// A `p:cond/@_tn` dependency on a SPECIFIC, non-adjacent earlier node
	// (e.g. "start after effect #3", not just "after the previous effect")
	// schedules off that node's own computed end, not positional adjacency.
	// Absent when the dependency targets a node this pass hasn't built yet
	// (forward references are not valid OOXML) or a node outside the
	// click-group step model (e.g. a `kind: 'media'` audio/video node,
	// which never becomes a TimelineStep here; see `animation-media-playback`).
	const dependencyStep =
		effective.dependsOnTimeNodeId !== undefined
			? state.stepsByNodeId.get(effective.dependsOnTimeNodeId)
			: undefined;
	let delayMs: number;
	if (singleAnim.parGroupIndex !== undefined) {
		if (singleAnim.parGroupIndex !== state.subGroupIndex) {
			// Prefer the wrapper's authored absolute offset. Older or
			// programmatically-created entries may not carry one, so retain
			// the duration-based chaining fallback for those entries.
			state.subGroupIndex = singleAnim.parGroupIndex;
			state.subGroupStartMs =
				singleAnim.parGroupDelayMs ??
				(prevStep
					? trigger === 'withPrevious'
						? prevStep.delayMs
						: prevStep.delayMs + prevStep.durationMs
					: 0);
		}
		// Siblings of one wrapper are simultaneous in OOXML: each `@delay` is
		// an offset from the wrapper, never a chain off the previous effect.
		delayMs = state.subGroupStartMs + animDelay + triggerDelay;
	} else if (dependencyStep) {
		delayMs =
			trigger === 'withPrevious'
				? dependencyStep.delayMs + animDelay + triggerDelay
				: dependencyStep.delayMs + dependencyStep.durationMs + animDelay + triggerDelay;
	} else if (trigger === 'withPrevious' && prevStep) {
		delayMs = prevStep.delayMs + animDelay + triggerDelay;
	} else if ((trigger === 'afterPrevious' || trigger === 'afterDelay') && prevStep) {
		delayMs = prevStep.delayMs + prevStep.durationMs + animDelay + triggerDelay;
	} else {
		delayMs = animDelay + triggerDelay;
	}

	return delayMs;
}
