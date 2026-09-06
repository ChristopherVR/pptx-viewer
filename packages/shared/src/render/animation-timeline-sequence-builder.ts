/**
 * `animation-timeline-sequence-builder` - builds interactive
 * (`onShapeClick`) and hover (`onHover`) click-group sequences. Split out of
 * `animation-timeline-builder` to keep that module under the file-size
 * limit. Pure extraction: no logic changed, only relocated.
 *
 * @module render/animation-timeline-sequence-builder
 */

import type { PptxNativeAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';

import {
	injectHideOnNextClickSteps,
	resolveAfterAnimationStepFields,
} from './animation-after-effect';
import { resolveStepBuildDescriptor } from './animation-build';
import { resolveEffectTiming } from './animation-fill-repeat';
import { buildStepCommand } from './animation-media-commands';
import { canComposeParallelSteps, composeParallelSteps } from './animation-parallel-composition';
import type { AnimationRenderContext } from './animation-render-context';
import { resolveAnimationTargetId } from './animation-target-id';
import { resolveTextStyleAnimation } from './animation-text-style-resolve';
import { cssEasingForAnimation, stepColorTargets } from './animation-timeline-builder-helpers';
import {
	resolveEffect,
	defaultDuration,
	fillModeForClass,
	finalizeClickGroup,
} from './animation-timeline-helpers';
import { resolveStepEffect } from './animation-timeline-step-effect';
import type { EffectName, TimelineStep, TimelineClickGroup } from './animation-timeline-types';
import { extractStepGraphicElement } from './chart-reveal-descriptor';

/**
 * Count how many dynamic UIDs the interactive sequence builder would consume.
 * This is used to give the hover sequence builder non-overlapping UIDs.
 */
export function countDynamicUids(interactiveAnims: Map<string, PptxNativeAnimation[]>): number {
	let count = 0;
	for (const [, anims] of interactiveAnims) {
		for (const anim of anims) {
			const effect = resolveEffect(anim);
			if (!effect) {
				count++;
			}
		}
	}
	return count;
}

/**
 * Build sequence-based click-groups (used for both interactive and hover).
 */
export function buildSequenceGroups(
	animsByKey: Map<string, PptxNativeAnimation[]>,
	entranceIds: Set<string>,
	neededKeyframes: Set<EffectName>,
	dynamicBlocks: string[],
	startUid: number,
	renderContext?: AnimationRenderContext,
): Map<string, TimelineClickGroup[]> {
	const sequences = new Map<string, TimelineClickGroup[]>();
	let dynamicUid = startUid;

	for (const [shapeId, anims] of animsByKey) {
		const seqGroups: TimelineClickGroup[] = [];
		let seqGroup: TimelineStep[] = [];
		let seqGroupLastParallelIndex: number | undefined;
		let subGroupIndex: number | undefined;
		let subGroupStartMs = 0;

		for (const anim of anims) {
			// Same authored-tavLst-over-canned-default preference, and the same
			// (deliberately preserved) absence of the directional-keyframe
			// substitution, as the historical interactive/hover loop.
			const resolved = resolveStepEffect(anim, renderContext, dynamicUid, false);
			dynamicUid = resolved.nextDynamicUid;
			if (resolved.skip) {
				continue;
			}
			if (resolved.effect) {
				neededKeyframes.add(resolved.effect);
			}
			if (resolved.dynamicCss) {
				dynamicBlocks.push(resolved.dynamicCss);
			}
			const { keyframe, isCommand, tavColorApplied } = resolved;

			// Command steps carry no element visibility semantics; see the main loop.
			const elementId = isCommand ? '' : resolveAnimationTargetId(anim);
			const seqTrigger: PptxAnimationTrigger = anim.trigger ?? 'onShapeClick';
			const baseDuration = isCommand ? 0 : (anim.durationMs ?? defaultDuration(anim.presetClass));
			// Same single-quantity rule as the main sequence: never sum the two.
			const animDelay = Math.max(anim.delayMs ?? 0, anim.triggerDelayMs ?? 0);
			const triggerDelay = 0;
			const presetClass = isCommand ? 'emph' : (anim.presetClass ?? 'entr');
			const fill = fillModeForClass(anim.presetClass);
			const timing = isCommand
				? { durationMs: 0, iterationCount: 1, activeDurationMs: 0, holdEndState: false }
				: resolveEffectTiming(anim, baseDuration);
			const duration = timing.durationMs;
			const iterCount = timing.iterationCount;
			const direction = anim.autoReverse ? 'alternate' : 'normal';

			if (presetClass === 'entr' && elementId) {
				entranceIds.add(elementId);
			}

			const isNewGroup = seqGroup.length === 0;
			if (isNewGroup && seqGroup.length > 0) {
				seqGroups.push(finalizeClickGroup(seqGroup));
				seqGroup = [];
			}

			const prevStep = seqGroup.length > 0 ? seqGroup[seqGroup.length - 1] : undefined;
			let delayMs: number;
			if (anim.parGroupIndex !== undefined) {
				if (anim.parGroupIndex !== subGroupIndex) {
					subGroupIndex = anim.parGroupIndex;
					subGroupStartMs =
						anim.parGroupDelayMs ??
						(prevStep
							? seqTrigger === 'withPrevious'
								? prevStep.delayMs
								: prevStep.delayMs + prevStep.durationMs
							: 0);
				}
				delayMs = subGroupStartMs + animDelay + triggerDelay;
			} else if (seqTrigger === 'withPrevious' && prevStep) {
				delayMs = prevStep.delayMs + animDelay + triggerDelay;
			} else if ((seqTrigger === 'afterPrevious' || seqTrigger === 'afterDelay') && prevStep) {
				delayMs = prevStep.delayMs + prevStep.durationMs + animDelay + triggerDelay;
			} else {
				delayMs = animDelay + triggerDelay;
			}

			const iterStr = iterCount === Infinity ? 'infinite' : String(iterCount);
			const easing = cssEasingForAnimation(anim);
			const baseCssAnimation = isCommand
				? ''
				: `${keyframe} ${duration}ms ${easing} ${delayMs}ms ${iterStr} ${direction} ${fill}`;

			// Same "after animation" resolution as the main click-group loop, so
			// an onShapeClick/onHover-triggered effect honours dim-to-color /
			// hide-after-animation / hide-on-next-click exactly like a
			// main-sequence one.
			const afterFields = isCommand
				? { cssAnimation: baseCssAnimation, holdEndState: timing.holdEndState }
				: resolveAfterAnimationStepFields(
						anim,
						baseCssAnimation,
						timing.holdEndState,
						delayMs + timing.activeDurationMs,
						`pptx-tl-dim-${dynamicUid++}`,
						renderContext?.themeColorMap,
					);
			if (afterFields.dimKeyframeBlock) {
				dynamicBlocks.push(afterFields.dimKeyframeBlock);
			}

			const step: TimelineStep = {
				elementId,
				cssAnimation: afterFields.cssAnimation,
				keyframeName: keyframe,
				trigger: seqTrigger,
				delayMs,
				durationMs: timing.activeDurationMs,
				fillMode: fill,
				presetClass: presetClass as TimelineStep['presetClass'],
				soundPath: anim.soundPath,
				stopSound: anim.stopSound,
				command: isCommand ? buildStepCommand(anim) : undefined,
				build: isCommand ? undefined : resolveStepBuildDescriptor(anim),
				graphicElement: isCommand ? undefined : extractStepGraphicElement(anim),
				colorTargets: isCommand ? undefined : stepColorTargets(anim, tavColorApplied),
				textStyle: isCommand ? undefined : resolveTextStyleAnimation(anim),
				holdEndState: afterFields.holdEndState || undefined,
				hideAfterEffect: afterFields.hideAfterEffect,
				pendingHideOnNextClick: afterFields.pendingHideOnNextClick,
				restart: anim.restart,
				seqConcurrent: anim.seqConcurrent,
				seqNextAction: anim.seqNextAction,
				seqPrevAction: anim.seqPrevAction,
				exclGroupId: anim.exclGroupId,
			};
			const previousParallelStep = seqGroup[seqGroup.length - 1];
			if (
				anim.parGroupIndex !== undefined &&
				anim.parGroupIndex === seqGroupLastParallelIndex &&
				previousParallelStep &&
				canComposeParallelSteps(previousParallelStep, step)
			) {
				seqGroup[seqGroup.length - 1] = composeParallelSteps(previousParallelStep, step);
			} else {
				seqGroup.push(step);
			}
			seqGroupLastParallelIndex = anim.parGroupIndex;
		}

		if (seqGroup.length > 0) {
			seqGroups.push(finalizeClickGroup(seqGroup));
		}

		// Splice any pending "hide on next click" steps into the FOLLOWING
		// click-group within this shape's own sequence (mirrors the main
		// sequence's handling once all its groups are finalized).
		injectHideOnNextClickSteps(seqGroups);

		if (seqGroups.length > 0) {
			sequences.set(shapeId, seqGroups);
		}
	}

	return sequences;
}

/**
 * Build hover sequences from onHover animations.
 * Hover animations are grouped by their target element ID (the element
 * that the animation applies to). The hover trigger is the element itself
 * unless a triggerShapeId is specified.
 */
export function buildHoverSequences(
	hoverAnims: PptxNativeAnimation[],
	entranceIds: Set<string>,
	neededKeyframes: Set<EffectName>,
	dynamicBlocks: string[],
	startUid: number,
	renderContext?: AnimationRenderContext,
): { hoverSequences: Map<string, TimelineClickGroup[]>; nextUid: number } {
	// Group hover anims by trigger shape (targetId used as hover trigger)
	const hoverByTarget = new Map<string, PptxNativeAnimation[]>();
	for (const anim of hoverAnims) {
		const triggerId = anim.triggerShapeId ?? anim.targetId ?? '';
		if (!triggerId) {
			continue;
		}
		const existing = hoverByTarget.get(triggerId) ?? [];
		existing.push(anim);
		hoverByTarget.set(triggerId, existing);
	}

	const sequences = buildSequenceGroups(
		hoverByTarget,
		entranceIds,
		neededKeyframes,
		dynamicBlocks,
		startUid,
		renderContext,
	);

	let nextUid = startUid;
	for (const [, anims] of hoverByTarget) {
		for (const anim of anims) {
			const effect = resolveEffect(anim);
			if (!effect) {
				nextUid++;
			}
		}
	}

	return { hoverSequences: sequences, nextUid: startUid + nextUid };
}
