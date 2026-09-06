/**
 * `animation-timeline-regular-step` - the per-animation step-building loop
 * body used by `animation-timeline-builder`'s main (non-interactive,
 * non-hover) click-group pass. Split out of `animation-timeline-builder` to
 * keep that module under the file-size limit; behaviour is unchanged, this
 * is the same loop body threaded through an explicit mutable state bag
 * instead of closure-captured locals, with the effect-resolution and
 * scheduling sub-steps further split into `animation-timeline-step-effect`
 * and `animation-timeline-step-scheduling`.
 *
 * @module render/animation-timeline-regular-step
 */

import type { PptxNativeAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';

import { resolveAnimationStart } from './animation-advanced-triggers';
import { resolveAfterAnimationStepFields } from './animation-after-effect';
import { resolveStepBuildDescriptor } from './animation-build';
import { resolveEffectTiming } from './animation-fill-repeat';
import { buildStepCommand } from './animation-media-commands';
import { canComposeParallelSteps, composeParallelSteps } from './animation-parallel-composition';
import type { AnimationRenderContext } from './animation-render-context';
import { resolveAnimationTargetId } from './animation-target-id';
import { resolveTextStyleAnimation } from './animation-text-style-resolve';
import { cssEasingForAnimation, stepColorTargets } from './animation-timeline-builder-helpers';
import { defaultDuration, fillModeForClass } from './animation-timeline-helpers';
import { resolveStepEffect } from './animation-timeline-step-effect';
import { scheduleRegularStep } from './animation-timeline-step-scheduling';
import type { EffectName, TimelineStep, TimelineClickGroup } from './animation-timeline-types';
import { extractStepGraphicElement } from './chart-reveal-descriptor';

/** Mutable state threaded through the main click-group building loop. */
export interface RegularBuildState {
	clickGroups: TimelineClickGroup[];
	entranceIds: Set<string>;
	neededKeyframes: Set<EffectName>;
	dynamicBlocks: string[];
	dynamicUid: number;
	currentGroup: TimelineStep[];
	currentGroupLastParallelIndex: number | undefined;
	/** Whether the current group was started by an onClick trigger. */
	currentGroupIsClick: boolean;
	/**
	 * Whether the current group's OOXML click step begins on slide entry rather
	 * than on a click (`groupAutoStart` from the parse layer).
	 */
	currentGroupAutoStart: boolean;
	/**
	 * Effect-wrapper (`p:par`) index of the sub-group being filled, and the time
	 * that wrapper starts relative to the click group. Siblings of one wrapper all
	 * measure their delay from `subGroupStartMs`; a new wrapper chains off the
	 * previous step instead.
	 */
	subGroupIndex: number | undefined;
	subGroupStartMs: number;
	/**
	 * Maps each effect's own `p:cTn/@_id` (`PptxNativeAnimation.nodeId`) to the
	 * {@link TimelineStep} built for it, so a LATER effect whose `p:cond/@_tn`
	 * (`dependsOnTimeNodeId`) names an EARLIER, non-adjacent node can schedule
	 * off that node's real computed end time instead of assuming it is always
	 * the positionally-previous step (ECMA-376 S19.5.28 CT_TLTimeCondition; see
	 * `animation-advanced-triggers`).
	 */
	stepsByNodeId: Map<number, TimelineStep>;
}

/** Create a fresh {@link RegularBuildState} for the main click-group pass. */
export function createRegularBuildState(): RegularBuildState {
	return {
		clickGroups: [],
		entranceIds: new Set(),
		neededKeyframes: new Set(),
		dynamicBlocks: [],
		dynamicUid: 0,
		currentGroup: [],
		currentGroupLastParallelIndex: undefined,
		currentGroupIsClick: false,
		currentGroupAutoStart: false,
		subGroupIndex: undefined,
		subGroupStartMs: 0,
		stepsByNodeId: new Map(),
	};
}

/**
 * Expand an animation with `iterate` configuration into multiple
 * staggered sub-animations. Each sub-element gets a slightly delayed copy.
 *
 * - `iterate.type === "lt"` (letter): creates per-character animations
 * - `iterate.type === "wd"` (word): creates per-word animations
 * - `iterate.type === "el"` (element): no expansion needed
 *
 * The iterate timing interval (`tmPct` or `tmAbs`) controls the stagger
 * delay between consecutive sub-elements.
 */
export function expandIterateAnimation(anim: PptxNativeAnimation): PptxNativeAnimation[] {
	// Expansion happens upstream, in `expandTextBuildAnimations`: splitting text
	// needs the target element's paragraph/word/character counts, which the
	// timeline builder does not have (it only sees animations). By the time an
	// animation reaches here it has already been split into per-letter or
	// per-word sub-animations, so there is nothing left to do.
	return [anim];
}

/**
 * Process one native animation into the main click-group timeline, mutating
 * `state` in place (pushing finished click-groups, growing the current one,
 * and accumulating keyframe/dynamic-CSS bookkeeping).
 *
 * See `buildTimeline`'s module doc for the grouping rules this implements.
 */
export function processRegularAnimation(
	state: RegularBuildState,
	anim: PptxNativeAnimation,
	renderContext: AnimationRenderContext | undefined,
): void {
	const expandedSteps = expandIterateAnimation(anim);

	for (const singleAnim of expandedSteps) {
		const resolved = resolveStepEffect(singleAnim, renderContext, state.dynamicUid);
		state.dynamicUid = resolved.nextDynamicUid;
		if (resolved.skip) {
			continue;
		}
		if (resolved.effect) {
			state.neededKeyframes.add(resolved.effect);
		}
		if (resolved.dynamicCss) {
			state.dynamicBlocks.push(resolved.dynamicCss);
		}
		const { keyframe, isCommand, tavColorApplied } = resolved;

		// Command steps carry no element visibility semantics: an empty
		// elementId keeps them from hiding/revealing a real element; the media
		// target is routed via the command payload instead.
		const elementId = isCommand ? '' : resolveAnimationTargetId(singleAnim);
		// Honour the FULL start-condition OR-set (compound / simultaneous
		// triggers) rather than the collapsed single trigger. The effective
		// condition drives grouping and supplies the governing start delay.
		const effective = resolveAnimationStart(singleAnim);
		const trigger: PptxAnimationTrigger = effective.trigger;
		const baseDuration = isCommand
			? 0
			: (singleAnim.durationMs ?? defaultDuration(singleAnim.presetClass));
		// `delayMs`, `triggerDelayMs` and the start condition's delay are three
		// views of ONE OOXML quantity: when does this effect start. Adding them
		// double-counts (a 1s delay played at 2s), so take the governing value.
		const animDelay = Math.max(
			singleAnim.delayMs ?? 0,
			// Use the governing condition delay when conditions were present;
			// otherwise fall back to the simple triggerDelayMs (afterDelay) so
			// existing single-condition slides are unchanged.
			singleAnim.startConditions && singleAnim.startConditions.length > 0
				? effective.delayMs
				: (singleAnim.triggerDelayMs ?? 0),
		);
		const triggerDelay = 0;
		const presetClass = isCommand ? 'emph' : (singleAnim.presetClass ?? 'entr');
		const fill = fillModeForClass(singleAnim.presetClass);

		// Apply `@spd` / `@repeatDur` / `@fill` (animation-fill-repeat), then
		// compute direction. A command step carries no timing of its own.
		const timing = isCommand
			? { durationMs: 0, iterationCount: 1, activeDurationMs: 0, holdEndState: false }
			: resolveEffectTiming(singleAnim, baseDuration);
		const duration = timing.durationMs;
		const iterCount = timing.iterationCount;
		const direction = singleAnim.autoReverse ? 'alternate' : 'normal';

		const delayMs = scheduleRegularStep(
			state,
			singleAnim,
			effective,
			trigger,
			animDelay,
			triggerDelay,
			presetClass,
			elementId,
		);

		const iterStr = iterCount === Infinity ? 'infinite' : String(iterCount);
		const easing = cssEasingForAnimation(singleAnim);
		const baseCssAnimation = isCommand
			? ''
			: `${keyframe} ${duration}ms ${easing} ${delayMs}ms ${iterStr} ${direction} ${fill}`;

		// "After animation" end state (dim-to-color / hide), merged in from
		// the editor's per-element animation list by
		// `applyAfterAnimationFromEditorList` before the timeline is built.
		const afterFields = isCommand
			? { cssAnimation: baseCssAnimation, holdEndState: timing.holdEndState }
			: resolveAfterAnimationStepFields(
					singleAnim,
					baseCssAnimation,
					timing.holdEndState,
					delayMs + timing.activeDurationMs,
					`pptx-tl-dim-${state.dynamicUid++}`,
					renderContext?.themeColorMap,
				);
		if (afterFields.dimKeyframeBlock) {
			state.dynamicBlocks.push(afterFields.dimKeyframeBlock);
		}

		const step: TimelineStep = {
			elementId,
			cssAnimation: afterFields.cssAnimation,
			keyframeName: keyframe,
			trigger,
			delayMs,
			durationMs: timing.activeDurationMs,
			fillMode: fill,
			presetClass: presetClass as TimelineStep['presetClass'],
			soundPath: singleAnim.soundPath,
			stopSound: singleAnim.stopSound,
			command: isCommand ? buildStepCommand(singleAnim) : undefined,
			build: isCommand ? undefined : resolveStepBuildDescriptor(singleAnim),
			graphicElement: isCommand ? undefined : extractStepGraphicElement(singleAnim),
			colorTargets: isCommand ? undefined : stepColorTargets(singleAnim, tavColorApplied),
			textStyle: isCommand ? undefined : resolveTextStyleAnimation(singleAnim),
			holdEndState: afterFields.holdEndState || undefined,
			hideAfterEffect: afterFields.hideAfterEffect,
			pendingHideOnNextClick: afterFields.pendingHideOnNextClick,
			restart: singleAnim.restart,
			seqConcurrent: singleAnim.seqConcurrent,
			seqNextAction: singleAnim.seqNextAction,
			seqPrevAction: singleAnim.seqPrevAction,
			exclGroupId: singleAnim.exclGroupId,
			dependsOnTimeNodeId: effective.dependsOnTimeNodeId,
			dependsOnShapeId: effective.dependsOnShapeId,
			dependsOnEvent: effective.dependsOnEvent,
		};
		if (singleAnim.nodeId !== undefined) {
			state.stepsByNodeId.set(singleAnim.nodeId, step);
		}
		const previousParallelStep = state.currentGroup[state.currentGroup.length - 1];
		if (
			singleAnim.parGroupIndex !== undefined &&
			singleAnim.parGroupIndex === state.currentGroupLastParallelIndex &&
			previousParallelStep &&
			canComposeParallelSteps(previousParallelStep, step)
		) {
			state.currentGroup[state.currentGroup.length - 1] = composeParallelSteps(
				previousParallelStep,
				step,
			);
		} else {
			state.currentGroup.push(step);
		}
		state.currentGroupLastParallelIndex = singleAnim.parGroupIndex;
	}
}

// Re-exported so `buildRegularClickGroups` (in `animation-timeline-builder`)
// can finalize the last group and flush auto-advance bookkeeping without a
// second import of `animation-timeline-helpers`.
export { finalizeClickGroup } from './animation-timeline-helpers';
