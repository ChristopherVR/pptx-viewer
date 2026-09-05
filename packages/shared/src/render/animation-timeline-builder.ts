/**
 * `animation-timeline-builder` — `buildTimeline`, which turns a flat list of
 * native animations into an {@link AnimationTimeline} of click-groups (plus
 * interactive + hover sequences and the aggregated `@keyframes` CSS). Pure.
 *
 * @module render/animation-timeline-builder
 */

import type { PptxNativeAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';

import { resolveAnimationStart } from './animation-advanced-triggers';
import {
	injectHideOnNextClickSteps,
	resolveAfterAnimationStepFields,
} from './animation-after-effect';
import { resolveStepBuildDescriptor } from './animation-build';
import { resolveColorAnimationTargets } from './animation-color';
import { buildDirectionalKeyframe } from './animation-directional';
import { resolveEffectTiming } from './animation-fill-repeat';
import { resolveFilterPresetSubtype } from './animation-filter-effects';
import { getEffectKeyframes } from './animation-keyframes';
import { isMediaCommandAnimation, buildStepCommand } from './animation-media-commands';
import { canComposeParallelSteps, composeParallelSteps } from './animation-parallel-composition';
import { resolveAnimationTargetId } from './animation-target-id';
import { buildColorTavKeyframe, buildOpacityTavKeyframe } from './animation-timeline-absolute';
import {
	resolveEffect,
	buildDynamicKeyframe,
	cssKeyframeName,
	defaultDuration,
	fillModeForClass,
	finalizeClickGroup,
} from './animation-timeline-helpers';
import type {
	EffectName,
	TimelineStep,
	TimelineClickGroup,
	AnimationTimeline,
} from './animation-timeline-types';
import { hasAuthoredTransform } from './animation-transform-keyframes';
import { extractStepGraphicElement } from './chart-reveal-descriptor';

// ==========================================================================
// Unmapped-preset safety net
// ==========================================================================

/**
 * Resolve a fallback {@link EffectName} for an animation whose preset we do
 * not model (no static effect and no dynamic keyframe).
 *
 * Without this, an unmapped animation was silently dropped, which broke slide
 * visibility semantics: an unmapped **entrance** was never registered as
 * hidden-until-its-start, so it stayed visible from the very first frame; an
 * unmapped **exit** never hid its element. We substitute a neutral fade so the
 * element still transitions in (entrance) or out (exit) at the correct time.
 *
 * Emphasis / motion-path presets carry no show/hide semantics, so a missing
 * one is safe to skip and returns `undefined`.
 */
/** Clamp a value into the closed unit interval. */
function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Map an animation's parsed `accel`/`decel` fractions to a CSS timing function.
 *
 * PowerPoint's `accel` is the fraction of the duration spent easing in and
 * `decel` the fraction spent easing out. We translate the actual magnitudes to
 * a `cubic-bezier(accel, 0, 1 - decel, 1)` curve so a gentle 10% accel differs
 * from an aggressive 80% accel (the old keyword mapping collapsed both to a flat
 * `ease-in`). With neither set we keep the neutral `ease` default so existing
 * decks are unchanged.
 */
function cssEasingForAnimation(anim: PptxNativeAnimation): string {
	const accel = anim.accel !== undefined && anim.accel > 0 ? clamp01(anim.accel) : 0;
	const decel = anim.decel !== undefined && anim.decel > 0 ? clamp01(anim.decel) : 0;
	if (accel === 0 && decel === 0) {
		return 'ease';
	}
	const x1 = accel.toFixed(3);
	const x2 = (1 - decel).toFixed(3);
	return `cubic-bezier(${x1}, 0, ${x2}, 1)`;
}

/**
 * Resolve the active-color-animation paint targets for a step, or `undefined`
 * when the animation drives no fill / stroke colour (so the field stays absent).
 *
 * `tavColorApplied` must be `true` only when {@link buildColorTavKeyframe}
 * actually produced a keyframe block for this step: `anim.attrName` alone
 * isn't enough, because it can name a colour attribute whose `p:tavLst`
 * stops couldn't be resolved to CSS colours (e.g. scheme-colour tokens), in
 * which case the step falls back to an unrelated effect and must NOT be
 * flagged as animating fill/stroke, or the renderer would suppress the
 * shape's static paint for an animation that never actually runs.
 */
function stepColorTargets(
	anim: PptxNativeAnimation,
	tavColorApplied: boolean,
): TimelineStep['colorTargets'] {
	// `p:animClr`'s own from/to/by ramp is the primary source; a `p:tavLst`
	// colour ramp on a generic `p:anim` node (see `buildColorTavKeyframe`)
	// names the same kind of attribute, so it resolves paint targets the
	// same way once there's no dedicated colour animation to defer to.
	const colorSource = anim.colorAnimation ?? (tavColorApplied ? anim.attrName : undefined);
	if (!colorSource) {
		return undefined;
	}
	const targets = resolveColorAnimationTargets(colorSource);
	return targets.length > 0 ? targets : undefined;
}

function fallbackEffectForClass(
	presetClass: PptxNativeAnimation['presetClass'],
): EffectName | undefined {
	if (presetClass === 'entr') {
		return 'fadeIn';
	}
	if (presetClass === 'exit') {
		return 'fadeOut';
	}
	if (presetClass === 'emph') {
		// Emphasis carries no show/hide semantics, but an unmapped emphasis must
		// still animate (previously it was silently dropped and rendered inert).
		// A neutral pulse is a safe stand-in that reads as "this element is being
		// emphasised" regardless of the specific unmapped preset.
		return 'pulse';
	}
	return undefined;
}

// ==========================================================================
// Timeline builder
// ==========================================================================

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

	const clickGroups: TimelineClickGroup[] = [];
	const entranceIds = new Set<string>();
	const neededKeyframes = new Set<EffectName>();
	const dynamicBlocks: string[] = [];
	let dynamicUid = 0;

	let currentGroup: TimelineStep[] = [];
	let currentGroupLastParallelIndex: number | undefined;
	/** Whether the current group was started by an onClick trigger. */
	let currentGroupIsClick = false;
	/**
	 * Whether the current group's OOXML click step begins on slide entry rather
	 * than on a click (`groupAutoStart` from the parse layer).
	 */
	let currentGroupAutoStart = false;
	/**
	 * Effect-wrapper (`p:par`) index of the sub-group being filled, and the time
	 * that wrapper starts relative to the click group. Siblings of one wrapper all
	 * measure their delay from `subGroupStartMs`; a new wrapper chains off the
	 * previous step instead.
	 */
	let subGroupIndex: number | undefined;
	let subGroupStartMs = 0;
	/**
	 * Maps each effect's own `p:cTn/@_id` ({@link PptxNativeAnimation.nodeId})
	 * to the {@link TimelineStep} built for it, so a LATER effect whose
	 * `p:cond/@_tn` (`dependsOnTimeNodeId`) names an EARLIER, non-adjacent node
	 * can schedule off that node's real computed end time instead of assuming
	 * it is always the positionally-previous step (ECMA-376 S19.5.28
	 * CT_TLTimeCondition; see `animation-advanced-triggers`).
	 */
	const stepsByNodeId = new Map<number, TimelineStep>();

	for (const anim of regularAnims) {
		const expandedSteps = expandIterateAnimation(anim);

		for (const singleAnim of expandedSteps) {
			let dynamic = hasAuthoredTransform(singleAnim)
				? buildDynamicKeyframe(singleAnim, dynamicUid++)
				: undefined;
			let effect = dynamic ? undefined : resolveEffect(singleAnim);
			if (!effect && !dynamic) {
				dynamic = buildDynamicKeyframe(singleAnim, dynamicUid++);
			}
			// A real `p:tavLst` keyframe list on an emphasis effect (e.g.
			// PowerPoint's "Transparency") carries the AUTHORED opacity ramp;
			// prefer it over the canned 2/3-stop static effect so a custom fade
			// timing/curve is actually honoured. Only fires for 'transparency'
			// (known opacity effect) or an unmapped emphasis (already falling
			// back to `dynamic`), never for an unrelated static effect.
			if (effect === 'transparency' || !effect) {
				const tavOpacity = buildOpacityTavKeyframe(singleAnim, 'pptx-tl-tav', dynamicUid);
				if (tavOpacity) {
					dynamic = tavOpacity;
					effect = undefined;
					dynamicUid++;
				}
			}
			// A `p:tavLst` colour ramp on a generic `p:anim` node (as opposed to
			// the dedicated `p:animClr` behaviour `buildDynamicKeyframe` already
			// tried above): only attempted once nothing else has claimed this
			// step, mirroring how the existing `colorAnimation` dynamic keyframe
			// is itself gated to unmapped presets.
			let tavColorApplied = false;
			if (!effect && !dynamic) {
				const tavColor = buildColorTavKeyframe(singleAnim, 'pptx-tl-tavclr', dynamicUid);
				if (tavColor) {
					dynamic = tavColor;
					tavColorApplied = true;
					dynamicUid++;
				}
			}
			// Directional non-fly entrance/exit (wipe / split / blinds / peek):
			// honour `presetSubtype` by swapping the fixed-direction static effect
			// for a direction-aware clip-path keyframe. Fly is already redirected
			// inside resolveEffect, and non-directional effects return undefined.
			if (effect) {
				// `resolveFilterPresetSubtype` returns the real `presetSubtype` when
				// present; otherwise it synthesises the equivalent numeric code from
				// `singleAnim.effectFilter`'s subtype token (filter-only decks), so a
				// directional Wipe/Barn resolved via the filter fallback still gets
				// its correct edge/orientation instead of the fixed default.
				const directional = buildDirectionalKeyframe(
					effect,
					resolveFilterPresetSubtype(singleAnim),
					dynamicUid,
				);
				if (directional) {
					dynamic = directional;
					effect = undefined;
					dynamicUid++;
				}
			}
			// A `p:cmd` media command carries no visual effect but must still be
			// sequenced so the playback layer can act on it at the right time.
			const isCommand = !effect && !dynamic && isMediaCommandAnimation(singleAnim);
			if (!effect && !dynamic && !isCommand) {
				// Unmapped preset: fall back so an entrance is still hidden until
				// its start and an exit still hides, rather than being dropped.
				effect = fallbackEffectForClass(singleAnim.presetClass);
				if (!effect) {
					continue;
				}
			}

			let keyframe = '';
			if (!isCommand) {
				keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
			}
			if (effect) {
				neededKeyframes.add(effect);
			}
			if (dynamic) {
				dynamicBlocks.push(dynamic.css);
			}

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

			// Track entrance elements
			if (presetClass === 'entr' && elementId) {
				entranceIds.add(elementId);
			}

			// Determine whether to start a new click-group. A compound condition
			// that resolves to a click (onClick, or an inline shape click that was
			// not split into an interactive sequence) also starts a new group.
			const isOnClick = trigger === 'onClick' || trigger === 'onShapeClick';
			const isFirstAnimation = clickGroups.length === 0 && currentGroup.length === 0;

			if (isOnClick || isFirstAnimation) {
				// Flush current group if non-empty
				if (currentGroup.length > 0) {
					const group = finalizeClickGroup(currentGroup);
					if (currentGroupAutoStart || (!currentGroupIsClick && clickGroups.length > 0)) {
						group.autoAdvance = true;
					}
					clickGroups.push(group);
				}
				currentGroup = [];
				currentGroupLastParallelIndex = undefined;
				currentGroupIsClick = isOnClick || isFirstAnimation;
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
				currentGroupAutoStart =
					singleAnim.groupAutoStart === true && !effective.requiresInteraction;
				subGroupIndex = singleAnim.parGroupIndex;
				subGroupStartMs = singleAnim.parGroupDelayMs ?? 0;
			}

			// Compute delay relative to start of this click-group
			const prevStep = currentGroup.length > 0 ? currentGroup[currentGroup.length - 1] : undefined;
			// A `p:cond/@_tn` dependency on a SPECIFIC, non-adjacent earlier node
			// (e.g. "start after effect #3", not just "after the previous effect")
			// schedules off that node's own computed end, not positional adjacency.
			// Absent when the dependency targets a node this pass hasn't built yet
			// (forward references are not valid OOXML) or a node outside the
			// click-group step model (e.g. a `kind: 'media'` audio/video node,
			// which never becomes a TimelineStep here; see `animation-media-playback`).
			const dependencyStep =
				effective.dependsOnTimeNodeId !== undefined
					? stepsByNodeId.get(effective.dependsOnTimeNodeId)
					: undefined;
			let delayMs: number;
			if (singleAnim.parGroupIndex !== undefined) {
				if (singleAnim.parGroupIndex !== subGroupIndex) {
					// Prefer the wrapper's authored absolute offset. Older or
					// programmatically-created entries may not carry one, so retain
					// the duration-based chaining fallback for those entries.
					subGroupIndex = singleAnim.parGroupIndex;
					subGroupStartMs =
						singleAnim.parGroupDelayMs ??
						(prevStep
							? trigger === 'withPrevious'
								? prevStep.delayMs
								: prevStep.delayMs + prevStep.durationMs
							: 0);
				}
				// Siblings of one wrapper are simultaneous in OOXML: each `@delay` is
				// an offset from the wrapper, never a chain off the previous effect.
				delayMs = subGroupStartMs + animDelay + triggerDelay;
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
						`pptx-tl-dim-${dynamicUid++}`,
					);
			if (afterFields.dimKeyframeBlock) {
				dynamicBlocks.push(afterFields.dimKeyframeBlock);
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
				holdEndState: afterFields.holdEndState || undefined,
				hideAfterEffect: afterFields.hideAfterEffect,
				pendingHideOnNextClick: afterFields.pendingHideOnNextClick,
				restart: singleAnim.restart,
				seqConcurrent: singleAnim.seqConcurrent,
				seqNextAction: singleAnim.seqNextAction,
				seqPrevAction: singleAnim.seqPrevAction,
				exclGroupId: singleAnim.exclGroupId,
				dependsOnTimeNodeId: effective.dependsOnTimeNodeId,
				dependsOnEvent: effective.dependsOnEvent,
			};
			if (singleAnim.nodeId !== undefined) {
				stepsByNodeId.set(singleAnim.nodeId, step);
			}
			const previousParallelStep = currentGroup[currentGroup.length - 1];
			if (
				singleAnim.parGroupIndex !== undefined &&
				singleAnim.parGroupIndex === currentGroupLastParallelIndex &&
				previousParallelStep &&
				canComposeParallelSteps(previousParallelStep, step)
			) {
				currentGroup[currentGroup.length - 1] = composeParallelSteps(previousParallelStep, step);
			} else {
				currentGroup.push(step);
			}
			currentGroupLastParallelIndex = singleAnim.parGroupIndex;
		}
	}

	// Flush last group
	if (currentGroup.length > 0) {
		const group = finalizeClickGroup(currentGroup);
		if (currentGroupAutoStart || (!currentGroupIsClick && clickGroups.length > 0)) {
			group.autoAdvance = true;
		}
		clickGroups.push(group);
	}

	// Compute auto-advance delay for auto-advance groups
	for (const group of clickGroups) {
		if (group.autoAdvance) {
			group.autoAdvanceDelayMs = 0;
		}
	}

	// `afterAnimation: "hideOnNextClick"` steps splice a synthetic hide step
	// into the FOLLOWING click-group now that every group is finalized.
	injectHideOnNextClickSteps(clickGroups);

	// Build interactive sequence click-groups
	const interactiveSequences = buildSequenceGroups(
		interactiveAnims,
		entranceIds,
		neededKeyframes,
		dynamicBlocks,
		dynamicUid,
	);

	// Build hover sequence click-groups
	const { hoverSequences, nextUid } = buildHoverSequences(
		hoverAnims,
		entranceIds,
		neededKeyframes,
		dynamicBlocks,
		dynamicUid + countDynamicUids(interactiveAnims),
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

/**
 * Count how many dynamic UIDs the interactive sequence builder would consume.
 * This is used to give the hover sequence builder non-overlapping UIDs.
 */
function countDynamicUids(interactiveAnims: Map<string, PptxNativeAnimation[]>): number {
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
function expandIterateAnimation(anim: PptxNativeAnimation): PptxNativeAnimation[] {
	// Expansion happens upstream, in `expandTextBuildAnimations`: splitting text
	// needs the target element's paragraph/word/character counts, which the
	// timeline builder does not have (it only sees animations). By the time an
	// animation reaches here it has already been split into per-letter or
	// per-word sub-animations, so there is nothing left to do.
	return [anim];
}

/**
 * Build sequence-based click-groups (used for both interactive and hover).
 */
function buildSequenceGroups(
	animsByKey: Map<string, PptxNativeAnimation[]>,
	entranceIds: Set<string>,
	neededKeyframes: Set<EffectName>,
	dynamicBlocks: string[],
	startUid: number,
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
			let dynamic = hasAuthoredTransform(anim)
				? buildDynamicKeyframe(anim, dynamicUid++)
				: undefined;
			let effect = dynamic ? undefined : resolveEffect(anim);
			if (!effect && !dynamic) {
				dynamic = buildDynamicKeyframe(anim, dynamicUid++);
			}
			// Same authored-tavLst-over-canned-default preference as the main
			// click-group loop (see the comment there for why it's gated to
			// 'transparency' / unmapped emphasis effects only).
			if (effect === 'transparency' || !effect) {
				const tavOpacity = buildOpacityTavKeyframe(anim, 'pptx-tl-tav', dynamicUid);
				if (tavOpacity) {
					dynamic = tavOpacity;
					effect = undefined;
					dynamicUid++;
				}
			}
			// Same tavLst-colour-ramp precedence as the main click-group loop.
			let tavColorApplied = false;
			if (!effect && !dynamic) {
				const tavColor = buildColorTavKeyframe(anim, 'pptx-tl-tavclr', dynamicUid);
				if (tavColor) {
					dynamic = tavColor;
					tavColorApplied = true;
					dynamicUid++;
				}
			}
			// An interactive sequence can hold a `p:cmd` media command just as the
			// main sequence can (PowerPoint's "click the video to pause it" is
			// authored exactly that way). Without this branch the step fell through
			// to the unmapped-preset safety net, and because a `mediacall` effect
			// carries no whitelisted `presetClass` the net returned nothing and the
			// command was dropped in silence.
			const isCommand = !effect && !dynamic && isMediaCommandAnimation(anim);
			if (!effect && !dynamic && !isCommand) {
				// Same unmapped-preset safety net as the main timeline loop.
				effect = fallbackEffectForClass(anim.presetClass);
				if (!effect) {
					continue;
				}
			}

			const keyframe = isCommand ? '' : effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
			if (effect) {
				neededKeyframes.add(effect);
			}
			if (dynamic) {
				dynamicBlocks.push(dynamic.css);
			}

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
function buildHoverSequences(
	hoverAnims: PptxNativeAnimation[],
	entranceIds: Set<string>,
	neededKeyframes: Set<EffectName>,
	dynamicBlocks: string[],
	startUid: number,
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
