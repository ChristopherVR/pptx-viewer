/**
 * `animation-sequencer` — `AnimationSequencer`, a pure builder that turns a
 * slide's flat `nativeAnimations` list into an ordered {@link AnimationStep}
 * timeline (with cumulative trigger-based delays) plus the `@keyframes` CSS and
 * initial hidden styles. No DOM / framework dependency.
 *
 * @module render/animation-sequencer
 */

import type { PptxSlide, PptxElement, PptxAnimationTrigger } from 'pptx-viewer-core';

import { resolveAnimationStart } from './animation-advanced-triggers';
import { getInitialStyleForEffect } from './animation-effects';
import { getEffectKeyframes } from './animation-keyframes';
import {
	resolveEffect,
	buildDynamicKeyframes,
	cssKeyframeName,
	defaultDuration,
	fillModeForClass,
} from './animation-timeline-helpers';
import type { AnimationStep, AnimationStyle, EffectName } from './animation-timeline-types';

// ==========================================================================
// AnimationSequencer
// ==========================================================================

export class AnimationSequencer {
	private readonly slide: PptxSlide;
	private readonly elementMap: Map<string, PptxElement>;
	private readonly dynamicKeyframeBlocks: string[] = [];

	public constructor(slide: PptxSlide) {
		this.slide = slide;
		this.elementMap = new Map<string, PptxElement>();
		for (const el of slide.elements) {
			this.elementMap.set(el.id, el);
		}
	}

	/**
	 * Returns the CSS properties an element should have before any animations
	 * play. Entrance animations start hidden; others are unchanged.
	 */
	public getInitialStyles(elementId: string): AnimationStyle {
		const animations = this.slide.nativeAnimations;
		if (!animations) {
			return {};
		}
		// Find the first entrance animation targeting this element.
		const entrance = animations.find((a) => a.targetId === elementId && a.presetClass === 'entr');
		if (!entrance) {
			return {};
		}
		const effect = resolveEffect(entrance);
		if (!effect) {
			return {};
		}
		return getInitialStyleForEffect(effect);
	}

	/**
	 * Builds an ordered timeline of animation steps from the slide's
	 * `nativeAnimations` array. Steps are ordered as they appear in the
	 * OOXML sequence, with computed cumulative delays derived from trigger
	 * types.
	 */
	public buildTimeline(): AnimationStep[] {
		const animations = this.slide.nativeAnimations;
		if (!animations || animations.length === 0) {
			return [];
		}

		const steps: AnimationStep[] = [];
		let cumulativeMs = 0;
		let dynamicUid = 0;

		for (const anim of animations) {
			const effect = resolveEffect(anim);
			const dynamic = effect ? undefined : buildDynamicKeyframes(anim, dynamicUid++);
			if (!effect && !dynamic) {
				continue;
			}

			const keyframeName = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
			if (dynamic) {
				this.dynamicKeyframeBlocks.push(dynamic.css);
			}

			const elementId = anim.targetId ?? '';
			// Resolve compound / simultaneous start conditions (the OR-set in
			// p:stCondLst) into the effective sequencing trigger + governing
			// delay, instead of the single collapsed trigger.
			const effective = resolveAnimationStart(anim);
			const trigger: PptxAnimationTrigger = effective.trigger;
			const duration = anim.durationMs ?? defaultDuration(anim.presetClass);
			const animDelay = anim.delayMs ?? 0;
			const triggerDelay =
				anim.startConditions && anim.startConditions.length > 0
					? effective.delayMs
					: (anim.triggerDelayMs ?? 0);
			const fill = fillModeForClass(anim.presetClass);

			// Compute repeat / direction from the native animation
			const iterCount = anim.repeatCount ?? 1;
			const direction = anim.autoReverse ? 'alternate' : 'normal';

			// Compute the delay for this step in the timeline.
			let stepDelay: number;
			switch (trigger) {
				case 'onClick':
				case 'onShapeClick':
				case 'onHover':
					// onClick / onShapeClick / onHover reset the timeline: delay only from explicit delay values.
					cumulativeMs = 0;
					stepDelay = animDelay + triggerDelay;
					break;
				case 'afterPrevious': {
					// Starts after the previous step finishes.
					const prevStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
					if (prevStep) {
						cumulativeMs = prevStep.delayMs + prevStep.durationMs;
					}
					stepDelay = cumulativeMs + animDelay + triggerDelay;
					break;
				}
				case 'withPrevious': {
					// Starts at the same time as the previous step.
					const prevStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
					if (prevStep) {
						stepDelay = prevStep.delayMs + animDelay + triggerDelay;
					} else {
						stepDelay = animDelay + triggerDelay;
					}
					break;
				}
				case 'afterDelay':
					stepDelay = cumulativeMs + animDelay + triggerDelay;
					break;
				default:
					stepDelay = animDelay;
					break;
			}

			const easing = 'ease';
			const iterStr = iterCount === Infinity ? 'infinite' : String(iterCount);
			const cssAnimation = `${keyframeName} ${duration}ms ${easing} ${stepDelay}ms ${iterStr} ${direction} ${fill}`;

			steps.push({
				elementId,
				trigger,
				delayMs: stepDelay,
				durationMs: duration,
				cssKeyframes: keyframeName,
				cssAnimation,
				fillMode: fill,
			});

			// Update cumulative time for "afterPrevious" / "afterDelay" chains.
			if (trigger === 'afterPrevious' || trigger === 'afterDelay') {
				cumulativeMs = stepDelay + duration;
			}
		}

		return steps;
	}

	/**
	 * Returns a `<style>` block string containing all `@keyframes` definitions
	 * required by the animations on this slide. Safe to inject into a
	 * `<style>` element or `dangerouslySetInnerHTML`.
	 */
	public getKeyframeDefinitions(): string {
		const animations = this.slide.nativeAnimations;
		if (!animations || animations.length === 0) {
			return this.dynamicKeyframeBlocks.join('\n\n');
		}

		const needed = new Set<EffectName>();
		for (const anim of animations) {
			const effect = resolveEffect(anim);
			if (effect) {
				needed.add(effect);
			}
		}

		const blocks: string[] = [];
		for (const effect of needed) {
			const def = getEffectKeyframes(effect);
			if (def) {
				blocks.push(def);
			}
		}

		// Append dynamic keyframes for motion paths, rotation, scale
		blocks.push(...this.dynamicKeyframeBlocks);

		return blocks.join('\n\n');
	}
}
