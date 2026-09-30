import { wireMediaBookmarkSteps } from './animation-media-bookmark-gating';
import { wireMediaEndedSteps } from './animation-media-end-gating';
import { executeMediaCommandInDom } from './animation-media-playback';
import { keyframeAnimatedProperties } from './animation-parallel-composition';
import type { PlaybackContext } from './animation-playback-engine';
import { carryBuildState } from './animation-playback-engine';
import { mergeTextStyleOnStart, resolveTextStyleOnCleanup } from './animation-text-style-state';
import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

const playbackOwners = new WeakMap<PlaybackContext['setStates'], Map<string, symbol>>();

/**
 * Apply a click-group's steps onto the element-state map: fire sound / media
 * commands, set each step's initial visibility + CSS animation, then schedule
 * cleanup timers to clear the animation (and hide exits) once each step ends.
 *
 * An `onStopAudio`-gated step also gets a real `ended` listener wired via
 * `wireMediaEndedSteps` (`animation-media-end-gating`), which corrects the
 * fallback estimate below once the actual media element finishes; the
 * fallback still fires unconditionally, so no-real-media contexts
 * (export/headless) are unaffected.
 */
export function applyAnimationGroupSteps(group: TimelineClickGroup, ctx: PlaybackContext): void {
	wireMediaEndedSteps(group, ctx);
	wireMediaBookmarkSteps(group, ctx);

	const ownedAnimations = new Map<string, string[]>();
	const owner = Symbol('animation group');
	const owners = playbackOwners.get(ctx.setStates) ?? new Map<string, symbol>();
	playbackOwners.set(ctx.setStates, owners);
	for (const step of group.steps) {
		if (step.elementId && !step.command) {
			owners.set(step.elementId, owner);
		}
	}

	// Sound + media-playback side effects.
	for (const step of group.steps) {
		if (step.command) {
			const command = step.command;
			const timer = window.setTimeout(
				() => {
					executeMediaCommandInDom(command, ctx.frameRoot);
				},
				Math.max(0, step.delayMs),
			);
			ctx.timers.push(timer);
			continue;
		}
		if (step.stopSound) {
			// A chained-motion segment's stop cue fires at its authored start
			// (see `animation-motion-path-chain`), so delay it like commands.
			if (step.delayMs > 0) {
				const stopTimer = window.setTimeout(() => {
					ctx.stopSound();
				}, step.delayMs);
				ctx.timers.push(stopTimer);
			} else {
				ctx.stopSound();
			}
		} else if (step.soundPath) {
			// Same: an animation sound belongs at its own effect's start, not
			// at the group's. delayMs 0 keeps the historical immediate fire.
			const soundPath = step.soundPath;
			if (step.delayMs > 0) {
				const soundTimer = window.setTimeout(() => {
					(ctx.onPlayActionSound ?? ctx.playSound)(soundPath);
				}, step.delayMs);
				ctx.timers.push(soundTimer);
			} else {
				(ctx.onPlayActionSound ?? ctx.playSound)(soundPath);
			}
		}
	}

	// Initial CSS-animation / visibility state. A `p:animClr` step also surfaces
	// its fill / stroke colour targets so the vector / connector renderers
	// relinquish their static paint (`inherit`) and the wrapper's colour keyframes
	// cascade in for the duration of the step.
	ctx.setStates((previous) => {
		const next = new Map(previous);
		// Accumulate disjoint properties only within this invocation.
		interface AnimationComponent {
			animation: string;
			properties: Set<string>;
			colorTargets?: TimelineStep['colorTargets'];
		}
		const componentsByElement = new Map<string, AnimationComponent[]>();
		for (const step of group.steps) {
			if (step.command || !step.elementId) {
				continue;
			}
			const current = next.get(step.elementId);
			const shouldBeVisible = step.presetClass === 'exit' ? (current?.visible ?? true) : true;
			const carried = carryBuildState(current);
			let components = componentsByElement.get(step.elementId);
			if (!components) {
				components = [];
				componentsByElement.set(step.elementId, components);
			}
			if (step.cssAnimation) {
				const names = [...step.cssAnimation.matchAll(/(?:^|,\s*)([\w-]+)\s+[\d.]+m?s\b/gu)].map(
					(match) => match[1],
				);
				const stepProperties = new Set(
					(names.length ? names : [step.keyframeName]).flatMap((name) => [
						...keyframeAnimatedProperties(name),
					]),
				);
				// An unrecognised keyframe name claims every property (conservative
				// takeover); a recognised one that animates nothing (a no-op
				// preset) simply coexists.
				const takesOverEverything = stepProperties.has('unknown');
				for (let index = components.length - 1; index >= 0; index--) {
					const component = components[index];
					const collides =
						takesOverEverything ||
						component.properties.has('unknown') ||
						[...stepProperties].some((property) => component.properties.has(property));
					if (collides) {
						components.splice(index, 1);
					}
				}
				components.push({
					animation: step.cssAnimation,
					properties: stepProperties,
					colorTargets: step.colorTargets,
				});
				ownedAnimations.set(
					step.elementId,
					components.map((component) => component.animation),
				);
			}
			next.set(step.elementId, {
				...carried,
				visible: shouldBeVisible,
				cssAnimation: components.map((component) => component.animation).join(', ') || undefined,
				animatesFill:
					components.some((component) => component.colorTargets?.includes('fill')) || undefined,
				animatesStroke:
					components.some((component) => component.colorTargets?.includes('stroke')) || undefined,
				textStyle: mergeTextStyleOnStart(carried.textStyle, step.textStyle),
			});
		}
		return next;
	});

	// Cleanup after each step completes: clear the animation, hide finished exits,
	// and drop the colour-target flags so the static paint is restored.
	for (const step of group.steps) {
		if (step.command || !step.elementId) {
			continue;
		}
		const timer = window.setTimeout(
			() => {
				const components = ownedAnimations.get(step.elementId) ?? [];
				const remaining = step.holdEndState
					? components
					: components.filter((animation) => animation !== step.cssAnimation);
				ctx.setStates((previous) => {
					const next = new Map(previous);
					const current = next.get(step.elementId);
					if (
						owners.get(step.elementId) !== owner ||
						current?.cssAnimation !== (components.join(', ') || undefined) ||
						(step.cssAnimation && !components.includes(step.cssAnimation))
					) {
						return next;
					}
					// `afterAnimation: "hideAfterAnimation"` hides the element once its
					// (entrance/emphasis) effect ends, overriding normal visibility.
					const visibleAfter =
						step.presetClass === 'exit' || step.hideAfterEffect
							? false
							: (current?.visible ?? true);
					// `p:cTn/@fill="hold"`/`"freeze"`: keep the CSS animation attached so
					// its final frame persists instead of reverting on cleanup. A
					// font-style emphasis's text-style override follows the SAME flag.
					const carried = carryBuildState(current);
					next.set(step.elementId, {
						...carried,
						visible: visibleAfter,
						cssAnimation: remaining.join(', ') || undefined,
						animatesFill: step.colorTargets ? undefined : current?.animatesFill,
						animatesStroke: step.colorTargets ? undefined : current?.animatesStroke,
						textStyle: resolveTextStyleOnCleanup(
							carried.textStyle,
							step.textStyle,
							step.holdEndState,
						),
					});
					return next;
				});
				ownedAnimations.set(step.elementId, remaining);
			},
			Math.max(0, step.delayMs + step.durationMs + 8),
		);
		ctx.timers.push(timer);
	}
}
