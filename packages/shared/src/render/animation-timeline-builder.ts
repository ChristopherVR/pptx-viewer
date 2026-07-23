/**
 * `animation-timeline-builder` — `buildTimeline`, which turns a flat list of
 * native animations into an {@link AnimationTimeline} of click-groups (plus
 * interactive + hover sequences and the aggregated `@keyframes` CSS). Pure.
 *
 * @module render/animation-timeline-builder
 */

import type { PptxNativeAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';

import { resolveAnimationStart } from './animation-advanced-triggers';
import { resolveStepBuildDescriptor } from './animation-build';
import { resolveColorAnimationTargets } from './animation-color';
import { buildDirectionalKeyframe } from './animation-directional';
import { getEffectKeyframes } from './animation-keyframes';
import { isMediaCommandAnimation, buildStepCommand } from './animation-media-commands';
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
 */
function stepColorTargets(anim: PptxNativeAnimation): TimelineStep['colorTargets'] {
	if (!anim.colorAnimation) {
		return undefined;
	}
	const targets = resolveColorAnimationTargets(anim.colorAnimation.targetAttribute);
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
			hoverSequences: new Map(),
		};
	}

	// Separate interactive (onShapeClick), hover (onHover), and regular animations
	const regularAnims: PptxNativeAnimation[] = [];
	const interactiveAnims = new Map<string, PptxNativeAnimation[]>();
	const hoverAnims: PptxNativeAnimation[] = [];

	for (const anim of nativeAnimations) {
		if (anim.trigger === 'onShapeClick' && anim.triggerShapeId) {
			const existing = interactiveAnims.get(anim.triggerShapeId) ?? [];
			existing.push(anim);
			interactiveAnims.set(anim.triggerShapeId, existing);
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
	/** Whether the current group was started by an onClick trigger. */
	let currentGroupIsClick = false;

	for (const anim of regularAnims) {
		const expandedSteps = expandIterateAnimation(anim);

		for (const singleAnim of expandedSteps) {
			let effect = resolveEffect(singleAnim);
			let dynamic = effect ? undefined : buildDynamicKeyframe(singleAnim, dynamicUid++);
			// Directional non-fly entrance/exit (wipe / split / blinds / peek):
			// honour `presetSubtype` by swapping the fixed-direction static effect
			// for a direction-aware clip-path keyframe. Fly is already redirected
			// inside resolveEffect, and non-directional effects return undefined.
			if (effect) {
				const directional = buildDirectionalKeyframe(effect, singleAnim.presetSubtype, dynamicUid);
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
			const elementId = isCommand ? '' : (singleAnim.targetId ?? '');
			// Honour the FULL start-condition OR-set (compound / simultaneous
			// triggers) rather than the collapsed single trigger. The effective
			// condition drives grouping and supplies the governing start delay.
			const effective = resolveAnimationStart(singleAnim);
			const trigger: PptxAnimationTrigger = effective.trigger;
			const duration = isCommand
				? 0
				: (singleAnim.durationMs ?? defaultDuration(singleAnim.presetClass));
			const animDelay = singleAnim.delayMs ?? 0;
			// Use the governing condition delay when conditions were present;
			// otherwise fall back to the simple triggerDelayMs (afterDelay) so
			// existing single-condition slides are unchanged.
			const triggerDelay =
				singleAnim.startConditions && singleAnim.startConditions.length > 0
					? effective.delayMs
					: (singleAnim.triggerDelayMs ?? 0);
			const presetClass = isCommand ? 'emph' : (singleAnim.presetClass ?? 'entr');
			const fill = fillModeForClass(singleAnim.presetClass);

			// Compute repeat / direction
			const iterCount = singleAnim.repeatCount ?? 1;
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
					if (!currentGroupIsClick && clickGroups.length > 0) {
						group.autoAdvance = true;
					}
					clickGroups.push(group);
				}
				currentGroup = [];
				currentGroupIsClick = isOnClick || isFirstAnimation;
			}

			// Compute delay relative to start of this click-group
			let delayMs: number;
			if (trigger === 'withPrevious' && currentGroup.length > 0) {
				const prev = currentGroup[currentGroup.length - 1];
				delayMs = prev.delayMs + animDelay + triggerDelay;
			} else if (
				(trigger === 'afterPrevious' || trigger === 'afterDelay') &&
				currentGroup.length > 0
			) {
				const prev = currentGroup[currentGroup.length - 1];
				delayMs = prev.delayMs + prev.durationMs + animDelay + triggerDelay;
			} else {
				delayMs = animDelay + triggerDelay;
			}

			const iterStr = iterCount === Infinity ? 'infinite' : String(iterCount);
			const easing = cssEasingForAnimation(singleAnim);
			const cssAnimation = isCommand
				? ''
				: `${keyframe} ${duration}ms ${easing} ${delayMs}ms ${iterStr} ${direction} ${fill}`;

			currentGroup.push({
				elementId,
				cssAnimation,
				keyframeName: keyframe,
				trigger,
				delayMs,
				durationMs: duration,
				fillMode: fill,
				presetClass: presetClass as TimelineStep['presetClass'],
				soundPath: singleAnim.soundPath,
				stopSound: singleAnim.stopSound,
				command: isCommand ? buildStepCommand(singleAnim) : undefined,
				build: isCommand ? undefined : resolveStepBuildDescriptor(singleAnim),
				colorTargets: isCommand ? undefined : stepColorTargets(singleAnim),
			});
		}
	}

	// Flush last group
	if (currentGroup.length > 0) {
		const group = finalizeClickGroup(currentGroup);
		if (!currentGroupIsClick && clickGroups.length > 0) {
			group.autoAdvance = true;
		}
		clickGroups.push(group);
	}

	// Compute auto-advance delay for auto-advance groups
	for (let i = 1; i < clickGroups.length; i++) {
		if (clickGroups[i].autoAdvance) {
			clickGroups[i].autoAdvanceDelayMs = 0;
		}
	}

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
	const iterate = anim.iterate;
	if (!iterate || iterate.type === 'el') {
		return [anim];
	}

	// We return the original animation unchanged for now —
	// iterate expansion is handled at a higher level by the text-build system
	// when buildType is set. When iterate is present without a matching
	// buildType, we still return the original to avoid dropping the animation.
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

		for (const anim of anims) {
			let effect = resolveEffect(anim);
			const dynamic = effect ? undefined : buildDynamicKeyframe(anim, dynamicUid++);
			if (!effect && !dynamic) {
				// Same unmapped-preset safety net as the main timeline loop.
				effect = fallbackEffectForClass(anim.presetClass);
				if (!effect) {
					continue;
				}
			}

			const keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
			if (effect) {
				neededKeyframes.add(effect);
			}
			if (dynamic) {
				dynamicBlocks.push(dynamic.css);
			}

			const elementId = anim.targetId ?? '';
			const seqTrigger: PptxAnimationTrigger = anim.trigger ?? 'onShapeClick';
			const duration = anim.durationMs ?? defaultDuration(anim.presetClass);
			const animDelay = anim.delayMs ?? 0;
			const triggerDelay = anim.triggerDelayMs ?? 0;
			const presetClass = anim.presetClass ?? 'entr';
			const fill = fillModeForClass(anim.presetClass);
			const iterCount = anim.repeatCount ?? 1;
			const direction = anim.autoReverse ? 'alternate' : 'normal';

			if (presetClass === 'entr' && elementId) {
				entranceIds.add(elementId);
			}

			const isNewGroup = seqGroup.length === 0;
			if (isNewGroup && seqGroup.length > 0) {
				seqGroups.push(finalizeClickGroup(seqGroup));
				seqGroup = [];
			}

			let delayMs: number;
			if (seqTrigger === 'withPrevious' && seqGroup.length > 0) {
				const prev = seqGroup[seqGroup.length - 1];
				delayMs = prev.delayMs + animDelay + triggerDelay;
			} else if (
				(seqTrigger === 'afterPrevious' || seqTrigger === 'afterDelay') &&
				seqGroup.length > 0
			) {
				const prev = seqGroup[seqGroup.length - 1];
				delayMs = prev.delayMs + prev.durationMs + animDelay + triggerDelay;
			} else {
				delayMs = animDelay + triggerDelay;
			}

			const iterStr = iterCount === Infinity ? 'infinite' : String(iterCount);
			const easing = cssEasingForAnimation(anim);
			const cssAnimation = `${keyframe} ${duration}ms ${easing} ${delayMs}ms ${iterStr} ${direction} ${fill}`;

			seqGroup.push({
				elementId,
				cssAnimation,
				keyframeName: keyframe,
				trigger: seqTrigger,
				delayMs,
				durationMs: duration,
				fillMode: fill,
				presetClass: presetClass as TimelineStep['presetClass'],
				soundPath: anim.soundPath,
				stopSound: anim.stopSound,
				build: resolveStepBuildDescriptor(anim),
				colorTargets: stepColorTargets(anim),
			});
		}

		if (seqGroup.length > 0) {
			seqGroups.push(finalizeClickGroup(seqGroup));
		}

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
