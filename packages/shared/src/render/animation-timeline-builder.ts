/**
 * `animation-timeline-builder` - `buildTimeline`, which turns a flat list of
 * native animations into an {@link AnimationTimeline} of click-groups (plus
 * interactive + hover sequences and the aggregated `@keyframes` CSS). Pure.
 *
 * The per-animation step-building loop bodies live in sibling modules (split
 * out to keep this file under the repo's file-size limit):
 * `animation-timeline-regular-step` (the main click-group pass),
 * `animation-timeline-step-effect` / `animation-timeline-step-scheduling`
 * (its effect-resolution and delay-scheduling sub-steps), and
 * `animation-timeline-sequence-builder` (interactive + hover sequences).
 *
 * @module render/animation-timeline-builder
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { injectHideOnNextClickSteps } from './animation-after-effect';
import { getEffectKeyframes } from './animation-keyframes';
import type { AnimationRenderContext } from './animation-render-context';
import {
	createRegularBuildState,
	finalizeClickGroup,
	processRegularAnimation,
} from './animation-timeline-regular-step';
import type { RegularBuildState } from './animation-timeline-regular-step';
import {
	buildHoverSequences,
	buildSequenceGroups,
	countDynamicUids,
} from './animation-timeline-sequence-builder';
import type { EffectName, TimelineClickGroup, AnimationTimeline } from './animation-timeline-types';

/** Result of the main (non-interactive, non-hover) click-group pass. */
interface RegularClickGroupsResult {
	clickGroups: TimelineClickGroup[];
	entranceIds: Set<string>;
	neededKeyframes: Set<EffectName>;
	dynamicBlocks: string[];
	dynamicUid: number;
}

/**
 * Run the main click-group pass over every non-interactive, non-hover
 * animation, then flush the trailing group, mark auto-advance groups, and
 * splice in any pending "hide on next click" steps.
 */
function buildRegularClickGroups(
	regularAnims: readonly PptxNativeAnimation[],
	renderContext: AnimationRenderContext | undefined,
): RegularClickGroupsResult {
	const state: RegularBuildState = createRegularBuildState();

	for (const anim of regularAnims) {
		processRegularAnimation(state, anim, renderContext);
	}

	// Flush last group
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

	// Compute auto-advance delay for auto-advance groups
	for (const group of state.clickGroups) {
		if (group.autoAdvance) {
			group.autoAdvanceDelayMs = 0;
		}
	}

	// `afterAnimation: "hideOnNextClick"` steps splice a synthetic hide step
	// into the FOLLOWING click-group now that every group is finalized.
	injectHideOnNextClickSteps(state.clickGroups);

	return {
		clickGroups: state.clickGroups,
		entranceIds: state.entranceIds,
		neededKeyframes: state.neededKeyframes,
		dynamicBlocks: state.dynamicBlocks,
		dynamicUid: state.dynamicUid,
	};
}

/**
 * Build click-groups from a flat list of native animations.
 *
 * Grouping logic:
 * - An ``onClick`` animation starts a **new** click-group.
 * - A ``withPrevious`` animation is added to the **current** click-group
 *   and plays simultaneously with the previous step.
 * - An ``afterPrevious`` animation is added to the **current** click-group
 *   but delayed until the previous step completes.
 * - An ``afterDelay`` animation behaves like afterPrevious plus its
 *   triggerDelay.
 * - ``onHover`` animations are separated into hover sequences (like
 *   interactive sequences but triggered by mouse hover).
 * - The very first animation implicitly starts a click-group even when
 *   its trigger is withPrevious or afterPrevious (same as PowerPoint).
 *
 * Auto-advance: When an onClick group is immediately followed by
 * afterPrevious/withPrevious/afterDelay animations that would form
 * their own group (because no onClick precedes them), those groups
 * are marked with `autoAdvance: true` so the playback engine can
 * automatically advance through them without requiring a click.
 */
export function buildTimeline(
	nativeAnimations: ReadonlyArray<PptxNativeAnimation>,
	renderContext?: AnimationRenderContext,
): AnimationTimeline {
	if (nativeAnimations.length === 0) {
		return {
			clickGroups: [],
			entranceElementIds: new Set(),
			keyframesCss: '',
			interactiveSequences: new Map(),
			restartableInteractiveSequences: new Set(),
			hoverSequences: new Map(),
		};
	}

	// Separate interactive (onShapeClick), hover (onHover), and regular animations
	const regularAnims: PptxNativeAnimation[] = [];
	const interactiveAnims = new Map<string, PptxNativeAnimation[]>();
	const restartableInteractiveSequences = new Set<string>();
	const hoverAnims: PptxNativeAnimation[] = [];

	for (const anim of nativeAnimations) {
		if (
			(anim.interactiveSequence === true || anim.trigger === 'onShapeClick') &&
			anim.triggerShapeId
		) {
			const existing = interactiveAnims.get(anim.triggerShapeId) ?? [];
			existing.push(anim);
			interactiveAnims.set(anim.triggerShapeId, existing);
			if (anim.interactiveRestart === true) {
				restartableInteractiveSequences.add(anim.triggerShapeId);
			}
		} else if (anim.trigger === 'onHover' && anim.targetId) {
			hoverAnims.push(anim);
		} else {
			regularAnims.push(anim);
		}
	}

	const { clickGroups, entranceIds, neededKeyframes, dynamicBlocks, dynamicUid } =
		buildRegularClickGroups(regularAnims, renderContext);

	// Build interactive sequence click-groups
	const interactiveSequences = buildSequenceGroups(
		interactiveAnims,
		entranceIds,
		neededKeyframes,
		dynamicBlocks,
		dynamicUid,
		renderContext,
	);

	// Build hover sequence click-groups
	const { hoverSequences, nextUid } = buildHoverSequences(
		hoverAnims,
		entranceIds,
		neededKeyframes,
		dynamicBlocks,
		dynamicUid + countDynamicUids(interactiveAnims),
		renderContext,
	);
	// Update dynamicUid for any downstream use
	void nextUid;

	// Build keyframes CSS (covers regular, interactive, and hover animations)
	const keyframeBlocks: string[] = [];
	for (const effect of neededKeyframes) {
		const css = getEffectKeyframes(effect);
		if (css) {
			keyframeBlocks.push(css);
		}
	}
	// Append dynamic keyframes (motion paths, rotation, scale)
	keyframeBlocks.push(...dynamicBlocks);

	return {
		clickGroups,
		entranceElementIds: entranceIds,
		keyframesCss: keyframeBlocks.join('\n\n'),
		interactiveSequences,
		restartableInteractiveSequences,
		hoverSequences,
	};
}
